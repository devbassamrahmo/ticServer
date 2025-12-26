const express = require('express');
const router = express.Router();
const c = require('../../controllers/public/cars.public.controller');

// /public/sites/:site_id/cars
router.get('/sites/:site_id/cars', c.searchCars);

// /public/sites/:site_id/cars/:carId
router.get('/sites/:site_id/cars/:carId', c.getCar);

module.exports = router;
