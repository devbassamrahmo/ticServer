// src/routes/listing.routes.js
const express = require('express');
const router = express.Router();
const listingController = require('../controllers/listing.controller');
const { authRequired } = require('../middleware/auth');

router.use(authRequired); // كل هالراوتات محمية

router.get('/', listingController.listListings);
router.post('/', listingController.createListing);
router.put('/:id', listingController.updateListing);
router.delete('/:id', listingController.deleteListing);

module.exports = router;
