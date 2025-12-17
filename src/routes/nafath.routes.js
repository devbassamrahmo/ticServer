// src/routes/nafath.routes.js
const express = require('express');
const router = express.Router();
const nafathController = require('../controllers/nafath.controller');
const { authRequired } = require('../middleware/auth');

console.log('authRequired:', typeof authRequired);
console.log('nafathController.startLogin:', typeof nafathController.startLogin);
console.log('nafathController.checkStatus:', typeof nafathController.checkStatus);
console.log('nafathController.callback:', typeof nafathController.callback);
// المستخدم لازم يكون مسجّل عندك عشان يربط حسابه بنفاذ
router.post('/start', authRequired, express.json(), nafathController.startLogin);
router.get('/status/:requestId', authRequired, nafathController.checkStatus);

// callback من نفاذ (ما عليه auth، نفاذ بس يضربه)
router.post('/callback', express.json(), nafathController.callback);

module.exports = router;
