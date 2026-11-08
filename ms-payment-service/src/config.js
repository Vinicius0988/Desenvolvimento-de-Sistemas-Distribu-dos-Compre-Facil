const numberFromEnv = (name, fallback) =>
  process.env[name] !== undefined ? Number(process.env[name]) : fallback;

module.exports = {
  port: numberFromEnv('PORT', 3001),
  databaseUrl:
    process.env.DATABASE_URL ||
    'postgres://postgres:postgres@localhost:5432/payments',
  rabbitUrl: process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672',
  // Fila consumida pelo serviço de notificação.
  notificationQueue: process.env.NOTIFICATION_QUEUE || 'notification.queue',
  // Fila consumida pelo próprio serviço de pagamento (processamento assíncrono).
  processQueue: process.env.PAYMENT_PROCESS_QUEUE || 'payment.process.queue',
  // Tempo simulado de processamento do pagamento.
  processDelayMs: numberFromEnv('PROCESS_DELAY_MS', 5000),
};
