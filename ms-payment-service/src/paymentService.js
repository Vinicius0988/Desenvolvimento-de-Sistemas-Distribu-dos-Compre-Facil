const config = require('./config');
const repository = require('./repository');
const messaging = require('./messaging');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function buildEvent(event, transaction) {
  return {
    event,
    transactionId: transaction.id,
    userEmail: transaction.userEmail,
    amount: transaction.amount,
    status: transaction.status,
    occurredAt: new Date().toISOString(),
  };
}

/**
 * Passos I e II do fluxo:
 *  I.  armazena a transação com status PENDING;
 *  II. publica na fila de notificação o recebimento da solicitação.
 * Também enfileira o processamento, que será feito de forma assíncrona.
 */
async function requestPayment({ userEmail, amount, description }) {
  const transaction = await repository.create({
    userEmail,
    amount,
    description,
  });
  console.log(`[payment] Transação ${transaction.id} criada (PENDING).`);

  await messaging.publish(
    config.notificationQueue,
    buildEvent('PAYMENT_RECEIVED', transaction)
  );
  await messaging.publish(config.processQueue, {
    transactionId: transaction.id,
  });

  return transaction;
}

/**
 * Passos IV e V do fluxo (executados ao consumir a fila de processamento):
 *  IV. confirma a transação e atualiza o status para SUCCESS;
 *  V.  publica na fila de notificação a confirmação da transação.
 */
async function processPayment({ transactionId }) {
  console.log(`[payment] Processando transação ${transactionId}...`);
  await sleep(config.processDelayMs);

  const transaction = await repository.markSuccess(transactionId);
  if (!transaction) {
    console.log(
      `[payment] Transação ${transactionId} não está PENDING. Ignorando.`
    );
    return;
  }
  console.log(`[payment] Transação ${transaction.id} confirmada (SUCCESS).`);

  await messaging.publish(
    config.notificationQueue,
    buildEvent('PAYMENT_CONFIRMED', transaction)
  );
}

module.exports = { requestPayment, processPayment };
