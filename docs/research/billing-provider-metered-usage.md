# Which billing provider fits subscriptions plus metered usage?

Research for [Monetization: StateWalker's first paid product](https://github.com/statewalker/statewalker-root/issues/193) and [issue #199](https://github.com/statewalker/statewalker-root/issues/199), checked 2026-11-23. This note compares public, first-party product and pricing documentation. It is product research, not tax or legal advice.

## Decision

Use **Polar** for the first paid beta if StateWalker wants the shortest path to merchant-of-record billing with subscriptions and usage-based charges. Use **Stripe Billing + Stripe Tax** instead if retaining direct control of the merchant relationship, payment stack and data model is worth owning tax registrations, filings and disputes. Re-evaluate **Stripe Managed Payments** before launch: it offers a Stripe-native merchant-of-record path, but its availability and product constraints should be confirmed for StateWalker's account during onboarding.

Do not start a new integration with **Lemon Squeezy**: its official site says sales ceased on 2026-11-10 and the service is shutting down. Do not make **Paddle** the first choice while its current usage-based billing product remains early access and seller-country onboarding has not been confirmed for the actual account.

This decision is reversible if StateWalker keeps its own product, entitlement, meter and usage-event ledger and treats the billing provider as an adapter.

## Comparison

| Provider | Commercial role | Subscriptions and meters | Public fees | Tax and VAT | Seller/payout fit | Lock-in and operational note |
|---|---|---|---|---|---|---|
| **Polar** | Merchant of record (MoR) | Recurring subscriptions, usage-based pricing and meters are documented as product features. The API exposes meter quantities and customer meter objects. | 4% + $0.40 per transaction; +1.5% international cards, +0.5% subscriptions, +0.5% usage-based billing, plus listed payout fees. | Polar states it handles payment processing, sales tax, VAT, refunds and disputes as MoR. | Payouts use Stripe Connect; Polar's supported-country page includes Portugal through Stripe's supported countries. Payout availability still depends on Connect onboarding and identity/business review. | Fastest launch and smallest compliance surface. Migration is not free: provider product/price IDs, checkout and webhook schemas are Polar-specific. Keep internal IDs and export usage. |
| **Stripe Billing + Tax** | StateWalker is merchant of record | Mature subscriptions and usage billing. Meter events are ingested through the API; Stripe documents idempotency identifiers and a high-throughput meter-event stream for larger volumes. | Billing pay-as-you-go is 0.7% of Billing volume. Stripe Tax Basic is 0.5% per transaction where tax is calculated; payment processing and other products are additional. | Stripe Tax calculates tax and helps with monitoring/filing integrations, but the business remains responsible for registrations and compliance unless it uses Managed Payments. | Stripe is available in Portugal. Bank payout timing and fees depend on the account configuration. | Best control and portability at the data level, highest operational/legal burden. Avoid making Stripe invoice state the source of truth for entitlements. |
| **Stripe Managed Payments** | Stripe is MoR for eligible digital products | Stripe Billing remains the underlying billing surface; account eligibility and supported product types must be confirmed. | 3.5% per successful Managed Payments transaction, in addition to Payments fees and other applicable fees. | Stripe states that Managed Payments handles indirect tax, fraud, disputes and transaction-level support as MoR. | Availability is account- and product-dependent; verify Portugal and StateWalker's digital-service model during onboarding rather than assuming acceptance. | Attractive long-term middle ground if approved: Stripe APIs with MoR coverage. Newer product and more account-dependent than ordinary Billing. |
| **Paddle** | Merchant of record | Subscriptions are mature. Paddle's current pricing page describes metered billing as early access. | 5% + $0.50 per checkout transaction, with custom pricing for large or high-value businesses. | Paddle states it calculates, collects and remits taxes as MoR. | Seller-country and payout onboarding must be confirmed for the actual account before engineering. | Strong SaaS MoR, but the unconfirmed onboarding path and early-access meter product make it a poor first integration here. |
| **Lemon Squeezy** | Former MoR | Historical subscriptions and usage APIs are no longer a viable new-build choice. | Not relevant for a new integration. | Not relevant for a new integration. | Its official site says new sales stopped on 2026-11-10 and the service is shutting down. | Eliminate. Building against a service in shutdown creates immediate migration work. |

## How usage should flow from Workers and Durable Objects

The billing provider must not be the system of record for raw usage. StateWalker already plans meters, limits, a usage API and telemetry; those should own the canonical data.

1. **Record locally first.** A Worker or Durable Object appends a usage event with an internal event ID, tenant, meter, quantity, unit, occurred-at timestamp and source object/request ID.
2. **Aggregate deterministically.** Durable Objects are a good serialization boundary per tenant or workspace. Aggregate counters into provider-appropriate intervals while retaining the immutable source events needed for reconciliation.
3. **Publish asynchronously.** Send compact usage envelopes to a queue or scheduled exporter. The request path should never depend on a billing-provider API call.
4. **Map internal IDs to provider IDs.** Keep `customer_id`, `subscription_id`, `product_id` and meter mappings in an adapter table. Product entitlements and plan limits use StateWalker IDs.
5. **Use idempotency and replay.** Reuse the internal event ID as the provider idempotency identifier where supported. Persist delivery attempts, provider acknowledgements and the last reconciled interval.
6. **Reconcile before invoicing.** Compare the internal aggregate with the provider's meter quantity/customer-meter endpoint. Alert on drift and hold destructive corrections for review.
7. **Enforce limits internally.** Webhook and invoice state can update billing status, but runtime authorization reads StateWalker's entitlement snapshot, not a synchronous provider call.

### Provider adapters

- **Polar:** post usage to its meter-event endpoint, query customer meter quantities for reconciliation, and consume subscription/order webhooks into the entitlement projection.
- **Stripe:** send meter events with stable identifiers. For ordinary scale, use the meter event API; only adopt meter-event streams when throughput requires it. Consume subscription, invoice and entitlement events through verified webhooks.
- **Paddle:** if the country and early-access blockers are removed, use its meter-event API/SDK and treat it as another exporter. Do not redesign the internal ledger around Paddle's event names.

## Portability boundary

Define a small billing port rather than importing provider concepts throughout the product:

```text
createCheckout(customer, offer)
changeSubscription(subscription, offer)
cancelSubscription(subscription, when)
reportUsage(events[])
getReportedUsage(customer, meter, interval)
handleWebhook(verifiedPayload)
```

Persist the normalized results as StateWalker objects. This limits migration to checkout, webhooks, exports and ID mappings; accounts, workspaces, entitlements, prices shown to users and the raw usage ledger remain provider-neutral.

## Launch sequence

1. Confirm the product is an eligible digital service and complete Polar/Stripe account review before building the paid UI.
2. Implement the internal meter and entitlement ledger first, with a fake billing adapter and replay tests.
3. Add one provider adapter: Polar by default, Stripe Billing if direct-merchant control is chosen.
4. Launch one recurring plan with one metered dimension. Avoid multiple credits, tiers and overage rules until reconciliation has passed through a real invoice cycle.
5. Export customers, subscriptions, prices, invoices and usage monthly so a provider migration is operationally possible.

## Kill criteria

- No provider integration begins until seller-country and payout onboarding are confirmed for the actual account.
- If Polar rejects or cannot onboard the account, switch to Stripe Billing; do not build a second MoR adapter speculatively.
- If tax registrations and filing are not operationally owned, do not launch direct-merchant Stripe Tax billing; use an approved MoR.
- Lemon Squeezy is not reconsidered unless Stripe publishes a supported successor path that accepts new sales.

## Sources

Read 2026-11-23:

- Polar: [fees](https://polar.sh/docs/merchant-of-record/fees), [merchant of record](https://polar.sh/docs/merchant-of-record/introduction), [supported countries](https://polar.sh/docs/merchant-of-record/supported-countries), [usage-based billing](https://polar.sh/docs/features/usage-based-billing), [meters](https://polar.sh/docs/features/usage-based-billing/meters), [customer meter API](https://polar.sh/docs/api-reference/customer-meters/quantities)
- Stripe: [Billing pricing](https://stripe.com/billing/pricing), [usage-based billing](https://docs.stripe.com/billing/subscriptions/usage-based), [record usage](https://docs.stripe.com/billing/subscriptions/usage-based/recording-usage), [meter event streams](https://docs.stripe.com/billing/subscriptions/usage-based/recording-usage-api), [Tax pricing](https://stripe.com/tax/pricing), [global availability](https://stripe.com/global), [Managed Payments](https://docs.stripe.com/payments/managed-payments), [Managed Payments pricing](https://stripe.com/pricing#managed-payments)
- Paddle: [pricing, MoR and usage-based billing status](https://www.paddle.com/pricing), [developer documentation](https://developer.paddle.com/)
- Lemon Squeezy: [official shutdown notice](https://www.lemonsqueezy.com/)
