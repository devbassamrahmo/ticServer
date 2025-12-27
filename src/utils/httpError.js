// src/utils/httpError.js
function sendError(res, status, code, message, details = undefined) {
  const payload = { success: false, code, message };
  if (details !== undefined) payload.details = details;
  return res.status(status).json(payload);
}

module.exports = { sendError };
