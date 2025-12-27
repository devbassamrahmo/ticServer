// src/controllers/public/reports.public.controller.js
const { getSiteBySlug } = require('../../models/site.model');
const { getPublicCarByIdForSite } = require('../../models/car.model');
const { getPublicListingByIdForSite } = require('../../models/listing.model');
const { createAdReport } = require('../../models/report.model');

function getReqIp(req) {
  const xf = req.headers['x-forwarded-for'];
  if (typeof xf === 'string' && xf.length) return xf.split(',')[0].trim();
  return req.ip || null;
}

exports.reportCar = async (req, res) => {
  try {
    const { slug, carId } = req.params;
    const { description, email, phone } = req.body || {};

    if (!description || typeof description !== 'string' || description.trim().length < 5) {
      return res.status(400).json({ success: false, message: 'الوصف مطلوب (5 أحرف على الأقل)' });
    }

    const site = await getSiteBySlug(slug);
    if (!site || !site.is_published || site.sector !== 'cars') {
      return res.status(404).json({ success: false, message: 'الموقع غير موجود أو غير منشور' });
    }

    const car = await getPublicCarByIdForSite(site.id, carId);
    if (!car) return res.status(404).json({ success: false, message: 'الإعلان غير موجود' });

    const report = await createAdReport({
      item_type: 'car',
      item_id: car.id,
      site_id: site.id,
      description: description.trim(),
      reporter_user_id: req.user ? req.user.id : null, // إذا عندك auth على public لاحقاً
      reporter_email: email || null,
      reporter_phone: phone || null,
      ip: getReqIp(req),
      user_agent: req.headers['user-agent'] || null,
    });

    return res.status(201).json({ success: true, report });
  } catch (err) {
    console.error('reportCar error:', err);
    return res.status(500).json({ success: false, message: 'خطأ في السيرفر' });
  }
};

exports.reportListing = async (req, res) => {
  try {
    const { slug, listingId } = req.params;
    const { description, email, phone } = req.body || {};

    if (!description || typeof description !== 'string' || description.trim().length < 5) {
      return res.status(400).json({ success: false, message: 'الوصف مطلوب (5 أحرف على الأقل)' });
    }

    const site = await getSiteBySlug(slug);
    if (!site || !site.is_published || site.sector !== 'realestate') {
      return res.status(404).json({ success: false, message: 'الموقع غير موجود أو غير منشور' });
    }

    const listing = await getPublicListingByIdForSite(site.id, listingId);
    if (!listing) return res.status(404).json({ success: false, message: 'الإعلان غير موجود' });

    const report = await createAdReport({
      item_type: 'listing',
      item_id: listing.id,
      site_id: site.id,
      description: description.trim(),
      reporter_user_id: req.user ? req.user.id : null,
      reporter_email: email || null,
      reporter_phone: phone || null,
      ip: getReqIp(req),
      user_agent: req.headers['user-agent'] || null,
    });

    return res.status(201).json({ success: true, report });
  } catch (err) {
    console.error('reportListing error:', err);
    return res.status(500).json({ success: false, message: 'خطأ في السيرفر' });
  }
};
