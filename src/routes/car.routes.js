const express = require('express');
const router = express.Router();
const carController = require('../controllers/car.controller');
const { authRequired } = require('../middleware/auth');

router.use(authRequired);

router.post('/', carController.createCar);
router.get('/', carController.getMyCars);
router.get('/:id', carController.getCar);
router.put('/:id', carController.updateCar);
router.delete('/:id', carController.deleteCar);

module.exports = router;
