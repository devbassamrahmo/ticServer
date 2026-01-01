// src/controllers/event.controller.js
const db = require('../config/db');
const { createEvent } = require('../models/event.model');

async function resolveOwnerAndSite(listing_id, site_id) {
  // 1) cars
  const carRes = await db.query(
    `SELECT dealer_id AS owner_id, site_id
     FROM car_listings
     WHERE id = $1
       AND status = 'active'
       AND is_published = TRUE
     LIMIT 1`,
    [listing_id]
  );

  if (carRes.rows[0]) {
    return {
      owner_id: carRes.rows[0].owner_id,
      site_id: site_id || carRes.rows[0].site_id,
      source: 'car',
    };
  }

  // 2) listings (property/project)
  const listRes = await db.query(
    `SELECT dealer_id AS owner_id, site_id, type
     FROM listings
     WHERE id = $1
       AND status = 'active'
       AND is_published = TRUE
       AND type IN ('property','project')
     LIMIT 1`,
    [listing_id]
  );

  if (listRes.rows[0]) {
    return {
      owner_id: listRes.rows[0].owner_id,
      site_id: site_id || listRes.rows[0].site_id,
      source: listRes.rows[0].type, // property|project
    };
  }

  return null;
}

async function trackEvent(req, res, event_type) {
  try {
    const { listing_id, site_id } = req.body;

    if (!listing_id) {
      return res.status(400).json({
        success: false,
        message: 'listing_id مطلوب',
      });
    }

    const resolved = await resolveOwnerAndSite(listing_id, site_id);
    if (!resolved) {
      return res.status(404).json({
        success: false,
        message: 'الإعلان غير موجود أو غير منشور',
      });
    }

    await createEvent({
      owner_id: resolved.owner_id,
      listing_id,
      site_id: resolved.site_id,
      event_type,
    });

    return res.json({ success: true });
  } catch (err) {
    console.error(`trackEvent(${event_type}) error:`, err);
    return res.status(500).json({ success: false, message: 'خطأ في السيرفر' });
  }
}

exports.trackView = (req, res) => trackEvent(req, res, 'view');
exports.trackWhatsappClick = (req, res) => trackEvent(req, res, 'whatsapp_click');
exports.trackCallClick = (req, res) => trackEvent(req, res, 'call_click');
