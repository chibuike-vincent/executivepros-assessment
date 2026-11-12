# Payment Processing Simulation

This assignment project pretends to take payments, the way a checkout service would — without talking to a real bank.

You ask it to charge someone. It says “got it, still working on it.” A moment later the payment either goes through or it doesn’t. You can check back to see which one happened.

Nothing here moves real money. Card numbers are not stored. It’s an assessment service for showing how a payment API should behave.

## How a payment moves

Think of it like sending a parcel:

1. You place the order. The service writes it down and says **pending**.
2. In the background it “talks” to a fake payment processor. That takes a second or two on purpose, like a real bank would.
3. Then it lands on **succeeded** or **failed**.
4. If you change your mind while it’s still waiting, you can **cancel**. Once it has succeeded, you can’t.

If you send the same order twice (same reference, same details), you get the original payment back. You are not charged twice. If you reuse the same reference with a *different* amount, the service refuses — that would look like a different charge wearing the same ticket.

## Try it

You need Node.js 18 or newer installed.

```bash
npm install
npm start
```

The service runs at http://127.0.0.1:4000.

The easiest way in is the docs page: **http://127.0.0.1:4000/docs**. You can create a payment there, copy its id, then look it up again after a couple of seconds.

To run the checks that prove this all works:

```bash
npm test
```

## A simple walkthrough

Create a payment for ₦25.00 (amounts are in kobo, so `2500` means 25 naira):

```bash
curl -s http://127.0.0.1:4000/payments \
  -H 'content-type: application/json' \
  -d '{
    "amount": 2500,
    "currency": "NGN",
    "merchantRef": "order-42",
    "customerEmail": "buyer@example.com",
    "paymentMethodToken": "tok_test_123"
  }'
```

The reply should say `pending`. Grab the `id` from it, wait a couple of seconds, then:

```bash
curl -s http://127.0.0.1:4000/payments/<paste-the-id-here>
```

You should now see `succeeded` or `failed`. About one in five simulated payments is declined, on purpose, so you can see failure as well as success.

To always succeed while you’re trying it out:

```bash
PROCESSOR_FAILURE_RATE=0 npm start
```

## What this service will not do

It will not:

- talk to Paystack, Stripe, or a bank
- store real card details
- run as a cluster of many servers (it keeps payments in a local file)
- ask you to log in

If the app is stopped mid-payment, it picks unfinished ones back up when it starts again. That’s the “what if the laptop sleeps?” version of reliability, not a full production setup.

## Everyday commands

| You want to… | Run |
|---|---|
| Start it | `npm start` |
| Auto-restart while editing | `npm run dev` |
| Run the tests | `npm test` |

Settings you might change live in `.env.example`. Copy that to `.env` if you want. Leaving it alone is fine.

## If something goes wrong

The service answers in plain JSON. A typical “that request wasn’t valid” looks like:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request",
    "requestId": "client-trace-1"
  }
}
```

The `requestId` is a tracking number for that one request. Useful if you’re asking someone to look at the logs.

Common meanings:

- **400** — the request was incomplete or the numbers don’t make sense
- **404** — that payment id doesn’t exist
- **409** — you reused an order reference with different details, or you tried to cancel a payment that’s already finished
- **503** — it couldn’t save or read the payments file
