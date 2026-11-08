module.exports = {
  port: process.env.PORT !== undefined ? Number(process.env.PORT) : 3002,
  rabbitUrl: process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672',
  // Mesma fila na qual o serviço de pagamento publica os eventos.
  notificationQueue: process.env.NOTIFICATION_QUEUE || 'notification.queue',
};
