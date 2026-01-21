const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { authRequired } = require('../middleware/auth');

router.post('/request-otp', authController.requestOtp);
router.post('/verify-otp', authController.verifyOtp);
router.post('/complete-profile', authController.completeProfile);

// ✅ refresh endpoint
router.post('/refresh', authController.refresh);

router.post('/logout', authRequired, authController.logout);

module.exports = router;
