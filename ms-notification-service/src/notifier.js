const MAX_HISTORY = 100;
const sent = [];

const formatAmount = (amount) =>
  Number(amount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function buildMessage(event) {
  const value = formatAmount(event.amount);
  switch (event.event) {
    case 'PAYMENT_RECEIVED':
      return `Recebemos sua solicitação de pagamento de ${value} (transação ${event.transactionId}). Avisaremos assim que for confirmada.`;
    case 'PAYMENT_CONFIRMED':
      return `Seu pagamento de ${value} foi confirmado com sucesso (transação ${event.transactionId}). Obrigado por comprar na CompreFácil!`;
    default:
      return null;
  }
}

/**
 * Envia a notificação ao usuário. O envio é simulado: registra no log
 * e guarda o histórico em memória (consultável via REST).
 */
async function notify(event) {
  const message = buildMessage(event);
  if (!message) {
    console.warn(`[notification] Evento desconhecido ignorado: ${event.event}`);
    return;
  }

  const notification = {
    to: event.userEmail,
    event: event.event,
    transactionId: event.transactionId,
    message,
    sentAt: new Date().toISOString(),
  };

  console.log(
    `[notification] Enviando para ${notification.to}: ${notification.message}`
  );

  sent.unshift(notification);
  if (sent.length > MAX_HISTORY) sent.pop();
}

function list() {
  return sent;
}

module.exports = { notify, list };
