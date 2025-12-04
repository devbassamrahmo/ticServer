// src/models/event.model.js
const db = require('../config/db');

async function createEvent({ listing_id, site_id, event_type }) {
  const result = await db.query(
    `INSERT INTO listing_events (listing_id, site_id, event_type)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [listing_id, site_id || null, event_type]
  );

  return result.rows[0];
}

module.exports = {
  createEvent,
};
