const express = require('express');

const router = express.Router();

router.post('/notify', (req, res) => {
  console.log('已收到綠界通知；本地流程會透過 QueryTradeInfo 驗證付款狀態。', req.body);
  res.type('text/plain').send('1|OK');
});

module.exports = router;
