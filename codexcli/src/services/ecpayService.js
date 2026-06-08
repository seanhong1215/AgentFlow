const crypto = require('crypto');

const ECPAY_STAGE_BASE_URL = 'https://payment-stage.ecpay.com.tw';
const ECPAY_PRODUCTION_BASE_URL = 'https://payment.ecpay.com.tw';
const DEFAULT_BASE_URL = 'http://localhost:3001';

function normalizeBaseUrl(value) {
  try {
    const url = new URL(value || DEFAULT_BASE_URL);
    if (!['http:', 'https:'].includes(url.protocol)) return DEFAULT_BASE_URL;
    return url.origin;
  } catch (err) {
    return DEFAULT_BASE_URL;
  }
}

function normalizeReturnUrl(value, baseUrl) {
  try {
    const url = new URL(value || `${baseUrl}/api/ecpay/notify`);
    if (!['http:', 'https:'].includes(url.protocol)) return `${baseUrl}/api/ecpay/notify`;
    return url.toString();
  } catch (err) {
    return `${baseUrl}/api/ecpay/notify`;
  }
}

function getConfig() {
  const env = process.env.ECPAY_ENV || 'staging';
  const baseUrl = env === 'production' ? ECPAY_PRODUCTION_BASE_URL : ECPAY_STAGE_BASE_URL;
  const appBaseUrl = normalizeBaseUrl(process.env.BASE_URL);

  return {
    env,
    merchantId: process.env.ECPAY_MERCHANT_ID || '3002607',
    hashKey: process.env.ECPAY_HASH_KEY || 'pwFHCqoQZGmho4w6',
    hashIv: process.env.ECPAY_HASH_IV || 'EkRm7iFT261dpevs',
    checkoutUrl: `${baseUrl}/Cashier/AioCheckOut/V5`,
    queryUrl: `${baseUrl}/Cashier/QueryTradeInfo/V5`,
    baseUrl: appBaseUrl,
    returnUrl: normalizeReturnUrl(process.env.ECPAY_RETURN_URL, appBaseUrl)
  };
}

