const db = require('../config/db');
const crypto = require('crypto');

const ALLOWED_TEMPLATES = [
  'carClassic','carModern','carLuxury',
  'realestateClassic','realestateModern','realestateLuxury',
];

function makeDraftSlug(ownerId, sector) {
  const rnd = crypto.randomBytes(4).toString('hex');
  return `draft-${sector}-${ownerId.slice(0,6)}-${rnd}`.toLowerCase();
}

function mapSiteRow(row) {
  const theme = row.theme || {};
  const settings = row.settings || {};

  return {
    id: row.id,
    owner_id: row.owner_id,
    sector: row.sector,
    slug: row.slug,
    name: row.name,
    template_key: row.template_key,
    is_published: row.is_published,

    colors: theme.colors || {},
    fonts: theme.fonts || {},

    branding: settings.branding || {},
    social: settings.social || {},
    location: settings.location || {},
    about: settings.about || {},

    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function getSiteByOwner(ownerId, sector) {
  const result = await db.query(
    `SELECT * FROM sites WHERE owner_id = $1 AND sector = $2 LIMIT 1`,
    [ownerId, sector]
  );
  const row = result.rows[0];
  return row ? mapSiteRow(row) : null;
}

/**
 * هذا اللي رح نستخدمه لإنشاء الإعلانات
 * - إذا ما عنده موقع لهذا القطاع → null
 */
async function requireOwnerSite(ownerId, sector) {
  const site = await getSiteByOwner(ownerId, sector);
  return site; // قد تكون null
}

async function getSiteBySlug(slug) {
  const result = await db.query(`SELECT * FROM sites WHERE slug = $1 LIMIT 1`, [slug]);
  const row = result.rows[0];
  return row ? mapSiteRow(row) : null;
}

async function getSiteConfigBySlug(slug, { requirePublished = true } = {}) {
  const res = await db.query(`SELECT * FROM sites WHERE slug = $1 LIMIT 1`, [slug]);
  const row = res.rows[0];
  if (!row) return null;
  if (requirePublished && !row.is_published) return null;
  return mapSiteRow(row);
}

async function upsertSiteForOwner(ownerId, {
  sector, slug, name, template_key, theme, settings, is_published,
}) {
  if (!ALLOWED_TEMPLATES.includes(template_key)) throw new Error('INVALID_TEMPLATE');

  const result = await db.query(
    `INSERT INTO sites (owner_id, sector, slug, name, template_key, theme, settings, is_published)
     VALUES ($1,$2,$3,$4,$5,$6,$7, COALESCE($8, FALSE))
     ON CONFLICT (owner_id, sector)
     DO UPDATE SET
       slug = EXCLUDED.slug,
       name = EXCLUDED.name,
       template_key = EXCLUDED.template_key,
       theme = EXCLUDED.theme,
       settings = EXCLUDED.settings,
       is_published = COALESCE(EXCLUDED.is_published, sites.is_published),
       updated_at = NOW()
     RETURNING *`,
    [ownerId, sector, slug, name || null, template_key, theme || {}, settings || {}, is_published]
  );

  return mapSiteRow(result.rows[0]);
}

async function upsertSiteBasic(ownerId, { sector, slug, name, template_key }) {
  if (!ALLOWED_TEMPLATES.includes(template_key)) throw new Error('INVALID_TEMPLATE');

  const result = await db.query(
    `INSERT INTO sites (owner_id, sector, slug, name, template_key, theme, settings, is_published)
     VALUES ($1,$2,$3,$4,$5,'{}'::jsonb,'{}'::jsonb,FALSE)
     ON CONFLICT (owner_id, sector)
     DO UPDATE SET
       slug = EXCLUDED.slug,
       name = EXCLUDED.name,
       template_key = EXCLUDED.template_key,
       updated_at = NOW()
     RETURNING *`,
    [ownerId, sector, slug, name || null, template_key]
  );

  return mapSiteRow(result.rows[0]);
}

async function upsertSiteTheme(ownerId, { sector, colors = {}, fonts = {} }) {
  const result = await db.query(
    `UPDATE sites
     SET theme = jsonb_build_object(
       'colors', COALESCE(theme->'colors','{}'::jsonb) || $3::jsonb,
       'fonts',  COALESCE(theme->'fonts','{}'::jsonb)  || $4::jsonb
     ),
     updated_at = NOW()
     WHERE owner_id = $1 AND sector = $2
     RETURNING *`,
    [ownerId, sector, JSON.stringify(colors), JSON.stringify(fonts)]
  );

  return result.rows[0] ? mapSiteRow(result.rows[0]) : null;
}

async function upsertSiteSettings(ownerId, {
  sector,
  slug,
  name,
  branding = {},
  social = {},
  location = {},
  about = {},
}) {
  const result = await db.query(
    `UPDATE sites
     SET
       slug = COALESCE($3, slug),
       name = COALESCE($4, name),
       settings = jsonb_build_object(
         'branding', COALESCE(settings->'branding','{}'::jsonb) || $5::jsonb,
         'social',   COALESCE(settings->'social','{}'::jsonb)   || $6::jsonb,
         'location', COALESCE(settings->'location','{}'::jsonb) || $7::jsonb,
         'about',    COALESCE(settings->'about','{}'::jsonb)    || $8::jsonb
       ),
       updated_at = NOW()
     WHERE owner_id = $1 AND sector = $2
     RETURNING *`,
    [
      ownerId,
      sector,
      slug || null,
      name || null,
      JSON.stringify(branding),
      JSON.stringify(social),
      JSON.stringify(location),
      JSON.stringify(about),
    ]
  );

  return result.rows[0] ? mapSiteRow(result.rows[0]) : null;
}


async function setSitePublish(ownerId, { sector, is_published }) {
  const result = await db.query(
    `UPDATE sites
     SET is_published = $3, updated_at = NOW()
     WHERE owner_id = $1 AND sector = $2
     RETURNING *`,
    [ownerId, sector, Boolean(is_published)]
  );
  return result.rows[0] ? mapSiteRow(result.rows[0]) : null;
}

async function updateSiteAll(ownerId, { sector, slug, name, template_key, is_published, theme, settings }) {
  if (template_key && !ALLOWED_TEMPLATES.includes(template_key)) {
    throw new Error('INVALID_TEMPLATE');
  }

  const themeJson = theme ? JSON.stringify(theme) : null;
  const settingsJson = settings ? JSON.stringify(settings) : null;

  const result = await db.query(
    `UPDATE sites
     SET
       slug = COALESCE($3, slug),
       name = COALESCE($4, name),
       template_key = COALESCE($5, template_key),
       theme = COALESCE(theme, '{}'::jsonb) || COALESCE($6::jsonb, '{}'::jsonb),
       settings = COALESCE(settings, '{}'::jsonb) || COALESCE($7::jsonb, '{}'::jsonb),
       is_published = COALESCE($8, is_published),
       updated_at = NOW()
     WHERE owner_id = $1 AND sector = $2
     RETURNING *`,
    [
      ownerId,
      sector,
      slug || null,
      name || null,
      template_key || null,
      themeJson,
      settingsJson,
      is_published === undefined ? null : Boolean(is_published),
    ]
  );

  return result.rows[0] ? mapSiteRow(result.rows[0]) : null;
}

async function upsertSiteTemplate(ownerId, { sector, template_key }) {
  if (!ALLOWED_TEMPLATES.includes(template_key)) throw new Error('INVALID_TEMPLATE');

  const draftSlug = makeDraftSlug(ownerId, sector);

  const result = await db.query(
    `INSERT INTO sites (owner_id, sector, slug, name, template_key, theme, settings, is_published)
     VALUES ($1,$2,$3,NULL,$4,'{}'::jsonb,'{}'::jsonb,FALSE)
     ON CONFLICT (owner_id, sector)
     DO UPDATE SET
       template_key = EXCLUDED.template_key,
       updated_at = NOW()
     RETURNING *`,
    [ownerId, sector, draftSlug, template_key]
  );

  return mapSiteRow(result.rows[0]);
}

module.exports = {
  ALLOWED_TEMPLATES,
  getSiteByOwner,
  requireOwnerSite,
  getSiteBySlug,
  getSiteConfigBySlug,
  upsertSiteForOwner,
  upsertSiteBasic,
  upsertSiteTheme,
  upsertSiteSettings,
  setSitePublish,
  updateSiteAll,
  upsertSiteTemplate,
};
