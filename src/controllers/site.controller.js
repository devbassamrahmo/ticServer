// src/controllers/site.controller.js
const {
  getSiteByOwner,
  upsertSiteForOwner,
  getSiteBySlug,
  upsertSiteBasic,
  upsertSiteTheme,
  upsertSiteSettings,
  setSitePublish,
} = require('../models/site.model');
const {
  getFeaturedListingsForDealer,
  searchPublicListings,
  getPublicListingById,
} = require('../models/listing.model');
const { completeStep } = require('../models/onboarding.model');

function buildTheme(colors, fonts) {
  return {
    colors: colors || {},
    fonts: fonts || {},
  };
}

function buildSettings(branding, social, location) {
  return {
    branding: branding || {},
    social: social || {},
    location: location || {},
  };
}

async function loadRealEstateSiteOr404(slug, res) {
  const site = await getSiteBySlug(slug);
  if (!site || !site.is_published || site.sector !== 'realestate') {
    res.status(404).json({
      success: false,
      message: 'الموقع غير موجود أو غير منشور',
    });
    return null;
  }
  return site;
}

// GET /api/site?sector=cars
exports.getMySite = async (req, res) => {
  try {
    const ownerId = req.user.id;
    const sector = req.query.sector || 'cars'; // default

    const site = await getSiteByOwner(ownerId, sector);

    return res.json({
      success: true,
      site,
    });
  } catch (err) {
    console.error('getMySite error:', err);
    return res.status(500).json({ success: false, message: 'خطأ في السيرفر' });
  }
};

// POST /api/site
exports.upsertMySite = async (req, res) => {
  try {
    const ownerId = req.user.id;
    const {
      sector,          // "cars" | "realestate"
      slug,            // ex: "alabdli"
      name,            // اسم الموقع
      template_key,    // carClassic, ...
      colors,
      fonts,
      branding,
      social,
      location,
      is_published,
    } = req.body;

    if (!sector || !slug || !template_key) {
      return res.status(400).json({
        success: false,
        message: 'sector و slug و template_key مطلوبة',
      });
    }

    try {
      const site = await upsertSiteForOwner(ownerId, {
        sector,
        slug,
        name,
        template_key,
        theme: buildTheme(colors, fonts),
        settings: buildSettings(branding, social, location),
        is_published,
      });

      // خطوة onboarding: site_setup
      try {
        await completeStep(ownerId, 'site_setup');

        if (is_published) {
          await completeStep(ownerId, 'publish_site');
        }
      } catch (e) {
        console.error('completeStep(site_setup/publish_site) error:', e.message);
      }

      return res.json({
        success: true,
        site,
      });
    } catch (err) {
      if (err.message === 'INVALID_TEMPLATE') {
        return res.status(400).json({
          success: false,
          message: 'template_key غير صالح',
        });
      }
      // duplicate slug
      if (err.code === '23505') {
        return res.status(400).json({
          success: false,
          message: 'هذا الرابط مستخدم لموقع آخر، الرجاء اختيار slug آخر',
        });
      }

      console.error('upsertMySite error:', err);
      return res
        .status(500)
        .json({ success: false, message: 'خطأ في السيرفر' });
    }
  } catch (err) {
    console.error('upsertMySite outer error:', err);
    return res.status(500).json({ success: false, message: 'خطأ في السيرفر' });
  }
};

// GET /api/site/public/:slug
exports.getPublicSiteConfig = async (req, res) => {
  try {
    const { slug } = req.params;
    const site = await getSiteBySlug(slug);

    if (!site || !site.is_published) {
      return res.status(404).json({
        success: false,
        message: 'الموقع غير موجود أو غير منشور',
      });
    }

    return res.json({
      success: true,
      site,
    });
  } catch (err) {
    console.error('getPublicSiteConfig error:', err);
    return res.status(500).json({ success: false, message: 'خطأ في السيرفر' });
  }
};

exports.checkSlug = async (req, res) => {
  try {
    const { slug } = req.query;

    if (!slug || typeof slug !== 'string' || slug.length < 3) {
      return res.status(400).json({
        success: false,
        message: 'slug غير صالح (يجب أن يكون 3 أحرف على الأقل)',
      });
    }

    const site = await getSiteBySlug(slug);

    return res.json({
      success: true,
      slug,
      available: !site, // true = متاح
    });
  } catch (err) {
    console.error('checkSlug error:', err);
    return res.status(500).json({ success: false, message: 'خطأ في السيرفر' });
  }
};

