const jwt = require('jsonwebtoken');

exports.authRequired = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader)
    return res.status(401).json({ success: false, message: 'توكن مفقود' });

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log(decoded)
    // نضيف البيانات للـ request
    req.user = {
      id: decoded.id,
      phone: decoded.phone,
      is_admin: decoded.is_admin || false,
    };

    next();
  } catch (err) {
    return res
      .status(401)
      .json({ success: false, message: 'توكن غير صالح أو منتهي' });
  }
};
