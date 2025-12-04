// src/models/userDocuments.model.js
const db = require('../config/db');

async function addUserDocument(userId, documentType, fileUrl) {
  const result = await db.query(
    `INSERT INTO user_documents (user_id, document_type, file_url)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [userId, documentType, fileUrl]
  );
  return result.rows[0];
}

async function getUserDocuments(userId) {
  const result = await db.query(
    `SELECT id, document_type, file_url, uploaded_at
     FROM user_documents
     WHERE user_id = $1
     ORDER BY uploaded_at DESC`,
    [userId]
  );
  return result.rows;
}

module.exports = {
  addUserDocument,
  getUserDocuments,
};
