const express = require('express');
const router = express.Router();
const c = require('../../controllers/public/listings.public.controller');

// /public/sites/:site_id/listings
router.get('/sites/:site_id/listings', c.searchListings);

// /public/sites/:site_id/listings/:listingId
router.get('/sites/:site_id/listings/:listingId', c.getListing);

module.exports = router;
