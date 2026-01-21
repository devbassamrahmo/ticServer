// src/utils/jwt.js
const jwt = require('jsonwebtoken');

function signUserToken(user) {
  const payload = {
    id: user.id,
    phone: user.phone,
    is_admin: user.is_admin === true,
  };

  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.ACCESS_TOKEN_TTL || '15m',
  });
}

function verifyToken(token) {
  return jwt.verify(token, process.env.JWT_SECRET);
}

module.exports = {
  signUserToken,
  verifyToken,
};
