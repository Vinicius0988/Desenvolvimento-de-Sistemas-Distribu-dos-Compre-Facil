const { randomUUID } = require('crypto');
const { pool } = require('./db');

const STATUS = { PENDING: 'PENDING', SUCCESS: 'SUCCESS' };

function toTransaction(row) {
  return {
    id: row.id,
    userEmail: row.user_email,
    amount: Number(row.amount),
    description: row.description,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function create({ userEmail, amount, description }) {
  const { rows } = await pool.query(
    `INSERT INTO transactions (id, user_email, amount, description, status)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [randomUUID(), userEmail, amount, description || null, STATUS.PENDING]
  );
  return toTransaction(rows[0]);
}

async function findById(id) {
  const { rows } = await pool.query('SELECT * FROM transactions WHERE id = $1', [
    id,
  ]);
  return rows[0] ? toTransaction(rows[0]) : null;
}

async function findAll(limit = 50) {
  const { rows } = await pool.query(
    'SELECT * FROM transactions ORDER BY created_at DESC LIMIT $1',
    [limit]
  );
  return rows.map(toTransaction);
}

/**
 * Atualiza para SUCCESS somente se a transação ainda estiver PENDING.
 * Retorna null se não houve atualização (já processada ou inexistente).
 */
async function markSuccess(id) {
  const { rows } = await pool.query(
    `UPDATE transactions
        SET status = $2, updated_at = NOW()
      WHERE id = $1 AND status = $3
      RETURNING *`,
    [id, STATUS.SUCCESS, STATUS.PENDING]
  );
  return rows[0] ? toTransaction(rows[0]) : null;
}

module.exports = { STATUS, create, findById, findAll, markSuccess };
