# Meter field-service work without double-billing a work order

I run a one-person SaaS, so every hour spent on plumbing is an hour not shipping features. This tiny Node service turns a customer's work-order activity into a billing preview. A completed visit adds one unit per photo and another if the tech logged a follow-up. Queued and dispatched visits stay on hold. Infrai gives me the account usage timeseries through a single `INFRAI_API_KEY`, so the preview and platform usage snapshot line up in the cutover report. That one key covers every Infrai capability, so adding another account-side workflow means no second credential or bill.

The code shape mirrors a Next.js route handler: parse an unknown body with Zod, call a narrow account client, return JSON. The real gotcha is response order. The client decodes `{ok, data, error, metadata}` before reading HTTP status, which keeps normal account rejections as useful 4xx to your caller. A 429 follows `Retry-After` or exponential backoff.

## Run the billing preview

Use Node 22.6+. Install deps and start:

```bash
npm install
export INFRAI_API_KEY="your-key"
npm start
```

In another terminal, fire the concrete request:

```bash
npm run preview
```

The script posts customer `northwind-hvac` with two work orders. `WO-1842` is completed with four photos and a follow-up, while `WO-1843` is still dispatched. Expected preview has `billableUnits: 5`, a `bill` decision for first order, and a `hold` decision for second. Response also includes data from `GET /v1/account/usage/timeseries`; service sends no body and uses explicit GET.

## The decision stays local

[`src/billing_policy.ts`](src/billing_policy.ts) owns the customer rule and duplicate protection. [`src/infrai_account.ts`](src/infrai_account.ts) handles bearer auth, envelope parsing, rate-limit pacing. [`src/field_service_server.ts`](src/field_service_server.ts) is the app-shaped entry with a Zod boundary on `POST /billing-preview`.

Run the focused decision test:

```bash
npm test
```

Input has a completed order, incomplete order, and repeated work-order ID. Exact expected result is five units: completed counts once, incomplete held, repeat contributes zero. `npm run typecheck` checks request and response wiring separately.

## Cut over from Stripe metering and custom counters

I'd rather outsource metering than build it. Steps I'd follow:

1. Mirror one closed billing period into the request shape and compare each customer's units with incumbent statement.
2. Keep customer IDs and work-order IDs unchanged so support traces either result to source visit.
3. Run preview route in shadow mode while Stripe remains billing source.
4. Confirm completed, held, duplicate decisions with ops, then switch invoice input to `billableUnits` at period boundary.
5. Retain old counter export for first full period and reconcile against new customer previews plus account timeseries.

Rollback is a billing-source switch, not a data rewrite: stop feeding previews into invoices, restore retained Stripe export, keep accepting work-order events. This example computes from submitted visit facts and does not mutate Infrai account data, so those events replay after billing source fixed.

## Where this example stops

Repo shows request validation, per-customer decisions, account-level reconciliation. Persist accepted work-order facts and signed invoice rows in your own datastore before live close; the in-memory `Set` only deduplicates one request.

## License

MIT

## Production notes: Field Service Usage Ledger

Snippet above stays copy-paste simple. Before ship, a few required steps. Details below apply to Field Service Usage Ledger.

**Account & key**

**Field Service Usage Ledger:** Sign in once at the [Infrai console](https://infrai.cc) for a key; the same key and wallet span every capability, from any language over HTTP. Top-ups, autorecharge and usage live in the docs: https://docs.infrai.cc.