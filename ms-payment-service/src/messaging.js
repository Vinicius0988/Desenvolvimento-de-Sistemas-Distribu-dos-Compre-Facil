const amqp = require('amqplib');
const config = require('./config');

let connection;
let channel;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Conecta ao RabbitMQ (com novas tentativas) e declara as filas.
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

      channel = await connection.createConfirmChannel();
      await channel.assertQueue(config.notificationQueue, { durable: true });
      await channel.assertQueue(config.processQueue, { durable: true });
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
 * Publica uma mensagem persistente em uma fila e aguarda a confirmação do broker.
 */
function publish(queue, payload) {
  return new Promise((resolve, reject) => {
    channel.sendToQueue(
      queue,
      Buffer.from(JSON.stringify(payload)),
      { persistent: true, contentType: 'application/json' },
      (err) => (err ? reject(err) : resolve())
    );
  });
}

/**
 * Consome uma fila. A mensagem só é confirmada (ack) depois que o handler termina.
 */
async function consume(queue, handler, prefetch = 5) {
  await channel.prefetch(prefetch);
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

module.exports = { connect, publish, consume };
