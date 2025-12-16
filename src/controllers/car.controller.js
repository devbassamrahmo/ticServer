const {
  createCarListing,
  getCarsForSite,
  getCarById,
  updateCarListing,
  deleteCarListing,
} = require('../models/car.model');

const { requireOwnerSite } = require('../models/site.model');

async function requireCarsSiteId(ownerId) {
  const site = await requireOwnerSite(ownerId, 'cars');
  return site ? site.id : null;
}

exports.createCar = async (req, res) => {
  try {
    const dealer_id = req.user.id;

    const site_id = await requireCarsSiteId(dealer_id);
    if (!site_id) {
      return res.status(400).json({ success: false, message: 'لا يوجد موقع سيارات لهذا الحساب' });
    }

    const car = await createCarListing({ dealer_id, site_id, data: req.body });
    return res.status(201).json({ success: true, car });
  } catch (err) {
    console.error('createCar error:', err);
    return res.status(500).json({ success: false, message: 'خطأ في السيرفر' });
  }
};

exports.getMyCars = async (req, res) => {
  try {
    const dealer_id = req.user.id;

    const site_id = await requireCarsSiteId(dealer_id);
    if (!site_id) {
      return res.status(400).json({ success: false, message: 'لا يوجد موقع سيارات لهذا الحساب' });
    }

    const data = await getCarsForSite({
      dealer_id,
      site_id,
      page: Number(req.query.page || 1),
      pageSize: Number(req.query.pageSize || 10),
    });

    return res.json({ success: true, ...data });
  } catch (err) {
    console.error('getMyCars error:', err);
    return res.status(500).json({ success: false, message: 'خطأ في السيرفر' });
  }
};

exports.getCar = async (req, res) => {
  try {
    const dealer_id = req.user.id;

    const site_id = await requireCarsSiteId(dealer_id);
    if (!site_id) {
      return res.status(400).json({ success: false, message: 'لا يوجد موقع سيارات لهذا الحساب' });
    }

    const car = await getCarById({ id: req.params.id, dealer_id, site_id });
    if (!car) return res.status(404).json({ success: false, message: 'غير موجود' });

    return res.json({ success: true, car });
  } catch (err) {
    console.error('getCar error:', err);
    return res.status(500).json({ success: false, message: 'خطأ في السيرفر' });
  }
};

exports.updateCar = async (req, res) => {
  try {
    const dealer_id = req.user.id;

    const site_id = await requireCarsSiteId(dealer_id);
    if (!site_id) {
      return res.status(400).json({ success: false, message: 'لا يوجد موقع سيارات لهذا الحساب' });
    }

    const car = await updateCarListing({
      id: req.params.id,
      dealer_id,
      site_id,
      fields: req.body,
    });

    if (!car) return res.status(404).json({ success: false, message: 'غير موجود' });
    return res.json({ success: true, car });
  } catch (err) {
    console.error('updateCar error:', err);
    return res.status(500).json({ success: false, message: 'خطأ في السيرفر' });
  }
};

exports.deleteCar = async (req, res) => {
  try {
    const dealer_id = req.user.id;

    const site_id = await requireCarsSiteId(dealer_id);
    if (!site_id) {
      return res.status(400).json({ success: false, message: 'لا يوجد موقع سيارات لهذا الحساب' });
    }

    const ok = await deleteCarListing({ id: req.params.id, dealer_id, site_id });
    return res.json({ success: ok });
  } catch (err) {
    console.error('deleteCar error:', err);
    return res.status(500).json({ success: false, message: 'خطأ في السيرفر' });
  }
};
