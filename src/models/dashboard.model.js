// src/models/dashboard.model.js
const db = require('../config/db');

function getDateRange(from, to) {
  let fromDate = from ? new Date(from) : null;
  let toDate = to ? new Date(to) : null;

  if (!toDate || isNaN(toDate.getTime())) toDate = new Date();
  if (!fromDate || isNaN(fromDate.getTime())) {
    fromDate = new Date(toDate.getTime() - 30 * 24 * 60 * 60 * 1000);
  }

  return { from: fromDate.toISOString(), to: toDate.toISOString() };
}

// ===== Summary =====
async function getDashboardSummary(dealer_id, { from, to }) {
  const range = getDateRange(from, to);

  // إجمالي الإعلانات (عقارات/مشاريع) + النشطة
  const listingsRes = await db.query(
    `SELECT
       COUNT(*) AS total_listings,
       COUNT(*) FILTER (WHERE status = 'active') AS active_listings
     FROM listings
     WHERE dealer_id = $1`,
    [dealer_id]
  );

  const listingsRow = listingsRes.rows[0] || { total_listings: 0, active_listings: 0 };

  // إجمالي السيارات + النشطة
  const carsRes = await db.query(
    `SELECT
       COUNT(*) AS total_cars,
       COUNT(*) FILTER (WHERE status = 'active') AS active_cars
     FROM car_listings
     WHERE dealer_id = $1`,
    [dealer_id]
  );

  const carsRow = carsRes.rows[0] || { total_cars: 0, active_cars: 0 };

  // أحداث (بدون JOIN)
  const eventsRes = await db.query(
    `SELECT
       COUNT(*) FILTER (WHERE event_type = 'view') AS total_views,
       COUNT(*) FILTER (WHERE event_type IN ('whatsapp_click','call_click')) AS total_contacts
     FROM listing_events
     WHERE owner_id = $1
       AND created_at BETWEEN $2 AND $3`,
    [dealer_id, range.from, range.to]
  );

  const eventsRow = eventsRes.rows[0] || { total_views: 0, total_contacts: 0 };

  const totalViews = Number(eventsRow.total_views || 0);
  const totalContacts = Number(eventsRow.total_contacts || 0);

  return {
    // listings (realestate)
    total_listings: Number(listingsRow.total_listings || 0),
    active_listings: Number(listingsRow.active_listings || 0),

    // cars
    total_cars: Number(carsRow.total_cars || 0),
    active_cars: Number(carsRow.active_cars || 0),

    // events
    total_views: totalViews,
    total_contacts: totalContacts,
    conversion_rate: totalViews > 0 ? totalContacts / totalViews : 0,
    date_range: range,
  };
}

// ===== Visits timeseries =====
async function getVisitsTimeseries(dealer_id, { from, to }) {
  const range = getDateRange(from, to);

  const res = await db.query(
    `SELECT
       DATE(created_at) AS date,
       COUNT(*) FILTER (WHERE event_type = 'view') AS views,
       COUNT(*) FILTER (WHERE event_type IN ('whatsapp_click','call_click')) AS contacts
     FROM listing_events
     WHERE owner_id = $1
       AND created_at BETWEEN $2 AND $3
     GROUP BY DATE(created_at)
     ORDER BY DATE(created_at) ASC`,
    [dealer_id, range.from, range.to]
  );

  return {
    date_range: range,
    points: res.rows.map((r) => ({
      date: r.date,
      views: Number(r.views || 0),
      contacts: Number(r.contacts || 0),
    })),
  };
}

// ===== Top (cars + property/project) =====
async function getTopItems(dealer_id, limit = 10, { from, to }) {
  const range = getDateRange(from, to);

  // نجيب top ids من events أولاً (سريع بسبب index)
  const topRes = await db.query(
    `SELECT
       listing_id,
       COUNT(*) FILTER (WHERE event_type = 'view') AS views,
       COUNT(*) FILTER (WHERE event_type IN ('whatsapp_click','call_click')) AS contacts
     FROM listing_events
     WHERE owner_id = $1
       AND created_at BETWEEN $2 AND $3
     GROUP BY listing_id
     ORDER BY views DESC
     LIMIT $4`,
    [dealer_id, range.from, range.to, limit]
  );

  const top = topRes.rows || [];
  if (!top.length) {
    return { date_range: range, items: [] };
  }

  const ids = top.map((t) => t.listing_id);

  // جيب تفاصيل من cars + listings (عقارات/مشاريع) بنفس الوقت
  const [carsDetails, listingsDetails] = await Promise.all([
    db.query(
      `SELECT id, title, city, status, price, currency, created_at, 'car'::text AS item_type
       FROM car_listings
       WHERE dealer_id = $1 AND id = ANY($2::uuid[])`,
      [dealer_id, ids]
    ),
    db.query(
      `SELECT id, title, city, status, price, currency, created_at, type AS item_type
       FROM listings
       WHERE dealer_id = $1 AND id = ANY($2::uuid[]) AND type IN ('property','project')`,
      [dealer_id, ids]
    ),
  ]);

  const map = new Map();
  (carsDetails.rows || []).forEach((r) => map.set(r.id, r));
  (listingsDetails.rows || []).forEach((r) => map.set(r.id, r));

  // رتّب حسب top
  const items = top
    .map((t) => {
      const d = map.get(t.listing_id);
      if (!d) return null;
      return {
        id: d.id,
        title: d.title,
        city: d.city,
        status: d.status,
        price: d.price,
        currency: d.currency,
        created_at: d.created_at,
        item_type: d.item_type, // car | property | project
        views: Number(t.views || 0),
        contacts: Number(t.contacts || 0),
      };
    })
    .filter(Boolean);

  return { date_range: range, items };
}

module.exports = {
  getDashboardSummary,
  getVisitsTimeseries,
  getTopItems,
};
