// src/middleware/upload.js
const multer = require('multer');

const storage = multer.memoryStorage();

// ❗ مافي fileFilter ولا شي، أي حقل ملف بيقبله
const upload = multer({ storage });

module.exports = upload;