// src/controllers/site.controller.js
const {
  getSiteByOwner,
  getSiteBySlug,
  getSiteConfigBySlug,
  upsertSiteForOwner,
  upsertSiteBasic,
  upsertSiteTheme,
  upsertSiteSettings,
  setSitePublish,
  upsertSiteTemplate,
  updateSiteAll,
} = require('../models/site.model');

const {
  getFeaturedListingsForSite,
  searchPublicListingsForSite,
  getPublicListingByIdForSite,
} = require('../models/listing.model');

const {
  getFeaturedCarsForSite,
  searchPublicCarsForSite,
  getPublicCarByIdForSite,
} = require('../models/car.model');

const { completeStep } = require('../models/onboarding.model');

function buildTheme(colors, fonts) {
  return { colors: colors || {}, fonts: fonts || {} };
}

function buildSettings(branding, social, location, about) {
  return {
    branding: branding || {},
    social: social || {},
    location: location || {},
    about: about || {},
  };
}

async function loadRealEstateSiteOr404(slug, res) {
  const site = await getSiteBySlug(slug);
  if (!site || !site.is_published || site.sector !== 'realestate') {
    res.status(404).json({ success: false, message: 'الموقع غير موجود أو غير منشور' });
    return null;
  }
  return site;
}

async function loadCarsSiteOr404(slug, res) {
  const site = await getSiteBySlug(slug);
  if (!site || !site.is_published || site.sector !== 'cars') {
    res.status(404).json({ success: false, message: 'الموقع غير موجود أو غير منشور' });
    return null;
  }
  return site;
}

// GET /api/site?sector=cars|realestate
async function getMySite(req, res) {
  try {
    const ownerId = req.user.id;
    const sector = req.query.sector || 'cars';
    const site = await getSiteByOwner(ownerId, sector);
    return res.json({ success: true, site });
  } catch (err) {
    console.error('getMySite error:', err);
    return res.status(500).json({ success: false, message: 'خطأ في السيرفر' });
  }
}

// POST /api/site
async function upsertMySite(req, res) {
  try {
    const ownerId = req.user.id;
    const {
      sector,
      slug,
      name,
      template_key,
      colors,
      fonts,
      branding,
      social,
      location,
      about,
      is_published,
    } = req.body;

    if (!sector || !slug || !template_key) {
      return res.status(400).json({ success: false, message: 'sector و slug و template_key مطلوبة' });
    }

    try {
      const site = await upsertSiteForOwner(ownerId, {
        sector,
        slug,
        name,
        template_key,
        theme: buildTheme(colors, fonts),
        settings: buildSettings(branding, social, location, about),
        is_published,
      });

      try {
        await completeStep(ownerId, 'site_setup');
        if (is_published) await completeStep(ownerId, 'publish_site');
      } catch (e) {
        console.error('completeStep error:', e.message);
      }

      return res.json({ success: true, site });
    } catch (err) {
      if (err.message === 'INVALID_TEMPLATE') {
        return res.status(400).json({ success: false, message: 'template_key غير صالح' });
      }
      if (err.code === '23505') {
        return res.status(400).json({ success: false, message: 'هذا الرابط مستخدم لموقع آخر، اختر slug آخر' });
      }
      console.error('upsertMySite error:', err);
      return res.status(500).json({ success: false, message: 'خطأ في السيرفر' });
    }
  } catch (err) {
    console.error('upsertMySite outer error:', err);
    return res.status(500).json({ success: false, message: 'خطأ في السيرفر' });
  }
}

// GET /api/site/public/:slug
async function getPublicSiteConfig(req, res) {
  try {
    const { slug } = req.params;
    const site = await getSiteConfigBySlug(slug, { requirePublished: true });
    if (!site) return res.status(404).json({ success:false, message:'الموقع غير موجود أو غير منشور' });
    return res.json({ success: true, site });
  } catch (err) {
    console.error('getPublicSiteConfig error:', err);
    return res.status(500).json({ success:false, message:'خطأ في السيرفر' });
  }
}

// GET /api/site/check-slug?slug=xxx
async function checkSlug(req, res) {
  try {
    const { slug } = req.query;
    if (!slug || typeof slug !== 'string' || slug.length < 3) {
      return res.status(400).json({ success: false, message: 'slug غير صالح (3 أحرف على الأقل)' });
    }
    const site = await getSiteBySlug(slug);
    return res.json({ success: true, slug, available: !site });
  } catch (err) {
    console.error('checkSlug error:', err);
    return res.status(500).json({ success: false, message: 'خطأ في السيرفر' });
  }
}

