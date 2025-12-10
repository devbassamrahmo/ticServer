// src/routes/dev.routes.js
const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');

// GET /api/dev/supabase
router.get('/supabase', async (req, res) => {
  try {
    
    const { data, error } = await supabase.storage.listBuckets();

    if (error) {
      console.error('Supabase listBuckets error:', error);
      return res.status(500).json({
        success: false,
        message: 'Supabase connection error',
        error: error.message,
      });
    }

    return res.json({
      success: true,
      buckets: data, // رح تشوف أسماء البكتس اللي عملتهم: listing-images, site-branding, documents...
    });
  } catch (err) {
    console.error('Supabase test error:', err);
    return res.status(500).json({
      success: false,
      message: 'Server error while testing Supabase',
    });
  }
});

module.exports = router;
