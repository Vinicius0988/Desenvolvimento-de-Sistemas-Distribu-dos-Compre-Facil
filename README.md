# CompreFácil - Microsserviços de Pagamento e Notificação

Reestruturação da plataforma de e-commerce da CompreFácil usando **arquitetura de microsserviços**. Dois serviços independentes, em Node.js, se comunicam de forma **assíncrona** por meio do **RabbitMQ**:

- **ms-payment-service** (porta 3001): recebe solicitações de pagamento (REST), guarda as transações no **Postgres** e processa os pagamentos (AMQP).
- **ms-notification-service** (porta 3002): consome eventos da fila (AMQP) e notifica o usuário. Expõe REST para consultar as notificações enviadas.

## Fluxo (assíncrono)

```
Cliente --POST /payments--> [Pagamento]
   I.   salva a transação com status PENDING (Postgres)
   II.  publica PAYMENT_RECEIVED em notification.queue ---> [Notificação]
                                                            III. lê a fila e notifica: "solicitação recebida"
        publica a transação em payment.process.queue
   IV.  (consumidor do próprio serviço) confirma e atualiza o status para SUCCESS
   V.   publica PAYMENT_CONFIRMED em notification.queue ---> [Notificação]
                                                            VI.  lê a fila e notifica: "pagamento confirmado"
```

A API responde `202 Accepted` imediatamente. A confirmação acontece em segundo plano, depois de um tempo simulado (5 segundos por padrão).

Os serviços não se chamam diretamente: só trocam mensagens pelo RabbitMQ. Cada um pode ser iniciado, parado e escalado sozinho.

## Estrutura

```
compre-facil/
  docker-compose.yml          # Postgres, RabbitMQ e os dois serviços
  ms-payment-service/         # REST + AMQP + Postgres
    src/ config.js, db.js, messaging.js, repository.js, paymentService.js, server.js
  ms-notification-service/    # REST + AMQP
    src/ config.js, messaging.js, notifier.js, server.js
```

## Como executar

Pré-requisito: [Docker Desktop](https://www.docker.com/products/docker-desktop/) em execução.

### Opção 1: tudo no Docker

```bash
docker compose up --build
```

### Opção 2: infraestrutura no Docker, serviços localmente (Node 18+)

```bash
docker compose up -d postgres rabbitmq

# terminal 1
cd ms-payment-service
npm install
npm start

# terminal 2
cd ms-notification-service
npm install
npm start
```

Painel do RabbitMQ: http://localhost:15672 (usuário `guest`, senha `guest`).

## Testando

**PowerShell (Windows):**

```powershell
$body = '{"userEmail":"cliente@email.com","amount":199.90,"description":"Pedido #123"}'
Invoke-RestMethod -Method Post -Uri http://localhost:3001/payments -ContentType "application/json" -Body $body
```

**curl (Linux/macOS/Git Bash):**

```bash
curl -X POST http://localhost:3001/payments \
  -H "Content-Type: application/json" \
  -d '{"userEmail":"cliente@email.com","amount":199.90,"description":"Pedido #123"}'
```

A resposta traz a transação com `"status": "PENDING"`. Depois confira:

```bash
curl http://localhost:3001/payments/<id>     # status passa a SUCCESS após alguns segundos
curl http://localhost:3002/notifications     # as duas notificações enviadas
```

Nos logs dos serviços dá para acompanhar cada passo do fluxo (`docker compose logs -f`).

## Endpoints

| Serviço | Método | Rota | Descrição |
|---|---|---|---|
| Pagamento | POST | `/payments` | Solicita uma transação (`userEmail`, `amount`, `description`) |
| Pagamento | GET | `/payments` | Lista as transações mais recentes |
| Pagamento | GET | `/payments/:id` | Consulta uma transação |
| Pagamento | GET | `/health` | Verificação de saúde |
| Notificação | GET | `/notifications` | Lista as notificações enviadas |
| Notificação | GET | `/health` | Verificação de saúde |

## Filas (AMQP)

| Fila | Publicada por | Consumida por | Conteúdo |
|---|---|---|---|
| `notification.queue` | Pagamento | Notificação | Eventos `PAYMENT_RECEIVED` e `PAYMENT_CONFIRMED` |
| `payment.process.queue` | Pagamento | Pagamento | `transactionId` a ser processada |

As filas são duráveis, as mensagens são persistentes e só recebem `ack` depois de processadas.

## Variáveis de ambiente

| Variável | Padrão | Serviço |
|---|---|---|
| `PORT` | 3001 / 3002 | ambos |
| `RABBITMQ_URL` | `amqp://guest:guest@localhost:5672` | ambos |
| `DATABASE_URL` | `postgres://postgres:postgres@localhost:5432/payments` | pagamento |
| `NOTIFICATION_QUEUE` | `notification.queue` | ambos |
| `PAYMENT_PROCESS_QUEUE` | `payment.process.queue` | pagamento |
| `PROCESS_DELAY_MS` | 5000 | pagamento |

## Observações

- O envio da notificação é simulado: aparece no log e fica guardado em memória (últimas 100). Em um sistema real, seria trocado por e-mail, SMS ou push.
- Se um serviço estiver fora do ar, as mensagens ficam na fila e são entregues quando ele voltar.