// ===== REAL ESTATE PUBLIC (by site_id) =====

// GET /api/site/public/:slug/listings/featured?limit=6
async function getFeaturedRealestateForSite(req, res) {
  try {
    const { slug } = req.params;
    const { limit } = req.query;

    const site = await loadRealEstateSiteOr404(slug, res);
    if (!site) return;

    const items = await getFeaturedListingsForSite(site.id, { limit: limit ? Number(limit) : 6 });
    return res.json({ success: true, items });
  } catch (err) {
    console.error('getFeaturedRealestateForSite error:', err);
    return res.status(500).json({ success: false, message: 'خطأ في السيرفر' });
  }
}

// GET /api/site/public/:slug/listings/search?page=1&pageSize=12
async function searchRealestateForSite(req, res) {
  try {
    const { slug } = req.params;

    const site = await loadRealEstateSiteOr404(slug, res);
    if (!site) return;

    const result = await searchPublicListingsForSite(site.id, req.query, {
      page: req.query.page,
      pageSize: req.query.pageSize,
    });

    return res.json({ success: true, ...result });
  } catch (err) {
    console.error('searchRealestateForSite error:', err);
    return res.status(500).json({ success: false, message: 'خطأ في السيرفر' });
  }
}

// GET /api/site/public/:slug/listings/:listingId
async function getRealestateDetailsForSite(req, res) {
  try {
    const { slug, listingId } = req.params;

    const site = await loadRealEstateSiteOr404(slug, res);
    if (!site) return;

    const listing = await getPublicListingByIdForSite(site.id, listingId);
    if (!listing) return res.status(404).json({ success:false, message:'العقار غير موجود' });

    return res.json({ success: true, listing });
  } catch (err) {
    console.error('getRealestateDetailsForSite error:', err);
    return res.status(500).json({ success:false, message:'خطأ في السيرفر' });
  }
}

// ===== CARS PUBLIC (by site_id) =====

// GET /api/site/public/:slug/cars/featured?limit=6
async function getFeaturedCarsForPublicSite(req, res) {
  try {
    const { slug } = req.params;
    const { limit } = req.query;

    const site = await loadCarsSiteOr404(slug, res);
    if (!site) return;

    const items = await getFeaturedCarsForSite(site.id, { limit: limit ? Number(limit) : 6 });
    return res.json({ success:true, items });
  } catch (err) {
    console.error('getFeaturedCarsForPublicSite error:', err);
    return res.status(500).json({ success:false, message:'خطأ في السيرفر' });
  }
}

// GET /api/site/public/:slug/cars?page=1&pageSize=12
async function searchCarsForSite(req, res) {
  try {
    const { slug } = req.params;

    const site = await loadCarsSiteOr404(slug, res);
    if (!site) return;

    const result = await searchPublicCarsForSite(site.id, {
      page: req.query.page,
      pageSize: req.query.pageSize,
    });

    return res.json({ success:true, ...result });
  } catch (err) {
    console.error('searchCarsForSite error:', err);
    return res.status(500).json({ success:false, message:'خطأ في السيرفر' });
  }
}

// GET /api/site/public/:slug/cars/:carId
async function getCarDetailsForSite(req, res) {
  try {
    const { slug, carId } = req.params;

    const site = await loadCarsSiteOr404(slug, res);
    if (!site) return;

    const car = await getPublicCarByIdForSite(site.id, carId);
    if (!car) return res.status(404).json({ success:false, message:'السيارة غير موجودة' });

    return res.json({ success:true, car });
  } catch (err) {
    console.error('getCarDetailsForSite error:', err);
    return res.status(500).json({ success:false, message:'خطأ في السيرفر' });
  }
}

// PATCH /api/site/basic
async function updateMySiteBasic(req, res) {
  try {
    const ownerId = req.user.id;
    const { sector, slug, name, template_key } = req.body;
    if (!sector || !slug || !template_key) {
      return res.status(400).json({ success:false, message:'sector و slug و template_key مطلوبة' });
    }
    const site = await upsertSiteBasic(ownerId, { sector, slug, name, template_key });
    return res.json({ success:true, site });
  } catch (err) {
    if (err.message === 'INVALID_TEMPLATE') return res.status(400).json({ success:false, message:'template_key غير صالح' });
    if (err.code === '23505') return res.status(400).json({ success:false, message:'هذا الرابط مستخدم لموقع آخر' });
    console.error('updateMySiteBasic error:', err);
    return res.status(500).json({ success:false, message:'خطأ في السيرفر' });
  }
}

