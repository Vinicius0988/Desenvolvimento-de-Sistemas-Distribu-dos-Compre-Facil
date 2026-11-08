const express = require('express');
const config = require('./config');
const messaging = require('./messaging');
const notifier = require('./notifier');

const app = express();
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ service: 'ms-notification-service', status: 'UP' });
});

// Interface REST: consulta das notificações enviadas (mais recentes primeiro).
app.get('/notifications', (_req, res) => {
  res.json(notifier.list());
});

async function start() {
  await messaging.connect();
  // Interface AMQP: consome os eventos publicados pelo serviço de pagamento.
  await messaging.consume(config.notificationQueue, notifier.notify);

  app.listen(config.port, () => {
    console.log(
      `[notification] Serviço de notificação na porta ${config.port}.`
    );
  });
}

start().catch((err) => {
  console.error('[notification] Falha ao iniciar:', err);
  process.exit(1);
});
