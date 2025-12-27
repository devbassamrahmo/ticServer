// src/controllers/listing.controller.js
const {
  createPropertyListing,
  createProjectListing,
  getPropertiesForDealer,
  getProjectsForDealer,
  updatePropertyListing,
  updateProjectListing,
  deleteListing,
  getPropertyById,
  getProjectById,
} = require('../models/listing.model');

const { getSiteByOwner } = require('../models/site.model');
const { completeStep } = require('../models/onboarding.model');
const { sendError } = require('../utils/httpError');

function buildExtraDataFromBody(body) {
  const {
    basic,
    details,
    location,
    features,
    guarantees,
    license,
    ad_info,
    contact,
    media, // الفرونت عم يبعت media
  } = body;

  const images = Array.isArray(media) ? media : []; // model بيقرأ data.images

  return {
    basic: basic || {},
    details: details || {},
    location: location || {},

    features: Array.isArray(features) ? features : [],

    guarantees: guarantees || '',
    license: license || {},
    ad_info: ad_info || {},
    contact: contact || {},

    images,
    media: images,
  };
}

async function requireRealestateSiteOrThrow(ownerId) {
  const site = await getSiteByOwner(ownerId, 'realestate');
  if (!site) {
    const err = new Error('NO_SITE');
    err.status = 400;
    throw err;
  }
  return site;
}

const noSiteResponse = (res) =>
  sendError(
    res,
    400,
    'NO_SITE_REALESTATE',
    'لا يوجد موقع عقاري لهذا الحساب. أنشئ موقع realestate أولاً.',
    { sector: 'realestate' }
  );

function pgErrorToResponse(res, err) {
  if (err && err.code === '23503') {
    return sendError(res, 400, 'INVALID_REFERENCE', 'مرجع غير صالح', { pg: err.code });
  }
  if (err && err.code === '22P02') {
    return sendError(res, 400, 'INVALID_INPUT', 'مدخلات غير صالحة', { pg: err.code });
  }
  return null;
}

/* =========================
   PROPERTIES
========================= */
async function listProperties(req, res) {
  try {
    const dealer_id = req.user.id;
    const site = await requireRealestateSiteOrThrow(dealer_id);

    const { status, search, city, page = 1, pageSize = 10 } = req.query;

    const result = await getPropertiesForDealer({
      dealer_id,
      site_id: site.id,
      status,
      search,
      city,
      page: Number(page),
      pageSize: Number(pageSize),
    });

    return res.json({ success: true, ...result });
  } catch (err) {
    if (err.message === 'NO_SITE') return noSiteResponse(res);
    console.error('listProperties error:', err);
    const handled = pgErrorToResponse(res, err);
    if (handled) return handled;
    return sendError(res, 500, 'SERVER_ERROR', 'خطأ في السيرفر');
  }
}

async function createProperty(req, res) {
  try {
    const dealer_id = req.user.id;
    const site = await requireRealestateSiteOrThrow(dealer_id);

    const {
      title,
      description,
      price,
      currency,
      city,
      category,
      status,
      license_status,
      is_published,
    } = req.body;

    if (!title || typeof title !== 'string' || !title.trim()) {
      return sendError(res, 400, 'VALIDATION_ERROR', 'العنوان مطلوب', { field: 'title' });
    }

    const extraData = buildExtraDataFromBody(req.body);

    const listing = await createPropertyListing({
      dealer_id,
      site_id: site.id,
      title: title.trim(),
      description: description || (req.body.ad_info && req.body.ad_info.description) || null,
      price,
      currency,
      status,
      license_status,
      city,
      category,
      is_published,
      extraData,
    });

    try {
      await completeStep(dealer_id, 'first_listing');
    } catch (_) {}

    return res.status(201).json({ success: true, listing });
  } catch (err) {
    if (err.message === 'NO_SITE') return noSiteResponse(res);
    console.error('createProperty error:', err);
    const handled = pgErrorToResponse(res, err);
    if (handled) return handled;
    return sendError(res, 500, 'SERVER_ERROR', 'خطأ في السيرفر');
  }
}

