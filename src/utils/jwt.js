const jwt = require('jsonwebtoken');

function signUserToken(user) {
  const payload = {
    id: user.id,
    phone: user.phone,
    is_admin: user.is_admin === true,
  };

  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' });
}

function verifyToken(token) {
  return jwt.verify(token, process.env.JWT_SECRET);
}

module.exports = {
  signUserToken,
  verifyToken,
};
