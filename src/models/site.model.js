// src/models/site.model.js
const db = require('../config/db');

const ALLOWED_TEMPLATES = [
  'carClassic',
  'carModern',
  'carLuxury',
  'realestateClassic',
  'realestateModern',
  'realestateLuxury',
];

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
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function getSiteByOwner(ownerId, sector) {
  const result = await db.query(
    `SELECT *
     FROM sites
     WHERE owner_id = $1 AND sector = $2
     LIMIT 1`,
    [ownerId, sector]
  );
  const row = result.rows[0];
  return row ? mapSiteRow(row) : null;
}

async function upsertSiteForOwner(ownerId, {
  sector,
  slug,
  name,
  template_key,
  theme,
  settings,
  is_published,
}) {
  if (!ALLOWED_TEMPLATES.includes(template_key)) {
    throw new Error('INVALID_TEMPLATE');
  }

  const result = await db.query(
    `INSERT INTO sites (
        owner_id, sector, slug, name, template_key, theme, settings, is_published
     )
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
    [
      ownerId,
      sector,
      slug,
      name,
      template_key,
      theme || {},
      settings || {},
      is_published,
    ]
  );

  return mapSiteRow(result.rows[0]);
}

async function getSiteBySlug(slug) {
  const result = await db.query(
    `SELECT *
     FROM sites
     WHERE slug = $1
     LIMIT 1`,
    [slug]
  );
  const row = result.rows[0];
  return row ? mapSiteRow(row) : null;
}

module.exports = {
  getSiteByOwner,
  upsertSiteForOwner,
  getSiteBySlug,
  ALLOWED_TEMPLATES,
};