async function updateProperty(req, res) {
  try {
    const dealer_id = req.user.id;
    const site = await requireRealestateSiteOrThrow(dealer_id);
    const { id } = req.params;

    const {
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
      data,
    } = req.body || {};

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

    // data جاهزة؟
    let newData = data;

    // أو نبنيها من البلوكات
    if (
      newData === undefined &&
      (basic !== undefined ||
        details !== undefined ||
        location !== undefined ||
        features !== undefined ||
        guarantees !== undefined ||
        license !== undefined ||
        ad_info !== undefined ||
        contact !== undefined ||
        media !== undefined)
    ) {
      const images = Array.isArray(media) ? media : undefined;

      newData = {
        ...(basic !== undefined && { basic }),
        ...(details !== undefined && { details }),
        ...(location !== undefined && { location }),
        ...(features !== undefined && { features: Array.isArray(features) ? features : [] }),
        ...(guarantees !== undefined && { guarantees }),
        ...(license !== undefined && { license }),
        ...(ad_info !== undefined && { ad_info }),
        ...(contact !== undefined && { contact }),
        ...(images !== undefined && { images, media: images }),
      };
    }

    if (newData !== undefined) fields.data = newData;

    if (!Object.keys(fields).length) {
      return sendError(res, 400, 'NO_FIELDS_TO_UPDATE', 'لا يوجد أي حقل للتعديل');
    }

    const updated = await updatePropertyListing(id, dealer_id, site.id, fields);
    if (!updated) {
      return sendError(res, 404, 'LISTING_NOT_FOUND', 'الإعلان غير موجود أو ليس عقار');
    }

    return res.json({ success: true, listing: updated });
  } catch (err) {
    if (err.message === 'NO_SITE') return noSiteResponse(res);
    console.error('updateProperty error:', err);
    const handled = pgErrorToResponse(res, err);
    if (handled) return handled;
    return sendError(res, 500, 'SERVER_ERROR', 'خطأ في السيرفر');
  }
}

async function deleteProperty(req, res) {
  try {
    const dealer_id = req.user.id;
    const site = await requireRealestateSiteOrThrow(dealer_id);
    const { id } = req.params;

    const ok = await deleteListing(id, dealer_id, site.id);
    if (!ok) return sendError(res, 404, 'LISTING_NOT_FOUND', 'الإعلان غير موجود');

    return res.json({ success: true });
  } catch (err) {
    if (err.message === 'NO_SITE') return noSiteResponse(res);
    console.error('deleteProperty error:', err);
    const handled = pgErrorToResponse(res, err);
    if (handled) return handled;
    return sendError(res, 500, 'SERVER_ERROR', 'خطأ في السيرفر');
  }
}

/* =========================
   PROJECTS
========================= */
async function listProjects(req, res) {
  try {
    const dealer_id = req.user.id;
    const site = await requireRealestateSiteOrThrow(dealer_id);

    const { status, search, city, page = 1, pageSize = 10 } = req.query;

    const result = await getProjectsForDealer({
      dealer_id,
      site_id: site.id,
      status,
      search,
      city,
      page: Number(page),
      pageSize: Number(pageSize),
    });

    return res.json({ success: true, ...result });
  } catch (err) {
    if (err.message === 'NO_SITE') return noSiteResponse(res);
    console.error('listProjects error:', err);
    const handled = pgErrorToResponse(res, err);
    if (handled) return handled;
    return sendError(res, 500, 'SERVER_ERROR', 'خطأ في السيرفر');
  }
}

