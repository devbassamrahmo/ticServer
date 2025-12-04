// src/models/dashboard.model.js
const db = require('../config/db');

// helper بسيط لتواريخ الديفولت (آخر 30 يوم)
function getDateRange(from, to) {
  let fromDate = from ? new Date(from) : null;
  let toDate = to ? new Date(to) : null;

  if (!toDate || isNaN(toDate.getTime())) {
    toDate = new Date();
  }
  if (!fromDate || isNaN(fromDate.getTime())) {
    fromDate = new Date(toDate.getTime() - 30 * 24 * 60 * 60 * 1000);
  }

  return {
    from: fromDate.toISOString(),
    to: toDate.toISOString(),
  };
}

// ملخص الأرقام العامة
async function getDashboardSummary(dealer_id, { from, to }) {
  const range = getDateRange(from, to);

  // إجمالي الإعلانات + النشطة
  const listingsRes = await db.query(
    `SELECT
       COUNT(*) AS total_listings,
       COUNT(*) FILTER (WHERE status = 'active') AS active_listings
     FROM listings
     WHERE dealer_id = $1`,
    [dealer_id]
  );

  const listingsRow = listingsRes.rows[0] || {
    total_listings: 0,
    active_listings: 0,
  };

  // إجمالي الأحداث (views + contacts)
  const eventsRes = await db.query(
    `SELECT
       COUNT(*) FILTER (WHERE e.event_type = 'view') AS total_views,
       COUNT(*) FILTER (WHERE e.event_type IN ('whatsapp_click','call_click')) AS total_contacts
     FROM listing_events e
     JOIN listings l ON l.id = e.listing_id
     WHERE l.dealer_id = $1
       AND e.created_at BETWEEN $2 AND $3`,
    [dealer_id, range.from, range.to]
  );

  const eventsRow = eventsRes.rows[0] || {
    total_views: 0,
    total_contacts: 0,
  };

  const totalViews = Number(eventsRow.total_views || 0);
  const totalContacts = Number(eventsRow.total_contacts || 0);
  const conversionRate =
    totalViews > 0 ? totalContacts / totalViews : 0;

  return {
    total_listings: Number(listingsRow.total_listings || 0),
    active_listings: Number(listingsRow.active_listings || 0),
    total_views: totalViews,
    total_contacts: totalContacts,
    conversion_rate: conversionRate, // 0 - 1
    date_range: range,
  };
}

// منحنى الزيارات (يومي)
async function getVisitsTimeseries(dealer_id, { from, to }) {
  const range = getDateRange(from, to);

  const res = await db.query(
    `SELECT
       DATE(e.created_at) AS date,
       COUNT(*) FILTER (WHERE e.event_type = 'view') AS views,
       COUNT(*) FILTER (WHERE e.event_type IN ('whatsapp_click','call_click')) AS contacts
     FROM listing_events e
     JOIN listings l ON l.id = e.listing_id
     WHERE l.dealer_id = $1
       AND e.created_at BETWEEN $2 AND $3
     GROUP BY DATE(e.created_at)
     ORDER BY DATE(e.created_at) ASC`,
    [dealer_id, range.from, range.to]
  );

  return {
    date_range: range,
    points: res.rows.map((r) => ({
      date: r.date,          // ISO date
      views: Number(r.views || 0),
      contacts: Number(r.contacts || 0),
    })),
  };
}

// أكثر العقارات زيارة
async function getTopListings(dealer_id, limit = 10, { from, to }) {
  const range = getDateRange(from, to);

  const res = await db.query(
    `SELECT
       l.id,
       l.title,
       l.city,
       l.status,
       l.price,
       l.currency,
       l.created_at,
       COALESCE(COUNT(*) FILTER (WHERE e.event_type = 'view'), 0) AS views,
       COALESCE(COUNT(*) FILTER (WHERE e.event_type IN ('whatsapp_click','call_click')), 0) AS contacts
     FROM listings l
     LEFT JOIN listing_events e
       ON e.listing_id = l.id
       AND e.created_at BETWEEN $2 AND $3
     WHERE l.dealer_id = $1
     GROUP BY l.id
     ORDER BY views DESC
     LIMIT $4`,
    [dealer_id, range.from, range.to, limit]
  );

  return {
    date_range: range,
    items: res.rows.map((r) => ({
      id: r.id,
      title: r.title,
      city: r.city,
      status: r.status,
      price: r.price,
      currency: r.currency,
      created_at: r.created_at,
      views: Number(r.views || 0),
      contacts: Number(r.contacts || 0),
    })),
  };
}

module.exports = {
  getDashboardSummary,
  getVisitsTimeseries,
  getTopListings,
};
