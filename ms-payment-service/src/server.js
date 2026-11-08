const express = require('express');
const config = require('./config');
const db = require('./db');
const messaging = require('./messaging');
const repository = require('./repository');
const paymentService = require('./paymentService');

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const app = express();
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ service: 'ms-payment-service', status: 'UP' });
});

// Solicitação de transação (interface REST).
app.post('/payments', async (req, res, next) => {
  try {
    const { userEmail, amount, description } = req.body || {};

    if (typeof userEmail !== 'string' || !/^\S+@\S+\.\S+$/.test(userEmail)) {
      return res.status(400).json({ error: 'userEmail inválido.' });
    }
    if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) {
      return res
        .status(400)
        .json({ error: 'amount deve ser um número maior que zero.' });
    }

    const transaction = await paymentService.requestPayment({
      userEmail,
      amount,
      description,
    });
    // 202: a solicitação foi aceita e será processada de forma assíncrona.
    res.status(202).json(transaction);
  } catch (err) {
    next(err);
  }
});

app.get('/payments', async (_req, res, next) => {
  try {
    res.json(await repository.findAll());
  } catch (err) {
    next(err);
  }
});

app.get('/payments/:id', async (req, res, next) => {
  try {
    if (!UUID_REGEX.test(req.params.id)) {
      return res.status(400).json({ error: 'ID inválido.' });
    }
    const transaction = await repository.findById(req.params.id);
    if (!transaction) {
      return res.status(404).json({ error: 'Transação não encontrada.' });
    }
    res.json(transaction);
  } catch (err) {
    next(err);
  }
});

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error('[http] Erro:', err);
  res.status(500).json({ error: 'Erro interno.' });
});

async function start() {
  await db.init();
  await messaging.connect();
  // Interface AMQP: consome as solicitações de processamento de pagamento.
  await messaging.consume(config.processQueue, paymentService.processPayment);

  app.listen(config.port, () => {
    console.log(`[payment] Serviço de pagamento na porta ${config.port}.`);
  });
}

start().catch((err) => {
  console.error('[payment] Falha ao iniciar:', err);
  process.exit(1);
});
