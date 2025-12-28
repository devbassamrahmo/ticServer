const {
  createPropertyListing,
  createProjectListing,
  getPropertiesForDealer,
  getProjectsForDealer,
  updatePropertyListing,
  updateProjectListing,
  deleteListing,
  getPropertyById,
  getProjectById
} = require('../models/listing.model');

const { getSiteByOwner } = require('../models/site.model');
const { completeStep } = require('../models/onboarding.model');

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

  const images = Array.isArray(media) ? media : []; // ✅ مهم: model بيقرأ data.images

  return {
    basic: basic || {},
    details: details || {},
    location: location || {},

    // خليها Array
    features: Array.isArray(features) ? features : [],
    project_info: project_info || undefined,
    guarantees: guarantees || '',
    license: license || {},
    ad_info: ad_info || {},
    contact: contact || {},

    // ✅ نخزن الصور بالاسم اللي model متوقعه
    images,

    // اختياري: إذا بدك تضل محافظ على media
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
  res.status(400).json({
    success: false,
    message: 'لا يوجد موقع عقاري لهذا الحساب. أنشئ موقع realestate أولاً.',
  });

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
    return res.status(500).json({ success: false, message: 'خطأ في السيرفر' });
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

    if (!title) {
      return res.status(400).json({ success: false, message: 'العنوان مطلوب' });
    }

    const extraData = buildExtraDataFromBody(req.body);

    const listing = await createPropertyListing({
      dealer_id,
      site_id: site.id,
      title,
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

    try { await completeStep(dealer_id, 'first_listing'); } catch (_) {}
    return res.status(201).json({ success: true, listing });
  } catch (err) {
    if (err.message === 'NO_SITE') return noSiteResponse(res);
    console.error('createProperty error:', err);
    return res.status(500).json({ success: false, message: 'خطأ في السيرفر' });
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

    // data جاهزة؟
    let newData = data;

    // أو نبنيها من البلوكات
    if (
      newData === undefined &&
      (basic !== undefined || details !== undefined || location !== undefined ||
       features !== undefined || guarantees !== undefined || license !== undefined ||
       ad_info !== undefined || contact !== undefined || media !== undefined)
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
      return res.status(400).json({ success: false, message: 'لا يوجد أي حقل للتعديل' });
    }

    const updated = await updatePropertyListing(id, dealer_id, site.id, fields);
    if (!updated) {
      return res.status(404).json({ success: false, message: 'الإعلان غير موجود أو ليس عقار' });
    }

    return res.json({ success: true, listing: updated });
  } catch (err) {
    if (err.message === 'NO_SITE') return noSiteResponse(res);
    console.error('updateProperty error:', err);
    return res.status(500).json({ success: false, message: 'خطأ في السيرفر' });
  }
}

async function deleteProperty(req, res) {
  try {
    const dealer_id = req.user.id;
    const site = await requireRealestateSiteOrThrow(dealer_id);
    const { id } = req.params;

    const ok = await deleteListing(id, dealer_id, site.id);
    if (!ok) return res.status(404).json({ success: false, message: 'الإعلان غير موجود' });

    return res.json({ success: true });
  } catch (err) {
    if (err.message === 'NO_SITE') return noSiteResponse(res);
    console.error('deleteProperty error:', err);
    return res.status(500).json({ success: false, message: 'خطأ في السيرفر' });
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
    return res.status(500).json({ success: false, message: 'خطأ في السيرفر' });
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

    if (!title) {
      return res.status(400).json({ success: false, message: 'العنوان مطلوب' });
    }

    const extraData = buildExtraDataFromBody(req.body);

    const listing = await createProjectListing({
      dealer_id,
      site_id: site.id,
      title,
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

    try { await completeStep(dealer_id, 'first_listing'); } catch (_) {}
    return res.status(201).json({ success: true, listing });
  } catch (err) {
    if (err.message === 'NO_SITE') return noSiteResponse(res);
    console.error('createProject error:', err);
    return res.status(500).json({ success: false, message: 'خطأ في السيرفر' });
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
    if (data !== undefined) fields.data = data;

    if (!Object.keys(fields).length) {
      return res.status(400).json({ success: false, message: 'لا يوجد أي حقل للتعديل' });
    }

    const updated = await updateProjectListing(id, dealer_id, site.id, fields);
    if (!updated) {
      return res.status(404).json({ success: false, message: 'الإعلان غير موجود أو ليس مشروع' });
    }

    return res.json({ success: true, listing: updated });
  } catch (err) {
    if (err.message === 'NO_SITE') return noSiteResponse(res);
    console.error('updateProject error:', err);
    return res.status(500).json({ success: false, message: 'خطأ في السيرفر' });
  }
}

async function deleteProject(req, res) {
  try {
    const dealer_id = req.user.id;
    const site = await requireRealestateSiteOrThrow(dealer_id);
    const { id } = req.params;

    const ok = await deleteListing(id, dealer_id, site.id);
    if (!ok) return res.status(404).json({ success: false, message: 'الإعلان غير موجود' });

    return res.json({ success: true });
  } catch (err) {
    if (err.message === 'NO_SITE') return noSiteResponse(res);
    console.error('deleteProject error:', err);
    return res.status(500).json({ success: false, message: 'خطأ في السيرفر' });
  }
}

async function getMyProperty (req, res)  {
  try {
    const dealer_id = req.user.id;
    const { id } = req.params;

    const property = await getPropertyById(id, dealer_id);
    if (!property) {
      return res.status(404).json({ success: false, message: 'غير موجود' });
    }

    return res.json({ success: true, property });
  } catch (err) {
    console.error('getMyProperty error:', err);
    return res.status(500).json({ success: false, message: 'خطأ في السيرفر' });
  }
};

async function getMyProject (req, res) {
  try {
    const dealer_id = req.user.id;
    const { id } = req.params;

    const project = await getProjectById(id, dealer_id);
    if (!project) {
      return res.status(404).json({ success: false, message: 'غير موجود' });
    }

    return res.json({ success: true, project });
  } catch (err) {
    console.error('getMyProject error:', err);
    return res.status(500).json({ success: false, message: 'خطأ في السيرفر' });
  }
};
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
  getMyProject
};
