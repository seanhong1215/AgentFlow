const crypto = require('crypto');
const https = require('https');
const querystring = require('querystring');

function ecpayUrlEncode(source) {
  let encoded = encodeURIComponent(source)
    .replace(/%20/g, '+')
    .replace(/~/g, '%7e')
    .replace(/'/g, '%27');
  encoded = encoded.toLowerCase();
  const replacements = {
    '%2d': '-', '%5f': '_', '%2e': '.', '%21': '!',
    '%2a': '*', '%28': '(', '%29': ')',
  };
  for (const [old, char] of Object.entries(replacements)) {
    encoded = encoded.split(old).join(char);
  }
  return encoded;
}

function generateCheckMacValue(params) {
  const hashKey = process.env.ECPAY_HASH_KEY;
  const hashIv = process.env.ECPAY_HASH_IV;
  const filtered = Object.fromEntries(
    Object.entries(params).filter(([k]) => k !== 'CheckMacValue')
  );
  const sorted = Object.keys(filtered).sort((a, b) =>
    a.toLowerCase().localeCompare(b.toLowerCase())
  );
  const paramStr = sorted.map(k => `${k}=${filtered[k]}`).join('&');
  const raw = `HashKey=${hashKey}&${paramStr}&HashIV=${hashIv}`;
  const encoded = ecpayUrlEncode(raw);
  return crypto.createHash('sha256').update(encoded, 'utf8').digest('hex').toUpperCase();
}

function verifyCheckMacValue(params) {
  const received = params.CheckMacValue;
  if (!received) return false;
  const expected = generateCheckMacValue(params);
  try {
    return crypto.timingSafeEqual(Buffer.from(received), Buffer.from(expected));
  } catch {
    return false;
  }
}

function getMerchantTradeDate() {
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  return `${now.getFullYear()}/${pad(now.getMonth() + 1)}/${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
}

function buildPaymentParams(order, orderItems, merchantTradeNo) {
  const isStaging = (process.env.ECPAY_ENV || 'staging') !== 'production';
  const endpoint = isStaging
    ? 'https://payment-stage.ecpay.com.tw/Cashier/AioCheckOut/V5'
    : 'https://payment.ecpay.com.tw/Cashier/AioCheckOut/V5';
  const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3001}`;

  const itemName = orderItems
    .map(item => `${item.product_name} x${item.quantity}`)
    .join('#')
    .slice(0, 200);

  const params = {
    MerchantID: process.env.ECPAY_MERCHANT_ID,
    MerchantTradeNo: merchantTradeNo,
    MerchantTradeDate: getMerchantTradeDate(),
    PaymentType: 'aio',
    TotalAmount: String(order.total_amount),
    TradeDesc: '花卉電商訂單',
    ItemName: itemName,
    ReturnURL: `${baseUrl}/api/ecpay/notify`,
    OrderResultURL: `${baseUrl}/api/ecpay/order-result`,
    ChoosePayment: 'Credit',
    EncryptType: '1',
  };

  params.CheckMacValue = generateCheckMacValue(params);
  return { endpoint, params };
}

function queryEcpayTrade(merchantTradeNo) {
  return new Promise((resolve, reject) => {
    const isStaging = (process.env.ECPAY_ENV || 'staging') !== 'production';
    const endpoint = isStaging
      ? 'https://payment-stage.ecpay.com.tw/Cashier/QueryTradeInfo/V5'
      : 'https://payment.ecpay.com.tw/Cashier/QueryTradeInfo/V5';

    const params = {
      MerchantID: process.env.ECPAY_MERCHANT_ID,
      MerchantTradeNo: merchantTradeNo,
      TimeStamp: String(Math.floor(Date.now() / 1000)),
    };
    params.CheckMacValue = generateCheckMacValue(params);

    const postData = querystring.stringify(params);
    const url = new URL(endpoint);

    const options = {
      hostname: url.hostname,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => resolve(querystring.parse(data)));
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

module.exports = { generateCheckMacValue, verifyCheckMacValue, buildPaymentParams, queryEcpayTrade };
