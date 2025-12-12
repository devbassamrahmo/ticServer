const {
  createCarListing,
  getCars,
  getCarById,
  updateCarListing,
  deleteCarListing
} = require('../models/car.model');

exports.createCar = async (req, res) => {
  console.log(req.body)
  try {
    const dealerId = req.user.id;
    const car = await createCarListing(dealerId, req.body);

    return res.status(201).json({
      success: true,
      car
    });
  } catch (err) {
    console.error('createCar error:', err);
    return res.status(500).json({ success: false });
  }
};

exports.getMyCars = async (req, res) => {
  try {
    const dealerId = req.user.id;
    const data = await getCars(dealerId, req.query);

    return res.json({ success: true, ...data });
  } catch (err) {
    console.error('getMyCars error:', err);
    return res.status(500).json({ success: false });
  }
};

exports.getCar = async (req, res) => {
  try {
    const dealerId = req.user.id;
    const car = await getCarById(req.params.id, dealerId);

    if (!car) {
      return res.status(404).json({ success: false, message: 'غير موجود' });
    }

    return res.json({ success: true, car });
  } catch (err) {
    console.error('getCar error:', err);
    return res.status(500).json({ success: false });
  }
};

exports.updateCar = async (req, res) => {
  try {
    const dealerId = req.user.id;
    const car = await updateCarListing(req.params.id, dealerId, req.body);

    if (!car) {
      return res.status(404).json({ success: false, message: 'غير موجود' });
    }

    return res.json({ success: true, car });
  } catch (err) {
    console.error('updateCar error:', err);
    return res.status(500).json({ success: false });
  }
};

exports.deleteCar = async (req, res) => {
  try {
    const dealerId = req.user.id;
    const ok = await deleteCarListing(req.params.id, dealerId);

    return res.json({ success: ok });
  } catch (err) {
    console.error('deleteCar error:', err);
    return res.status(500).json({ success: false });
  }
};
