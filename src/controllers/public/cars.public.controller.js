const {
  searchPublicCarsForSiteAdvanced,
  getPublicCarByIdForSite,
  getSimilarPublicCarsForSite,
} = require('../../models/car.model');

exports.searchCars = async (req, res) => {
  try {
    const { site_id } = req.params;

    const data = await searchPublicCarsForSiteAdvanced(site_id, req.query, {
      page: req.query.page,
      pageSize: req.query.pageSize,
    });

    return res.json({ success: true, ...data });
  } catch (err) {
    console.error('public searchCars error:', err);
    return res.status(500).json({ success: false, message: 'خطأ في السيرفر' });
  }
};

exports.getCar = async (req, res) => {
  try {
    const { site_id, carId } = req.params;

    const car = await getPublicCarByIdForSite(site_id, carId);
    if (!car) return res.status(404).json({ success: false, message: 'غير موجود' });

    const similar = await getSimilarPublicCarsForSite(site_id, carId, { limit: 6 });

    return res.json({ success: true, car, similar });
  } catch (err) {
    console.error('public getCar error:', err);
    return res.status(500).json({ success: false, message: 'خطأ في السيرفر' });
  }
};
