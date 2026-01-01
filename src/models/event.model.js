// src/models/event.model.js
const db = require('../config/db');

async function createEvent({ owner_id, listing_id, site_id, event_type }) {
  const result = await db.query(
    `INSERT INTO listing_events (owner_id, listing_id, site_id, event_type)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [owner_id, listing_id, site_id || null, event_type]
  );

  return result.rows[0];
}

module.exports = {
  createEvent,
};
