const express = require('express');
const router = express.Router();
const db = require('../database');
const authMiddleware = require('../middleware/authMiddleware');
const { buildPaymentParams, verifyCheckMacValue, queryEcpayTrade } = require('../utils/ecpay');

// POST /api/ecpay/initiate — generate ECPay AIO payment params for an order
router.post('/initiate', authMiddleware, function (req, res) {
  const { orderId } = req.body;
  if (!orderId) {
    return res.status(400).json({ data: null, error: 'VALIDATION_ERROR', message: '缺少訂單 ID' });
  }

  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  if (!order) {
    return res.status(404).json({ data: null, error: 'NOT_FOUND', message: '訂單不存在' });
  }
  if (order.user_id !== req.user.userId) {
    return res.status(403).json({ data: null, error: 'FORBIDDEN', message: '無權操作此訂單' });
  }
  if (order.status !== 'pending') {
    return res.status(400).json({ data: null, error: 'INVALID_STATUS', message: '訂單狀態非 pending，無法付款' });
  }

  const orderItems = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(orderId);

  // MerchantTradeNo: alphanumeric, max 20 chars — EC + 13-digit ms timestamp = 15 chars
  const merchantTradeNo = 'EC' + String(Date.now());

  db.prepare('UPDATE orders SET ecpay_trade_no = ? WHERE id = ?').run(merchantTradeNo, orderId);

  const { endpoint, params } = buildPaymentParams(order, orderItems, merchantTradeNo);

  return res.json({ data: { endpoint, params }, error: null, message: '付款參數已產生' });
});

// POST /api/ecpay/order-result — browser redirect from ECPay after payment (OrderResultURL)
router.post('/order-result', function (req, res) {
  const body = req.body;

  if (!verifyCheckMacValue(body)) {
    return res.redirect('/orders?payment=error');
  }

  const merchantTradeNo = body.MerchantTradeNo;
  const rtnCode = body.RtnCode;

  const order = db.prepare('SELECT * FROM orders WHERE ecpay_trade_no = ?').get(merchantTradeNo);
  if (!order) {
    return res.redirect('/orders?payment=error');
  }

  if (order.status === 'pending') {
    if (rtnCode === '1') {
      db.prepare("UPDATE orders SET status = 'paid' WHERE id = ?").run(order.id);
      return res.redirect(`/orders/${order.id}?payment=success`);
    } else {
      db.prepare("UPDATE orders SET status = 'failed' WHERE id = ?").run(order.id);
      return res.redirect(`/orders/${order.id}?payment=failed`);
    }
  }

  // Already updated (idempotent)
  const result = order.status === 'paid' ? 'success' : 'failed';
  return res.redirect(`/orders/${order.id}?payment=${result}`);
});

// POST /api/ecpay/notify — server-to-server notify from ECPay (ReturnURL)
// Won't fire in local dev, but required by ECPay; also needed when deployed with public URL
router.post('/notify', function (req, res) {
  const body = req.body;

  if (!verifyCheckMacValue(body)) {
    return res.send('0|CheckMacValue Error');
  }

  const merchantTradeNo = body.MerchantTradeNo;
  const rtnCode = body.RtnCode;

  const order = db.prepare('SELECT * FROM orders WHERE ecpay_trade_no = ?').get(merchantTradeNo);
  if (!order) return res.send('1|OK');

  if (order.status === 'pending') {
    if (rtnCode === '1') {
      db.prepare("UPDATE orders SET status = 'paid' WHERE id = ?").run(order.id);
    } else {
      db.prepare("UPDATE orders SET status = 'failed' WHERE id = ?").run(order.id);
    }
  }

  return res.send('1|OK');
});

// GET /api/ecpay/query/:orderId — actively poll ECPay QueryTradeInfo (fallback for local dev)
router.get('/query/:orderId', authMiddleware, async function (req, res) {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.orderId);
  if (!order) {
    return res.status(404).json({ data: null, error: 'NOT_FOUND', message: '訂單不存在' });
  }
  if (order.user_id !== req.user.userId) {
    return res.status(403).json({ data: null, error: 'FORBIDDEN', message: '無權操作此訂單' });
  }
  if (!order.ecpay_trade_no) {
    return res.status(400).json({ data: null, error: 'NO_ECPAY_TRADE', message: '此訂單尚未發起綠界付款' });
  }

  try {
    const result = await queryEcpayTrade(order.ecpay_trade_no);
    const isPaid = result.TradeStatus === '1';

    if (isPaid && order.status === 'pending') {
      db.prepare("UPDATE orders SET status = 'paid' WHERE id = ?").run(order.id);
    }

    return res.json({
      data: {
        tradeStatus: result.TradeStatus,
        orderStatus: isPaid ? 'paid' : order.status,
        ecpayTradeNo: result.TradeNo || null,
      },
      error: null,
      message: isPaid ? '付款成功' : '付款尚未完成'
    });
  } catch (e) {
    return res.status(500).json({ data: null, error: 'ECPAY_ERROR', message: '查詢失敗：' + e.message });
  }
});

module.exports = router;
