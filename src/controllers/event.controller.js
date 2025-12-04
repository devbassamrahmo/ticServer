// src/controllers/event.controller.js
const { createEvent } = require('../models/event.model');

async function trackEvent(req, res, event_type) {
  try {
    const { listing_id, site_id } = req.body;

    if (!listing_id) {
      return res.status(400).json({
        success: false,
        message: 'listing_id مطلوب',
      });
    }

    await createEvent({ listing_id, site_id, event_type });

    // ما في داعي نرجّع داتا كبيرة
    return res.json({ success: true });
  } catch (err) {
    console.error(`trackEvent(${event_type}) error:`, err);
    return res.status(500).json({ success: false, message: 'خطأ في السيرفر' });
  }
}

exports.trackView = (req, res) => trackEvent(req, res, 'view');

exports.trackWhatsappClick = (req, res) =>
  trackEvent(req, res, 'whatsapp_click');

exports.trackCallClick = (req, res) =>
  trackEvent(req, res, 'call_click');
