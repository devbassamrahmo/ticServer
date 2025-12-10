// src/routes/account.routes.js
const express = require('express');
const router = express.Router();

const accountController = require('../controllers/account.controller');
const { authRequired } = require('../middleware/auth');

router.use(authRequired);

// المعلومات الأساسية
router.get('/profile', accountController.getProfile);
router.post('/profile', accountController.updateProfile);

// المستندات
router.post('/documents', accountController.uploadDocument);

// التوثيق (محاكاة)
router.post('/verify/nafath', accountController.verifyNafath);
router.post('/verify/real-estate-license', accountController.verifyRealEstateLicense);

// المستخدمون الفرعيون
router.get('/sub-users', accountController.getSubUsers);
router.post('/sub-users', accountController.addSubUser);
router.post('/sub-users/:id/toggle', accountController.toggleSubUser);
router.delete('/sub-users/:id', accountController.deleteSubUser);

module.exports = router;
