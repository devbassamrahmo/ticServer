// src/middleware/errorHandler.js
const { sendError } = require('../utils/httpError');

module.exports = function errorHandler(err, req, res, next) {
  console.error('Unhandled error:', err);

  if (res.headersSent) return next(err);

  // Custom app errors (لو بتستخدمهم لاحقاً)
  if (err && err.status && err.code) {
    return sendError(res, err.status, err.code, err.message, err.details);
  }

  // Postgres known errors (اختياري توسيع)
  if (err && err.code === '23505') {
    return sendError(res, 400, 'DUPLICATE', 'القيمة مكررة', { pg: err.code });
  }

  return sendError(res, 500, 'SERVER_ERROR', 'خطأ في السيرفر');
};
