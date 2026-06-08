const { app, request, getAdminToken, registerUser } = require('./setup');
const ecpayService = require('../src/services/ecpayService');

function buildEcpayQueryResponse(fields) {
  const params = {
    MerchantID: '3002607',
    MerchantTradeNo: fields.MerchantTradeNo,
    StoreID: '',
    TradeNo: fields.TradeNo || '1234567890',
    TradeAmt: String(fields.TradeAmt),
    PaymentDate: fields.PaymentDate || '',
    PaymentType: fields.PaymentType || '',
    HandlingCharge: '0',
    PaymentTypeChargeFee: '0',
    TradeDate: '2026/05/30 12:00:00',
    TradeStatus: String(fields.TradeStatus),
    ItemName: fields.ItemName || 'Test Product',
    CustomField1: '',
    CustomField2: '',
    CustomField3: '',
    CustomField4: ''
  };
  params.CheckMacValue = ecpayService.generateCheckMacValue(
    params,
    'pwFHCqoQZGmho4w6',
    'EkRm7iFT261dpevs',
    'sha256'
  );
  return new URLSearchParams(params).toString();
}

async function createPendingOrder() {
  const { token } = await registerUser();
  const prodRes = await request(app).get('/api/products');
  let product = prodRes.body.data.products.find((item) => item.stock > 0);

  if (!product) {
    const adminToken = await getAdminToken();
    const createProductRes = await request(app)
      .post('/api/admin/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: `ECPay Test Product ${Date.now()}`,
        description: 'Product created for ECPay integration tests',
        price: 100,
        stock: 50,
        image_url: 'https://example.com/test.jpg'
      });

    product = createProductRes.body.data;
  }

  const productId = product.id;

  await request(app)
    .post('/api/cart')
    .set('Authorization', `Bearer ${token}`)
    .send({ productId, quantity: 1 });

  const orderRes = await request(app)
    .post('/api/orders')
    .set('Authorization', `Bearer ${token}`)
    .send({
      recipientName: 'ECPay Test User',
      recipientEmail: 'ecpay-test@example.com',
      recipientAddress: 'ECPay Test Address',
    });

  return { token, order: orderRes.body.data };
}

