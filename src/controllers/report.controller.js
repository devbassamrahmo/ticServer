// src/controllers/report.controller.js
const { getSiteBySlug } = require('../models/site.model');
const { getPublicCarByIdForSite } = require('../models/car.model');
const { getPublicListingByIdForSite } = require('../models/listing.model');
const { createReport } = require('../models/report.model');

const ALLOWED_REASONS = new Set([
  'wrong_price',
  'wrong_location',
  'violates_authority_rules',
  'old_ad',
  'other',
]);

function getIp(req) {
  return (
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.socket?.remoteAddress ||
    null
  );
}

function normalizeReason(x) {
  return String(x || '').trim();
}

function normalizeMessage(x) {
  const v = String(x || '').trim();
  return v.length ? v : '';
}

function validateReportInput({ reason, message }) {
  const r = normalizeReason(reason);
  const m = normalizeMessage(message);

  if (!ALLOWED_REASONS.has(r)) {
    return { ok: false, message: 'سبب البلاغ غير صالح' };
  }

  // إذا "سبب آخر" لازم رسالة
  if (r === 'other') {
    if (!m || m.length < 5) {
      return { ok: false, message: 'الرسالة مطلوبة (5 أحرف على الأقل) عند اختيار سبب آخر' };
    }
  } else {
    // باقي الأسباب: الرسالة اختيارية، لكن إذا انبعت لازم تكون محترمة
    if (m && m.length < 5) {
      return { ok: false, message: 'إذا كتبت رسالة لازم تكون 5 أحرف على الأقل' };
    }
  }

  return { ok: true, reason: r, message: m || null };
}

async function loadPublishedSiteOr404(slug, res) {
  const site = await getSiteBySlug(slug);
  if (!site || !site.is_published) {
    res.status(404).json({ success: false, message: 'الموقع غير موجود أو غير منشور' });
    return null;
  }
  return site;
}

// POST /api/site/public/:slug/cars/:carId/report
exports.reportCar = async (req, res) => {
  try {
    const { slug, carId } = req.params;
    const { reason, message, reporter_name, reporter_email, reporter_phone } = req.body;

    const v = validateReportInput({ reason, message });
    if (!v.ok) {
      return res.status(400).json({ success: false, message: v.message });
    }

    const site = await loadPublishedSiteOr404(slug, res);
    if (!site) return;

    if (site.sector !== 'cars') {
      return res.status(400).json({ success: false, message: 'هذا الموقع ليس موقع سيارات' });
    }

    const car = await getPublicCarByIdForSite(site.id, carId);
    if (!car) {
      return res.status(404).json({ success: false, message: 'السيارة غير موجودة' });
    }

    const report = await createReport({
      site_id: site.id,
      owner_id: site.owner_id,
      target_type: 'car',
      target_id: carId,
      reason: v.reason,
      message: v.message,
      reporter_name,
      reporter_email,
      reporter_phone,
      reporter_ip: getIp(req),
      user_agent: req.headers['user-agent'] || null,
    });

    return res.status(201).json({ success: true, report_id: report.id });
  } catch (err) {
    console.error('reportCar error:', err);
    return res.status(500).json({ success: false, message: 'خطأ في السيرفر' });
  }
};

// POST /api/site/public/:slug/listings/:listingId/report
// (للـ property + project)
exports.reportListing = async (req, res) => {
  try {
    const { slug, listingId } = req.params;
    const { reason, message, reporter_name, reporter_email, reporter_phone } = req.body;

    const v = validateReportInput({ reason, message });
    if (!v.ok) {
      return res.status(400).json({ success: false, message: v.message });
    }

    const site = await loadPublishedSiteOr404(slug, res);
    if (!site) return;

    if (site.sector !== 'realestate') {
      return res.status(400).json({ success: false, message: 'هذا الموقع ليس موقع عقارات' });
    }

    const listing = await getPublicListingByIdForSite(site.id, listingId);
    if (!listing) {
      return res.status(404).json({ success: false, message: 'الإعلان غير موجود' });
    }

    const target_type = listing.type === 'project' ? 'project' : 'property';

    const report = await createReport({
      site_id: site.id,
      owner_id: site.owner_id,
      target_type,
      target_id: listingId,
      reason: v.reason,
      message: v.message,
      reporter_name,
      reporter_email,
      reporter_phone,
      reporter_ip: getIp(req),
      user_agent: req.headers['user-agent'] || null,
    });

    return res.status(201).json({ success: true, report_id: report.id });
  } catch (err) {
    console.error('reportListing error:', err);
    return res.status(500).json({ success: false, message: 'خطأ في السيرفر' });
  }
};
