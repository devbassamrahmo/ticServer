// src/routes/event.routes.js
const express = require('express');
const router = express.Router();
const eventController = require('../controllers/event.controller');

// public endpoints
router.post('/view', eventController.trackView);
router.post('/whatsapp', eventController.trackWhatsappClick);
router.post('/call', eventController.trackCallClick);

module.exports = router;
