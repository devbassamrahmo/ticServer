// src/routes/dashboard.routes.js
const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboard.controller');
const { authRequired } = require('../middleware/auth');

router.use(authRequired);

// ملخص الداشبورد
router.get('/summary', dashboardController.getSummary);

// منحنى الزيارات
router.get('/visits', dashboardController.getVisits);

// أكثر العقارات زيارة
router.get('/top-listings', dashboardController.getTopListings);

module.exports = router;
