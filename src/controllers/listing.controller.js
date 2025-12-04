// src/controllers/listing.controller.js
const {
  createListing,
  getListingsForDealer,
  updateListing,
  deleteListing,
} = require('../models/listing.model');

exports.listListings = async (req, res) => {
  try {
    const dealer_id = req.user.id; // حالياً نفس user.id

    const {
      status,
      type,
      search,
      city,
      page = 1,
      pageSize = 10,
    } = req.query;

    const result = await getListingsForDealer({
      dealer_id,
      status,
      type,
      search,
      city,
      page: Number(page),
      pageSize: Number(pageSize),
    });

    return res.json({
      success: true,
      ...result,
    });
  } catch (err) {
    console.error('listListings error:', err);
    return res.status(500).json({ success: false, message: 'خطأ في السيرفر' });
  }
};

exports.createListing = async (req, res) => {
  try {
    const dealer_id = req.user.id; // مؤقتاً

    const {
      type = 'property',
      title,
      description,
      price,
      currency,
      city,
      category,
      status,
      license_status,
      is_published,

      basic,
      details,
      location,
      features,
      guarantees,
      license,
      ad_info,
      contact,
      media,

      site_id,
    } = req.body;

    if (!type || !title) {
      return res.status(400).json({
        success: false,
        message: 'النوع والعنوان مطلوبان',
      });
    }

    // نبني JSON موحّد للتفاصيل
    const extraData = {
      basic: basic || {},
      details: details || {},
      location: location || {},
      features: features || {},
      guarantees: guarantees || '',
      license: license || {},
      ad_info: ad_info || {},
      contact: contact || {},
      media: media || [],
    };

    const listing = await createListing({
      dealer_id,
      site_id: site_id || null,
      type,
      title,
      description: description || (ad_info && ad_info.description) || null,
      price,
      currency,
      status,
      license_status,
      city,
      category,
      is_published,
      extraData,
    });

    return res.status(201).json({
      success: true,
      listing,
    });
  } catch (err) {
    console.error('createListing error:', err);
    return res.status(500).json({ success: false, message: 'خطأ في السيرفر' });
  }
};

exports.updateListing = async (req, res) => {
  try {
    const dealer_id = req.user.id;
    const { id } = req.params;

    const {
      // الحقول الأساسية
      title,
      description,
      price,
      currency,
      city,
      category,
      status,
      license_status,
      is_published,

      // نفس البلوكات اللي استخدمناها في createListing
      basic,
      details,
      location,
      features,
      guarantees,
      license,
      ad_info,
      contact,
      media,

      // لو حاب تبعت data جاهزة
      data,
    } = req.body;

    const fields = {};

    if (title !== undefined) fields.title = title;
    if (description !== undefined) fields.description = description;
    if (price !== undefined) fields.price = price;
    if (currency !== undefined) fields.currency = currency;
    if (city !== undefined) fields.city = city;
    if (category !== undefined) fields.category = category;
    if (status !== undefined) fields.status = status;
    if (license_status !== undefined) fields.license_status = license_status;
    if (is_published !== undefined) fields.is_published = is_published;

    // نبني الـ data من البلوكات لو مبعوثة
    let newData = data; // لو الفرونت أرسل data كاملة جاهزة

    // إذا ما أرسل data مباشرة، نبنيها من البلوكات
    if (!newData && (
      basic !== undefined ||
      details !== undefined ||
      location !== undefined ||
      features !== undefined ||
      guarantees !== undefined ||
      license !== undefined ||
      ad_info !== undefined ||
      contact !== undefined ||
      media !== undefined
    )) {
      newData = {
        ...(basic !== undefined && { basic }),
        ...(details !== undefined && { details }),
        ...(location !== undefined && { location }),
        ...(features !== undefined && { features }),
        ...(guarantees !== undefined && { guarantees }),
        ...(license !== undefined && { license }),
        ...(ad_info !== undefined && { ad_info }),
        ...(contact !== undefined && { contact }),
        ...(media !== undefined && { media }),
      };
    }

    if (newData !== undefined) {
      fields.data = newData;
    }

    if (Object.keys(fields).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'لا يوجد أي حقل للتعديل',
      });
    }

    const updated = await updateListing(id, dealer_id, fields);

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: 'الإعلان غير موجود',
      });
    }

    return res.json({
      success: true,
      listing: updated,
    });
  } catch (err) {
    console.error('updateListing error:', err);
    return res.status(500).json({ success: false, message: 'خطأ في السيرفر' });
  }
};

exports.deleteListing = async (req, res) => {
  try {
    const dealer_id = req.user.id;
    const { id } = req.params;

    const ok = await deleteListing(id, dealer_id);
    if (!ok) {
      return res.status(404).json({
        success: false,
        message: 'الإعلان غير موجود',
      });
    }

    return res.json({ success: true });
  } catch (err) {
    console.error('deleteListing error:', err);
    return res.status(500).json({ success: false, message: 'خطأ في السيرفر' });
  }
};
