const { createApp, ref, onMounted } = Vue;

createApp({
  setup() {
    if (!Auth.requireAuth()) return {};

    const el = document.getElementById('app');
    const orderId = el.dataset.orderId;
    const initialPaymentResult = el.dataset.paymentResult || '';

    const order = ref(null);
    const loading = ref(true);
    const paying = ref(false);
    const checking = ref(false);
    const autoChecking = ref(false);
    const paymentResult = ref(initialPaymentResult || null);
    const paymentMessage = ref('');

    const statusMap = {
      pending: { label: '待付款', cls: 'bg-apricot/20 text-apricot' },
      paid: { label: '已付款', cls: 'bg-sage/20 text-sage' },
      failed: { label: '付款失敗', cls: 'bg-red-100 text-red-600' },
    };

    const paymentMessages = {
      success: { text: '付款已由綠界確認，訂單付款資訊已更新。', cls: 'bg-sage/10 text-sage border border-sage/20' },
      pending: { text: '尚未查到付款完成。若剛付款成功，綠界資料可能需要數秒同步，系統會再確認。', cls: 'bg-apricot/10 text-apricot border border-apricot/20' },
      returned: { text: '已返回商店，正在自動向綠界確認付款狀態。', cls: 'bg-apricot/10 text-apricot border border-apricot/20' },
      failed: { text: '付款狀態確認失敗，請稍後再試或重新付款。', cls: 'bg-red-50 text-red-600 border border-red-100' },
    };

    function updatePaymentMessage(type, customText) {
      paymentResult.value = type;
      paymentMessage.value = customText || paymentMessages[type]?.text || '';
    }

    function getEcpayActionUrl(action) {
      const url = new URL(action);
      const allowedHosts = new Set([
        'payment-stage.ecpay.com.tw',
        'payment.ecpay.com.tw',
      ]);

      if (url.protocol !== 'https:' || !allowedHosts.has(url.hostname)) {
        throw new Error('Invalid ECPay checkout URL');
      }

      if (url.pathname !== '/Cashier/AioCheckOut/V5') {
        throw new Error('Invalid ECPay checkout path');
      }

      return url.toString();
    }

    function submitEcpayForm(action, params) {
      const form = document.createElement('form');
      form.method = 'POST';
      form.action = getEcpayActionUrl(action);
      form.acceptCharset = 'UTF-8';
      form.enctype = 'application/x-www-form-urlencoded';
      form.target = '_self';
      form.style.display = 'none';
      form.dataset.ecpayCheckout = 'true';

      Object.keys(params).forEach(function (key) {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = key;
        input.value = params[key] == null ? '' : String(params[key]);
        form.appendChild(input);
      });

      document.querySelectorAll('form[data-ecpay-checkout="true"]').forEach(function (oldForm) {
        oldForm.remove();
      });

      document.body.appendChild(form);
      form.submit();
    }

    async function loadOrder() {
      const res = await apiFetch('/api/orders/' + orderId);
      order.value = res.data;
    }

    async function startEcpayPayment() {
      if (!order.value || paying.value || checking.value) return;

      paying.value = true;
      try {
        const res = await apiFetch('/api/orders/' + order.value.id + '/ecpay/checkout', {
          method: 'POST',
        });

        if (res.data.order) {
          order.value = res.data.order;
        }

        updatePaymentMessage('returned', '正在轉往綠界付款頁，請不要重複點擊。');
        submitEcpayForm(res.data.action, res.data.params);
      } catch (err) {
        console.error(err);
        Notification.show(err?.data?.message || '建立綠界付款失敗，請稍後再試。', 'error');
        paying.value = false;
      }
    }

    async function checkEcpayPayment(options = {}) {
      if (!order.value || checking.value) return false;

      const silent = Boolean(options.silent);
      const markFailedWhenUnpaid = Boolean(options.markFailedWhenUnpaid);
      checking.value = true;

      try {
        const res = await apiFetch('/api/orders/' + order.value.id + '/ecpay/query', {
          method: 'POST',
          body: JSON.stringify({ markFailedWhenUnpaid }),
        });

        order.value = res.data.order;

        if (order.value.status === 'paid') {
          updatePaymentMessage('success');
          if (!silent) Notification.show('付款已確認，訂單已更新。', 'success');
          return true;
        }

        if (order.value.status === 'failed') {
          updatePaymentMessage('failed', '付款未完成，訂單已更新為付款失敗。你可以重新發起付款。');
          if (!silent) Notification.show('付款未完成，訂單已更新為付款失敗。', 'error');
          return false;
        }

        updatePaymentMessage('pending');
        if (!silent) Notification.show('尚未查到付款完成，請稍後再確認。', 'info');
        return false;
      } catch (err) {
        updatePaymentMessage('failed', err?.data?.message || paymentMessages.failed.text);
        if (!silent) Notification.show(err?.data?.message || '確認綠界付款狀態失敗。', 'error');
        return false;
      } finally {
        checking.value = false;
      }
    }

    async function forceFailEcpayPayment(reason) {
      if (!order.value || order.value.status === 'paid') return false;

      try {
        const res = await apiFetch('/api/orders/' + order.value.id + '/ecpay/fail', {
          method: 'POST',
          body: JSON.stringify({ reason: reason || 'client_result_failed' }),
        });

        order.value = res.data.order;
        updatePaymentMessage('failed', 'Payment was not completed. This order has been marked as payment failed.');
        return true;
      } catch (err) {
        updatePaymentMessage('failed', err?.data?.message || paymentMessages.failed.text);
        return false;
      }
    }

    async function autoConfirmPaymentAfterReturn() {
      const isResultReturn = initialPaymentResult === 'result' || initialPaymentResult === 'failed';
      if (!order.value) return;
      if (isResultReturn && order.value.status === 'paid') {
        updatePaymentMessage('success');
        return;
      }
      if (isResultReturn && order.value.status === 'failed') {
        updatePaymentMessage('failed', '付款流程未完成，訂單已標記為付款失敗。');
        return;
      }
      if (order.value.status !== 'pending') return;
      if (initialPaymentResult !== 'returned' && !isResultReturn && !order.value.ecpay_merchant_trade_no) return;

      autoChecking.value = true;
      updatePaymentMessage('returned');

      if (isResultReturn) {
        const paid = await checkEcpayPayment({
          silent: true,
          markFailedWhenUnpaid: true,
        });

        if (paid) {
          Notification.show('付款已確認，訂單已更新。', 'success');
        } else if (order.value && order.value.status === 'failed') {
          Notification.show('付款流程未完成，訂單已標記為付款失敗。', 'error');
        } else if (order.value && order.value.status !== 'failed') {
          await forceFailEcpayPayment('client_result_failed');
          Notification.show('付款流程未完成，訂單已標記為付款失敗。', 'error');
        }

        autoChecking.value = false;
        return;
      }

      const delays = [800, 2000, 3000, 5000];
      for (let i = 0; i < delays.length; i += 1) {
        const delay = delays[i];
        await new Promise((resolve) => setTimeout(resolve, delay));
        const paid = await checkEcpayPayment({
          silent: true,
          markFailedWhenUnpaid: i === delays.length - 1,
        });
        if (paid) {
          Notification.show('付款已確認，訂單已更新。', 'success');
          autoChecking.value = false;
          return;
        }

        if (order.value && order.value.status === 'failed') {
          Notification.show('付款未完成，訂單已更新為付款失敗。', 'error');
          autoChecking.value = false;
          return;
        }
      }

      autoChecking.value = false;
      updatePaymentMessage('pending', '系統尚未查到付款完成。若你已完成付款，請稍後按「重新確認付款狀態」。');
    }

    onMounted(async function () {
      try {
        await loadOrder();
        await autoConfirmPaymentAfterReturn();
      } catch (err) {
        Notification.show('讀取訂單失敗。', 'error');
      } finally {
        loading.value = false;
      }
    });

    return {
      order,
      loading,
      paying,
      checking,
      autoChecking,
      paymentResult,
      paymentMessage,
      paymentMessages,
      statusMap,
      startEcpayPayment,
      checkEcpayPayment,
    };
  },
}).mount('#app');
