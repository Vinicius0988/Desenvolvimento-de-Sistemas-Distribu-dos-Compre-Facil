const amqp = require('amqplib');
const config = require('./config');

let connection;
let channel;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Conecta ao RabbitMQ (com novas tentativas) e declara a fila de notificações.
 */
async function connect(retries = 20, delayMs = 3000) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      connection = await amqp.connect(config.rabbitUrl);
      connection.on('error', (err) =>
        console.error('[amqp] Erro na conexão:', err.message)
      );
      connection.on('close', () => {
        console.error('[amqp] Conexão encerrada. Finalizando o serviço.');
        process.exit(1);
      });

      channel = await connection.createChannel();
      await channel.assertQueue(config.notificationQueue, { durable: true });
      console.log('[amqp] Conectado ao RabbitMQ.');
      return;
    } catch (err) {
      console.log(
        `[amqp] RabbitMQ indisponível (${attempt}/${retries}): ${err.message}`
      );
      if (attempt === retries) throw err;
      await sleep(delayMs);
    }
  }
}

/**
 * Consome a fila. A mensagem só é confirmada (ack) depois que o handler termina.
 */
async function consume(queue, handler) {
  await channel.prefetch(10);
  await channel.consume(queue, async (msg) => {
    if (!msg) return;
    try {
      await handler(JSON.parse(msg.content.toString()));
      channel.ack(msg);
    } catch (err) {
      console.error(`[amqp] Erro ao processar mensagem de "${queue}":`, err);
      channel.nack(msg, false, false);
    }
  });
}

module.exports = { connect, consume };
