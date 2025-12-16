const jwt = require('jsonwebtoken');

exports.authRequired = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ success: false, message: 'توكن مفقود' });
  }

  const [scheme, token] = authHeader.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ success: false, message: 'صيغة التوكن غير صحيحة' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.user = {
      id: decoded.id,
      phone: decoded.phone,
      is_admin: decoded.is_admin || false,
    };

    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'توكن غير صالح أو منتهي' });
  }
};