describe('ECPay integration', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('should generate CheckMacValue from the official SHA256 vector', () => {
    const params = {
      MerchantID: '3002607',
      MerchantTradeNo: 'Test1234567890',
      MerchantTradeDate: '2025/01/01 12:00:00',
      PaymentType: 'aio',
      TotalAmount: '100',
      TradeDesc: '測試',
      ItemName: '測試商品',
      ReturnURL: 'https://example.com/notify',
      ChoosePayment: 'ALL',
      EncryptType: '1',
    };

    const result = ecpayService.generateCheckMacValue(
      params,
      'pwFHCqoQZGmho4w6',
      'EkRm7iFT261dpevs',
      'sha256'
    );

    expect(result).toBe('291CBA324D31FB5A4BBBFDF2CFE5D32598524753AFD4959C3BF590C5B2F57FB2');
  });

  it('should encode apostrophes correctly for Node.js CheckMacValue', () => {
    const params = {
      MerchantID: '3002607',
      ItemName: "Tom's Shop",
      TotalAmount: '100',
    };

    const result = ecpayService.generateCheckMacValue(
      params,
      'pwFHCqoQZGmho4w6',
      'EkRm7iFT261dpevs',
      'sha256'
    );

    expect(result).toBe('CF0A3D4901D99459D8641516EC57210700E8A5C9AB26B1D021301E9CB93EF78D');
  });

  it('should generate ECPay checkout params for a pending order', async () => {
    const { token, order } = await createPendingOrder();

    const res = await request(app)
      .post(`/api/orders/${order.id}/ecpay/checkout`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('error', null);
    expect(res.body.data.action).toBe('https://payment-stage.ecpay.com.tw/Cashier/AioCheckOut/V5');
    expect(res.body.data.params).toHaveProperty('CheckMacValue');
    expect(res.body.data.params).toHaveProperty('ChoosePayment', 'ALL');
    expect(res.body.data.params).toHaveProperty('EncryptType', 1);
    expect(res.body.data.params.OrderResultURL).toBe(`http://localhost:3001/orders/${order.id}?payment=result`);
    expect(res.body.data.params.ClientBackURL).toBe(`http://localhost:3001/orders/${order.id}?payment=returned`);
    expect(res.body.data.params.MerchantTradeNo).toMatch(/^[A-Z0-9]{1,20}$/);
    expect(res.body.data.params).not.toHaveProperty('HashKey');
    expect(res.body.data.params).not.toHaveProperty('HashIV');
  });

  it('should generate a new MerchantTradeNo for each checkout attempt', async () => {
    const { token, order } = await createPendingOrder();

    const first = await request(app)
      .post(`/api/orders/${order.id}/ecpay/checkout`)
      .set('Authorization', `Bearer ${token}`);

    const second = await request(app)
      .post(`/api/orders/${order.id}/ecpay/checkout`)
      .set('Authorization', `Bearer ${token}`);

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(second.body.data.params.MerchantTradeNo).not.toBe(first.body.data.params.MerchantTradeNo);
    expect(second.body.data.order.status).toBe('pending');
  });

  it('should allow a failed order to retry ECPay checkout with a new trade number', async () => {
    const { token, order } = await createPendingOrder();

    const firstCheckout = await request(app)
      .post(`/api/orders/${order.id}/ecpay/checkout`)
      .set('Authorization', `Bearer ${token}`);

    const failed = await request(app)
      .patch(`/api/orders/${order.id}/pay`)
      .set('Authorization', `Bearer ${token}`)
      .send({ action: 'fail' });

    const retryCheckout = await request(app)
      .post(`/api/orders/${order.id}/ecpay/checkout`)
      .set('Authorization', `Bearer ${token}`);

    expect(failed.status).toBe(200);
    expect(failed.body.data.status).toBe('failed');
    expect(retryCheckout.status).toBe(200);
    expect(retryCheckout.body.data.order.status).toBe('pending');
    expect(retryCheckout.body.data.params.MerchantTradeNo).not.toBe(firstCheckout.body.data.params.MerchantTradeNo);
  });

  it('should mark an order paid when QueryTradeInfo returns paid with matching amount', async () => {
    const { token, order } = await createPendingOrder();

    const checkoutRes = await request(app)
      .post(`/api/orders/${order.id}/ecpay/checkout`)
      .set('Authorization', `Bearer ${token}`);

    const merchantTradeNo = checkoutRes.body.data.params.MerchantTradeNo;
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => buildEcpayQueryResponse({
        MerchantTradeNo: merchantTradeNo,
        TradeAmt: order.total_amount,
        TradeStatus: '1',
        PaymentDate: '2026/05/30 12:30:00',
        PaymentType: 'Credit_CreditCard'
      })
    });

    const res = await request(app)
      .post(`/api/orders/${order.id}/ecpay/query`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('error', null);
    expect(res.body.data.order).toHaveProperty('status', 'paid');
    expect(res.body.data.ecpay).toHaveProperty('tradeStatus', '1');
  });

  it('should keep an order pending when QueryTradeInfo returns unpaid', async () => {
    const { token, order } = await createPendingOrder();

    const checkoutRes = await request(app)
      .post(`/api/orders/${order.id}/ecpay/checkout`)
      .set('Authorization', `Bearer ${token}`);

    const merchantTradeNo = checkoutRes.body.data.params.MerchantTradeNo;
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => buildEcpayQueryResponse({
        MerchantTradeNo: merchantTradeNo,
        TradeAmt: order.total_amount,
        TradeStatus: '0'
      })
    });

    const res = await request(app)
      .post(`/api/orders/${order.id}/ecpay/query`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('error', null);
    expect(res.body.data.order).toHaveProperty('status', 'pending');
    expect(res.body.data.ecpay).toHaveProperty('tradeStatus', '0');
  });

  it('should mark an order failed when returned checkout remains unpaid after final confirmation', async () => {
    const { token, order } = await createPendingOrder();

    const checkoutRes = await request(app)
      .post(`/api/orders/${order.id}/ecpay/checkout`)
      .set('Authorization', `Bearer ${token}`);

    const merchantTradeNo = checkoutRes.body.data.params.MerchantTradeNo;
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => buildEcpayQueryResponse({
        MerchantTradeNo: merchantTradeNo,
        TradeAmt: order.total_amount,
        TradeStatus: '0'
      })
    });

    const res = await request(app)
      .post(`/api/orders/${order.id}/ecpay/query`)
      .set('Authorization', `Bearer ${token}`)
      .send({ markFailedWhenUnpaid: true });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('error', null);
    expect(res.body.data.order).toHaveProperty('status', 'failed');
    expect(res.body.data.ecpay).toHaveProperty('tradeStatus', '0');
  });

  it('should force mark an ECPay order failed from the browser result flow', async () => {
    const { token, order } = await createPendingOrder();

    await request(app)
      .post(`/api/orders/${order.id}/ecpay/checkout`)
      .set('Authorization', `Bearer ${token}`);

    const res = await request(app)
      .post(`/api/orders/${order.id}/ecpay/fail`)
      .set('Authorization', `Bearer ${token}`)
      .send({ reason: 'client_result_failed' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('error', null);
    expect(res.body.data.order).toHaveProperty('status', 'failed');
    expect(res.body.data.ecpay).toHaveProperty('tradeStatus', 'client_result_failed');
  });

  it('should not force mark an already paid ECPay order failed', async () => {
    const { token, order } = await createPendingOrder();

    const checkoutRes = await request(app)
      .post(`/api/orders/${order.id}/ecpay/checkout`)
      .set('Authorization', `Bearer ${token}`);

    const merchantTradeNo = checkoutRes.body.data.params.MerchantTradeNo;
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => buildEcpayQueryResponse({
        MerchantTradeNo: merchantTradeNo,
        TradeAmt: order.total_amount,
        TradeStatus: '1',
        PaymentDate: '2026/05/30 12:30:00',
        PaymentType: 'Credit_CreditCard'
      })
    });

    await request(app)
      .post(`/api/orders/${order.id}/ecpay/query`)
      .set('Authorization', `Bearer ${token}`);

    const res = await request(app)
      .post(`/api/orders/${order.id}/ecpay/fail`)
      .set('Authorization', `Bearer ${token}`)
      .send({ reason: 'client_result_failed' });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error', 'INVALID_STATUS');
  });

  it('should reject paid query results with mismatched amount', async () => {
    const { token, order } = await createPendingOrder();

    const checkoutRes = await request(app)
      .post(`/api/orders/${order.id}/ecpay/checkout`)
      .set('Authorization', `Bearer ${token}`);

    const merchantTradeNo = checkoutRes.body.data.params.MerchantTradeNo;
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => buildEcpayQueryResponse({
        MerchantTradeNo: merchantTradeNo,
        TradeAmt: order.total_amount + 1,
        TradeStatus: '1'
      })
    });

    const res = await request(app)
      .post(`/api/orders/${order.id}/ecpay/query`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(409);
    expect(res.body).toHaveProperty('error', 'ECPAY_AMOUNT_MISMATCH');
  });

  it('should return 502 when ECPay query fails', async () => {
    const { token, order } = await createPendingOrder();

    await request(app)
      .post(`/api/orders/${order.id}/ecpay/checkout`)
      .set('Authorization', `Bearer ${token}`);

    global.fetch = vi.fn().mockRejectedValue(new Error('network down'));

    const res = await request(app)
      .post(`/api/orders/${order.id}/ecpay/query`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(502);
    expect(res.body).toHaveProperty('error', 'ECPAY_QUERY_FAILED');
  });
});