// PATCH /api/site/theme
async function updateMySiteTheme(req, res) {
  try {
    const ownerId = req.user.id;
    const { sector, colors, fonts } = req.body;
    if (!sector) return res.status(400).json({ success:false, message:'sector مطلوب' });

    const site = await upsertSiteTheme(ownerId, { sector, colors: colors||{}, fonts: fonts||{} });
    return res.json({ success:true, site });
  } catch (err) {
    console.error('updateMySiteTheme error:', err);
    return res.status(500).json({ success:false, message:'خطأ في السيرفر' });
  }
}

// PATCH /api/site/settings
async function updateMySiteSettings(req, res) {
  try {
    const ownerId = req.user.id;

    const { sector, slug, name, branding, social, location, about } = req.body;
    if (!sector) return res.status(400).json({ success:false, message:'sector مطلوب' });
    if (!slug)   return res.status(400).json({ success:false, message:'slug مطلوب' });

    const site = await upsertSiteSettings(ownerId, {
      sector,
      slug,
      name,
      branding: branding || {},
      social: social || {},
      location: location || {},
      about: about || {},
    });

    if (!site) {
      return res.status(400).json({
        success: false,
        message: 'لا يوجد موقع لهذا القطاع. اختر template أولاً عبر POST /api/site/template',
      });
    }

    return res.json({ success:true, site });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ success:false, message:'هذا الرابط مستخدم لموقع آخر' });
    }
    console.error('updateMySiteSettings error:', err);
    return res.status(500).json({ success:false, message:'خطأ في السيرفر' });
  }
}

// PATCH /api/site/publish
async function setPublishState(req, res) {
  try {
    const ownerId = req.user.id;
    const { sector, is_published } = req.body;
    if (!sector) return res.status(400).json({ success:false, message:'sector مطلوب' });

    const site = await setSitePublish(ownerId, { sector, is_published });
    if (!site) return res.status(404).json({ success:false, message:'الموقع غير موجود' });

    return res.json({ success:true, site });
  } catch (err) {
    console.error('setPublishState error:', err);
    return res.status(500).json({ success:false, message:'خطأ في السيرفر' });
  }
}

// PUT /api/site
async function updateMySiteAll(req, res) {
  try {
    const ownerId = req.user.id;
    const { sector, slug, name, template_key, is_published, theme, settings } = req.body;
    if (!sector) return res.status(400).json({ success:false, message:'sector مطلوب' });

    const site = await updateSiteAll(ownerId, { sector, slug, name, template_key, is_published, theme, settings });
    if (!site) return res.status(404).json({ success:false, message:'الموقع غير موجود' });

    return res.json({ success:true, site });
  } catch (err) {
    if (err.message === 'INVALID_TEMPLATE') return res.status(400).json({ success:false, message:'template_key غير صالح' });
    if (err.code === '23505') return res.status(400).json({ success:false, message:'هذا الرابط مستخدم لموقع آخر' });
    console.error('updateMySiteAll error:', err);
    return res.status(500).json({ success:false, message:'خطأ في السيرفر' });
  }
}

// POST /api/site/template
async function setTemplateStep(req, res) {
  try {
    const ownerId = req.user.id;
    const { sector, template_key } = req.body;
    if (!sector || !template_key) return res.status(400).json({ success:false, message:'sector و template_key مطلوبة' });

    const site = await upsertSiteTemplate(ownerId, { sector, template_key });
    return res.json({ success:true, site });
  } catch (err) {
    if (err.message === 'INVALID_TEMPLATE') return res.status(400).json({ success:false, message:'template_key غير صالح' });
    console.error('setTemplateStep error:', err);
    return res.status(500).json({ success:false, message:'خطأ في السيرفر' });
  }
}

module.exports = {
  getMySite,
  upsertMySite,
  getPublicSiteConfig,
  checkSlug,

  // public realestate
  getFeaturedRealestateForSite,
  searchRealestateForSite,
  getRealestateDetailsForSite,

  // public cars
  getFeaturedCarsForPublicSite,
  searchCarsForSite,
  getCarDetailsForSite,

  // private site updates
  updateMySiteBasic,
  updateMySiteTheme,
  updateMySiteSettings,
  setPublishState,
  updateMySiteAll,
  setTemplateStep,
};
