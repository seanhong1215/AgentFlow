const app = require('./app');

const PORT = process.env.PORT || 3001;

if (require.main === module) {
  if (!process.env.JWT_SECRET) {
    console.error('致命錯誤：尚未設定 JWT_SECRET');
    process.exit(1);
  }
  app.listen(PORT, () => {
    console.log(`伺服器已啟動，監聽連接埠 ${PORT}`);
  });
}

module.exports = app;
