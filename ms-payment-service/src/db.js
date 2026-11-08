const { Pool } = require('pg');
const config = require('./config');

const pool = new Pool({ connectionString: config.databaseUrl });

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Aguarda o Postgres ficar disponível e cria a tabela de transações.
 */
async function init(retries = 20, delayMs = 3000) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await pool.query('SELECT 1');
      break;
    } catch (err) {
      console.log(
        `[db] Postgres indisponível (${attempt}/${retries}): ${err.message}`
      );
      if (attempt === retries) throw err;
      await sleep(delayMs);
    }
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS transactions (
      id          UUID PRIMARY KEY,
      user_email  TEXT           NOT NULL,
      amount      NUMERIC(12, 2) NOT NULL,
      description TEXT,
      status      TEXT           NOT NULL,
      created_at  TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
      updated_at  TIMESTAMPTZ    NOT NULL DEFAULT NOW()
    )
  `);
  console.log('[db] Tabela "transactions" pronta.');
}

module.exports = { pool, init };
