// src/controllers/dashboard.controller.js
const {
  getDashboardSummary,
  getVisitsTimeseries,
  getTopItems,
} = require('../models/dashboard.model');

exports.getSummary = async (req, res) => {
  try {
    const dealer_id = req.user.id;
    const { from, to } = req.query;

    const data = await getDashboardSummary(dealer_id, { from, to });

    return res.json({
      success: true,
      summary: data,
    });
  } catch (err) {
    console.error('getSummary error:', err);
    return res.status(500).json({ success: false, message: 'خطأ في السيرفر' });
  }
};

exports.getVisits = async (req, res) => {
  try {
    const dealer_id = req.user.id;
    const { from, to } = req.query;

    const data = await getVisitsTimeseries(dealer_id, { from, to });

    return res.json({
      success: true,
      ...data,
    });
  } catch (err) {
    console.error('getVisits error:', err);
    return res.status(500).json({ success: false, message: 'خطأ في السيرفر' });
  }
};

// ✅ خلي اسمها getTopListings كرمال ما تغيّر routes/فرونت
exports.getTopListings = async (req, res) => {
  try {
    const dealer_id = req.user.id;
    const { from, to, limit } = req.query;

    const lim = limit ? Number(limit) : 10;

    const data = await getTopItems(dealer_id, lim, { from, to });

    return res.json({
      success: true,
      ...data,
    });
  } catch (err) {
    console.error('getTopListings error:', err);
    return res.status(500).json({ success: false, message: 'خطأ في السيرفر' });
  }
};
