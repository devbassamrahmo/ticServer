// src/middleware/upload.js
const multer = require('multer');

const storage = multer.memoryStorage(); // بنخزن الملف بالذاكرة مؤقتاً
const upload = multer({ storage });

module.exports = upload;