// GET /api/site/public/:slug/listings/featured?limit=6
exports.getFeaturedRealestateForSite = async (req, res) => {
  try {
    const { slug } = req.params;
    const { limit } = req.query;

    const site = await loadRealEstateSiteOr404(slug, res);
    if (!site) return;

    const listings = await getFeaturedListingsForDealer(site.owner_id, {
      limit: limit ? Number(limit) : 6,
    });

    return res.json({
      success: true,
      items: listings,
    });
  } catch (err) {
    console.error('getFeaturedRealestateForSite error:', err);
    return res.status(500).json({ success: false, message: 'خطأ في السيرفر' });
  }
};

// GET /api/site/public/:slug/listings/search?city=...&min_price=...
exports.searchRealestateForSite = async (req, res) => {
  try {
    const { slug } = req.params;

    const site = await loadRealEstateSiteOr404(slug, res);
    if (!site) return;

    const {
      city,
      district,
      purpose,
      property_type,
      min_rooms,
      max_rooms,
      min_area,
      max_area,
      min_price,
      max_price,
      min_age,
      max_age,
      page,
      pageSize,
    } = req.query;

    const result = await searchPublicListings(
      site.owner_id,
      {
        city,
        district,
        purpose,
        property_type,
        min_rooms,
        max_rooms,
        min_area,
        max_area,
        min_price,
        max_price,
        min_age,
        max_age,
      },
      { page, pageSize }
    );

    return res.json({
      success: true,
      ...result,
    });
  } catch (err) {
    console.error('searchRealestateForSite error:', err);
    return res.status(500).json({ success: false, message: 'خطأ في السيرفر' });
  }
};

// GET /api/site/public/:slug/listings/:listingId
exports.getRealestateDetailsForSite = async (req, res) => {
  try {
    const { slug, listingId } = req.params;

    const site = await loadRealEstateSiteOr404(slug, res);
    if (!site) return;

    const listing = await getPublicListingById(site.owner_id, listingId);

    if (!listing) {
      return res.status(404).json({
        success: false,
        message: 'العقار غير موجود',
      });
    }

    return res.json({
      success: true,
      listing,
    });
  } catch (err) {
    console.error('getRealestateDetailsForSite error:', err);
    return res.status(500).json({ success: false, message: 'خطأ في السيرفر' });
  }
};

exports.updateMySiteBasic = async (req, res) => {
  try {
    const ownerId = req.user.id;
    const { sector, slug, name, template_key } = req.body;

    if (!sector || !slug || !template_key) {
      return res.status(400).json({ success:false, message:'sector و slug و template_key مطلوبة' });
    }

    const site = await upsertSiteBasic(ownerId, { sector, slug, name, template_key });
    return res.json({ success:true, site });
  } catch (err) {
    if (err.message === 'INVALID_TEMPLATE') {
      return res.status(400).json({ success:false, message:'template_key غير صالح' });
    }
    if (err.code === '23505') {
      return res.status(400).json({ success:false, message:'هذا الرابط مستخدم لموقع آخر' });
    }
    console.error('updateMySiteBasic error:', err);
    return res.status(500).json({ success:false, message:'خطأ في السيرفر' });
  }
};

exports.updateMySiteTheme = async (req, res) => {
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
};

exports.updateMySiteSettings = async (req, res) => {
  try {
    const ownerId = req.user.id;
    const { sector, branding, social, location } = req.body;
    if (!sector) return res.status(400).json({ success:false, message:'sector مطلوب' });

    const site = await upsertSiteSettings(ownerId, {
      sector,
      branding: branding||{},
      social: social||{},
      location: location||{},
    });

    return res.json({ success:true, site });
  } catch (err) {
    console.error('updateMySiteSettings error:', err);
    return res.status(500).json({ success:false, message:'خطأ في السيرفر' });
  }
};

exports.setPublishState = async (req, res) => {
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
};

exports.updateMySiteAll = async (req, res) => {
  try {
    const ownerId = req.user.id;

    const {
      sector,
      slug,
      name,
      template_key,
      is_published,
      theme,
      settings,
    } = req.body;

    if (!sector) {
      return res.status(400).json({ success: false, message: 'sector مطلوب' });
    }

    const site = await updateSiteAll(ownerId, {
      sector,
      slug,
      name,
      template_key,
      is_published,
      theme,
      settings,
    });

    if (!site) {
      return res.status(404).json({ success: false, message: 'الموقع غير موجود' });
    }

    return res.json({ success: true, site });
  } catch (err) {
    if (err.message === 'INVALID_TEMPLATE') {
      return res.status(400).json({ success: false, message: 'template_key غير صالح' });
    }
    if (err.code === '23505') {
      return res.status(400).json({ success: false, message: 'هذا الرابط مستخدم لموقع آخر' });
    }
    console.error('updateMySiteAll error:', err);
    return res.status(500).json({ success: false, message: 'خطأ في السيرفر' });
  }
};