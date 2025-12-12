// src/middleware/admin.js
exports.adminRequired = (req, res, next) => {
  console.log(req.user)
  if (!req.user || !req.user.is_admin) {
    return res.status(403).json({
      success: false,
      message: 'يجب أن تكون أدمن للوصول إلى هذه الواجهة',
    });
  }
  next();
};