async function createProject(req, res) {
  try {
    const dealer_id = req.user.id;
    const site = await requireRealestateSiteOrThrow(dealer_id);

    const {
      title,
      description,
      price,
      currency,
      city,
      category,
      status,
      license_status,
      is_published,
    } = req.body;

    if (!title || typeof title !== 'string' || !title.trim()) {
      return sendError(res, 400, 'VALIDATION_ERROR', 'العنوان مطلوب', { field: 'title' });
    }

    const extraData = buildExtraDataFromBody(req.body);

    const listing = await createProjectListing({
      dealer_id,
      site_id: site.id,
      title: title.trim(),
      description: description || (req.body.ad_info && req.body.ad_info.description) || null,
      price,
      currency,
      status,
      license_status,
      city,
      category,
      is_published,
      extraData,
    });

    try {
      await completeStep(dealer_id, 'first_listing');
    } catch (_) {}

    return res.status(201).json({ success: true, listing });
  } catch (err) {
    if (err.message === 'NO_SITE') return noSiteResponse(res);
    console.error('createProject error:', err);
    const handled = pgErrorToResponse(res, err);
    if (handled) return handled;
    return sendError(res, 500, 'SERVER_ERROR', 'خطأ في السيرفر');
  }
}

async function updateProject(req, res) {
  try {
    const dealer_id = req.user.id;
    const site = await requireRealestateSiteOrThrow(dealer_id);
    const { id } = req.params;

    const {
      title,
      description,
      price,
      currency,
      city,
      category,
      status,
      license_status,
      is_published,
      data,
    } = req.body || {};

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
    if (data !== undefined) fields.data = data;

    if (!Object.keys(fields).length) {
      return sendError(res, 400, 'NO_FIELDS_TO_UPDATE', 'لا يوجد أي حقل للتعديل');
    }

    const updated = await updateProjectListing(id, dealer_id, site.id, fields);
    if (!updated) {
      return sendError(res, 404, 'LISTING_NOT_FOUND', 'الإعلان غير موجود أو ليس مشروع');
    }

    return res.json({ success: true, listing: updated });
  } catch (err) {
    if (err.message === 'NO_SITE') return noSiteResponse(res);
    console.error('updateProject error:', err);
    const handled = pgErrorToResponse(res, err);
    if (handled) return handled;
    return sendError(res, 500, 'SERVER_ERROR', 'خطأ في السيرفر');
  }
}

async function deleteProject(req, res) {
  try {
    const dealer_id = req.user.id;
    const site = await requireRealestateSiteOrThrow(dealer_id);
    const { id } = req.params;

    const ok = await deleteListing(id, dealer_id, site.id);
    if (!ok) return sendError(res, 404, 'LISTING_NOT_FOUND', 'الإعلان غير موجود');

    return res.json({ success: true });
  } catch (err) {
    if (err.message === 'NO_SITE') return noSiteResponse(res);
    console.error('deleteProject error:', err);
    const handled = pgErrorToResponse(res, err);
    if (handled) return handled;
    return sendError(res, 500, 'SERVER_ERROR', 'خطأ في السيرفر');
  }
}

/* =========================
   Single item (My dashboard)
========================= */
async function getMyProperty(req, res) {
  try {
    const dealer_id = req.user.id;
    const { id } = req.params;

    const property = await getPropertyById(id, dealer_id);
    if (!property) {
      return sendError(res, 404, 'LISTING_NOT_FOUND', 'غير موجود');
    }

    return res.json({ success: true, property });
  } catch (err) {
    console.error('getMyProperty error:', err);
    const handled = pgErrorToResponse(res, err);
    if (handled) return handled;
    return sendError(res, 500, 'SERVER_ERROR', 'خطأ في السيرفر');
  }
}

async function getMyProject(req, res) {
  try {
    const dealer_id = req.user.id;
    const { id } = req.params;

    const project = await getProjectById(id, dealer_id);
    if (!project) {
      return sendError(res, 404, 'LISTING_NOT_FOUND', 'غير موجود');
    }

    return res.json({ success: true, project });
  } catch (err) {
    console.error('getMyProject error:', err);
    const handled = pgErrorToResponse(res, err);
    if (handled) return handled;
    return sendError(res, 500, 'SERVER_ERROR', 'خطأ في السيرفر');
  }
}

module.exports = {
  listProperties,
  createProperty,
  updateProperty,
  deleteProperty,
  listProjects,
  createProject,
  updateProject,
  deleteProject,
  getMyProperty,
  getMyProject,
};
