const crypto = require('crypto');

function generateRefreshToken() {
  // توكن عشوائي قوي
  return crypto.randomBytes(48).toString('base64url');
}

function hashRefreshToken(token) {
  // نخزن hash بالـ DB بدل التوكن نفسه
  return crypto.createHash('sha256').update(token).digest('hex');
}

module.exports = {
  generateRefreshToken,
  hashRefreshToken,
};
