// src/controllers/car.controller.js
const {
  createCarListing,
  getCarsForSite,
  getCarById,
  updateCarListing,
  deleteCarListing,
} = require('../models/car.model');

const { requireOwnerSite } = require('../models/site.model');
const { sendError } = require('../utils/httpError');

async function requireCarsSiteId(ownerId) {
  const site = await requireOwnerSite(ownerId, 'cars');
  return site ? site.id : null;
}

function pgErrorToResponse(res, err) {
  // Foreign key, invalid reference
  if (err && err.code === '23503') {
    return sendError(res, 400, 'INVALID_REFERENCE', 'مرجع غير صالح', { pg: err.code });
  }
  // Invalid text representation / cast
  if (err && err.code === '22P02') {
    return sendError(res, 400, 'INVALID_INPUT', 'مدخلات غير صالحة', { pg: err.code });
  }
  return null;
}

exports.createCar = async (req, res) => {
  try {
    const dealer_id = req.user.id;

    const site_id = await requireCarsSiteId(dealer_id);
    if (!site_id) {
      return sendError(
        res,
        400,
        'NO_SITE_CARS',
        'لا يوجد موقع سيارات لهذا الحساب. أنشئ موقع cars أولاً.',
        { sector: 'cars' }
      );
    }

    // basic validation (خفيف)
    if (!req.body?.title || typeof req.body.title !== 'string' || !req.body.title.trim()) {
      return sendError(res, 400, 'VALIDATION_ERROR', 'العنوان مطلوب', { field: 'title' });
    }

    const car = await createCarListing({ dealer_id, site_id, data: req.body });
    return res.status(201).json({ success: true, car });
  } catch (err) {
    console.error('createCar error:', err);
    const handled = pgErrorToResponse(res, err);
    if (handled) return handled;
    return sendError(res, 500, 'SERVER_ERROR', 'خطأ في السيرفر');
  }
};

exports.getMyCars = async (req, res) => {
  try {
    const dealer_id = req.user.id;

    const site_id = await requireCarsSiteId(dealer_id);
    if (!site_id) {
      return sendError(
        res,
        400,
        'NO_SITE_CARS',
        'لا يوجد موقع سيارات لهذا الحساب. أنشئ موقع cars أولاً.',
        { sector: 'cars' }
      );
    }

    const page = Number(req.query.page || 1);
    const pageSize = Number(req.query.pageSize || 10);

    const data = await getCarsForSite({
      dealer_id,
      site_id,
      page,
      pageSize,
    });

    return res.json({ success: true, ...data });
  } catch (err) {
    console.error('getMyCars error:', err);
    const handled = pgErrorToResponse(res, err);
    if (handled) return handled;
    return sendError(res, 500, 'SERVER_ERROR', 'خطأ في السيرفر');
  }
};

exports.getCar = async (req, res) => {
  try {
    const dealer_id = req.user.id;

    const site_id = await requireCarsSiteId(dealer_id);
    if (!site_id) {
      return sendError(
        res,
        400,
        'NO_SITE_CARS',
        'لا يوجد موقع سيارات لهذا الحساب. أنشئ موقع cars أولاً.',
        { sector: 'cars' }
      );
    }

    const car = await getCarById({ id: req.params.id, dealer_id, site_id });
    if (!car) return sendError(res, 404, 'CAR_NOT_FOUND', 'السيارة غير موجودة');

    return res.json({ success: true, car });
  } catch (err) {
    console.error('getCar error:', err);
    const handled = pgErrorToResponse(res, err);
    if (handled) return handled;
    return sendError(res, 500, 'SERVER_ERROR', 'خطأ في السيرفر');
  }
};

exports.updateCar = async (req, res) => {
  try {
    const dealer_id = req.user.id;

    const site_id = await requireCarsSiteId(dealer_id);
    if (!site_id) {
      return sendError(
        res,
        400,
        'NO_SITE_CARS',
        'لا يوجد موقع سيارات لهذا الحساب. أنشئ موقع cars أولاً.',
        { sector: 'cars' }
      );
    }

    // إذا الفرونت بعت جسم فاضي
    if (!req.body || !Object.keys(req.body).length) {
      return sendError(res, 400, 'NO_FIELDS_TO_UPDATE', 'لا يوجد أي حقل للتعديل');
    }

    const car = await updateCarListing({
      id: req.params.id,
      dealer_id,
      site_id,
      fields: req.body,
    });

    if (!car) return sendError(res, 404, 'CAR_NOT_FOUND', 'السيارة غير موجودة');
    return res.json({ success: true, car });
  } catch (err) {
    console.error('updateCar error:', err);
    const handled = pgErrorToResponse(res, err);
    if (handled) return handled;
    return sendError(res, 500, 'SERVER_ERROR', 'خطأ في السيرفر');
  }
};

exports.deleteCar = async (req, res) => {
  try {
    const dealer_id = req.user.id;

    const site_id = await requireCarsSiteId(dealer_id);
    if (!site_id) {
      return sendError(
        res,
        400,
        'NO_SITE_CARS',
        'لا يوجد موقع سيارات لهذا الحساب. أنشئ موقع cars أولاً.',
        { sector: 'cars' }
      );
    }

    const ok = await deleteCarListing({ id: req.params.id, dealer_id, site_id });
    if (!ok) return sendError(res, 404, 'CAR_NOT_FOUND', 'السيارة غير موجودة');

    return res.json({ success: true });
  } catch (err) {
    console.error('deleteCar error:', err);
    const handled = pgErrorToResponse(res, err);
    if (handled) return handled;
    return sendError(res, 500, 'SERVER_ERROR', 'خطأ في السيرفر');
  }
};