function ecpayUrlEncode(source) {
  let encoded = encodeURIComponent(source)
    .replace(/%20/g, '+')
    .replace(/~/g, '%7e')
    .replace(/'/g, '%27');

  encoded = encoded.toLowerCase();

  const replacements = {
    '%2d': '-',
    '%5f': '_',
    '%2e': '.',
    '%21': '!',
    '%2a': '*',
    '%28': '(',
    '%29': ')'
  };

  for (const [from, to] of Object.entries(replacements)) {
    encoded = encoded.split(from).join(to);
  }

  return encoded;
}

function generateCheckMacValue(params, hashKey, hashIv, method = 'sha256') {
  const filtered = Object.fromEntries(
    Object.entries(params)
      .filter(([key, value]) => key !== 'CheckMacValue' && value !== undefined && value !== null)
      .map(([key, value]) => [key, String(value)])
  );

  const sortedKeys = Object.keys(filtered)
    .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
  const paramString = sortedKeys.map((key) => `${key}=${filtered[key]}`).join('&');
  const raw = `HashKey=${hashKey}&${paramString}&HashIV=${hashIv}`;
  const encoded = ecpayUrlEncode(raw);

  return crypto.createHash(method).update(encoded, 'utf8').digest('hex').toUpperCase();
}

function verifyCheckMacValue(params, hashKey, hashIv, method = 'sha256') {
  const received = String(params.CheckMacValue || '');
  const calculated = generateCheckMacValue(params, hashKey, hashIv, method);
  const receivedBuffer = Buffer.from(received);
  const calculatedBuffer = Buffer.from(calculated);

  if (receivedBuffer.length !== calculatedBuffer.length) return false;
  return crypto.timingSafeEqual(receivedBuffer, calculatedBuffer);
}

function pad2(value) {
  return String(value).padStart(2, '0');
}

function formatTaipeiDate(date = new Date()) {
  const taipeiTime = new Date(date.getTime() + 8 * 60 * 60 * 1000);
  return [
    taipeiTime.getUTCFullYear(),
    pad2(taipeiTime.getUTCMonth() + 1),
    pad2(taipeiTime.getUTCDate())
  ].join('/') + ' ' + [
    pad2(taipeiTime.getUTCHours()),
    pad2(taipeiTime.getUTCMinutes()),
    pad2(taipeiTime.getUTCSeconds())
  ].join(':');
}

function sanitizeEcpayText(value, fallback) {
  const text = String(value || fallback || '')
    .replace(/<[^>]*>/g, '')
    .replace(/[\x00-\x1F\x7F]/g, ' ')
    .replace(/[|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return text || fallback;
}

function truncateByChars(value, maxLength) {
  return Array.from(String(value)).slice(0, maxLength).join('');
}

function buildItemName(items) {
  const parts = items.map((item) => {
    const name = sanitizeEcpayText(item.product_name, 'Product').replace(/#/g, ' ');
    return `${name} x ${item.quantity}`;
  });

  return truncateByChars(parts.join('#'), 390);
}

function generateMerchantTradeNo(order) {
  const now = new Date();
  const timestamp = [
    String(now.getUTCFullYear()).slice(-2),
    pad2(now.getUTCMonth() + 1),
    pad2(now.getUTCDate()),
    pad2(now.getUTCHours()),
    pad2(now.getUTCMinutes()),
    pad2(now.getUTCSeconds())
  ].join('');
  const random = crypto.randomBytes(3).toString('hex').toUpperCase();

  return `EC${timestamp}${random}`;
}

function buildCheckoutParams(order, items, merchantTradeNo) {
  const config = getConfig();
  const params = {
    MerchantID: config.merchantId,
    MerchantTradeNo: merchantTradeNo,
    MerchantTradeDate: formatTaipeiDate(),
    PaymentType: 'aio',
    TotalAmount: order.total_amount,
    TradeDesc: truncateByChars(sanitizeEcpayText(`Order ${order.order_no}`, 'Order'), 200),
    ItemName: buildItemName(items),
    ReturnURL: config.returnUrl,
    OrderResultURL: `${config.baseUrl}/orders/${order.id}?payment=result`,
    ClientBackURL: `${config.baseUrl}/orders/${order.id}?payment=returned`,
    ChoosePayment: 'ALL',
    EncryptType: 1
  };

  params.CheckMacValue = generateCheckMacValue(params, config.hashKey, config.hashIv, 'sha256');

  return {
    action: config.checkoutUrl,
    params
  };
}

function parseUrlEncodedResponse(body) {
  const params = new URLSearchParams(body);
  const result = {};
  for (const [key, value] of params.entries()) {
    result[key] = value;
  }
  return result;
}

async function queryTrade(merchantTradeNo, fetchImpl = global.fetch) {
  if (typeof fetchImpl !== 'function') {
    throw new Error('Fetch API is unavailable in this Node.js runtime');
  }

  const config = getConfig();
  const params = {
    MerchantID: config.merchantId,
    MerchantTradeNo: merchantTradeNo,
    TimeStamp: Math.floor(Date.now() / 1000)
  };

  params.CheckMacValue = generateCheckMacValue(params, config.hashKey, config.hashIv, 'sha256');

  const response = await fetchImpl(config.queryUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params).toString()
  });

  const body = await response.text();
  if (!response.ok) {
    const err = new Error(`ECPay query failed with HTTP ${response.status}`);
    err.status = response.status;
    err.body = body;
    throw err;
  }

  const result = parseUrlEncodedResponse(body);
  if (!verifyCheckMacValue(result, config.hashKey, config.hashIv, 'sha256')) {
    const err = new Error('ECPay query response CheckMacValue verification failed');
    err.response = result;
    throw err;
  }

  return result;
}

module.exports = {
  buildCheckoutParams,
  buildItemName,
  ecpayUrlEncode,
  formatTaipeiDate,
  generateCheckMacValue,
  generateMerchantTradeNo,
  getConfig,
  normalizeBaseUrl,
  normalizeReturnUrl,
  queryTrade,
  verifyCheckMacValue
};
