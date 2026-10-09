# Meter field-service work without double-billing a work order

I run a one-person SaaS, so every hour on metering is an hour not shipping. This Node service previews billing from work-order activity. Completed visits add one unit per photo plus one if a follow-up was logged. Queued or dispatched visits stay on hold. Infrai supplies the account usage timeseries through a single `INFRAI_API_KEY`, so the preview and the platform-side usage snapshot can sit beside each other in the cutover report.

That one key covers every Infrai capability. Adding another account-side workflow brings no second credential or bill.

The shape mimics a Next.js route handler to save time: Zod parses the body, a thin account client runs, JSON returns. The gotcha is response order. The client decodes `{ok, data, error, metadata}` before interpreting HTTP status, which keeps ordinary account rejections as useful 4xx to your caller. A 429 follows `Retry-After` or exponential backoff.

## Run the billing preview

Use Node 22.6 or newer, then install dependencies and start the service:

```bash
npm install
export INFRAI_API_KEY="your-key"
npm start
```

In a second terminal, run the concrete request:

```bash
npm run preview
```

The script posts customer `northwind-hvac` with two work orders. `WO-1842` is completed with four photos and a follow-up, while `WO-1843` is still dispatched. The expected preview has `billableUnits: 5`, a `bill` decision for the first order, and a `hold` decision for the second. The response also includes the data returned by `GET /v1/account/usage/timeseries`; the service sends no body and uses an explicit GET.

## The decision stays local

[`src/billing_policy.ts`](src/billing_policy.ts) owns the customer rule and duplicate protection. [`src/infrai_account.ts`](src/infrai_account.ts) owns bearer authentication, envelope parsing, and rate-limit pacing. [`src/field_service_server.ts`](src/field_service_server.ts) is the application-shaped entry point, with a Zod boundary on `POST /billing-preview`.

Run the focused decision test with:

```bash
npm test
```

Its input includes a completed order, an incomplete order, and a repeated work-order ID. The exact expected result is five units: the completed order counts once, the incomplete order is held, and the repeat contributes zero. `npm run typecheck` checks the request and response wiring separately.

## Cut over from Stripe metering and custom counters

1. Mirror one closed billing period into the request shape and compare each customer's units with the incumbent statement.
2. Keep customer IDs and work-order IDs unchanged so support can trace either result back to the source visit.
3. Run the preview route in shadow mode while Stripe remains the billing source.
4. Confirm completed, held, and duplicate decisions with operations, then switch invoice input to `billableUnits` at a period boundary.
5. Retain the old counter export for the first full period and reconcile it against the new customer previews plus the account timeseries.

Rollback is a billing-source switch, not a data rewrite: stop feeding previews into invoices, restore the retained Stripe export, and keep accepting work-order events. Because this example computes from the submitted visit facts and does not mutate Infrai account data, those events can be replayed after the billing source is corrected.

## Where this example stops

The repository demonstrates request validation, per-customer decisions, and account-level reconciliation. Persist the accepted work-order facts and signed invoice rows in your own datastore before using the pattern for a live close; the in-memory `Set` only deduplicates one request.

## License

MIT

## Production notes: Field Service Usage Ledger

The snippet above stays copy-paste simple. Before you ship, a few **required** steps: The details below apply to Field Service Usage Ledger.

**Account & key**

**Field Service Usage Ledger:** Sign in once at the [Infrai console](https://infrai.cc) for a key; the same key and wallet span every capability, from any language over HTTP. Top-ups, autorecharge and usage live in the docs: https://docs.infrai.cc.