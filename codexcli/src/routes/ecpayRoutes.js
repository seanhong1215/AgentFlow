const express = require('express');

const router = express.Router();

router.post('/notify', (req, res) => {
  console.log('ECPay notify received; local flow verifies payment via QueryTradeInfo.', req.body);
  res.type('text/plain').send('1|OK');
});

module.exports = router;

