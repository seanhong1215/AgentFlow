# 2026-05-30 ECPay Payment Integration

## User Story
As a logged-in shopper, I want to pay an existing order through ECPay, then return to the local order page and manually verify the payment status, so that the local-only project can confirm payment without receiving ECPay Server Notify callbacks.

## Spec
- Use ECPay AIO (`/Cashier/AioCheckOut/V5`) with `ChoosePayment=ALL`.
- Generate checkout params on the server only; never expose `HashKey` or `HashIV`.
- Use CheckMacValue SHA256 following `.agents/skills/ecpay/guides/13-checkmacvalue.md`.
- Store `ecpay_merchant_trade_no` on the order and reuse it for repeated checkout attempts.
- Use `ClientBackURL` to return the shopper to `/orders/:id?payment=returned`.
- Keep `ReturnURL` as a required AIO field, but do not depend on it for local verification.
- Add a manual `POST /api/orders/:id/ecpay/query` endpoint that calls ECPay `QueryTradeInfo`.
- Mark the order `paid` only when ECPay returns `TradeStatus=1` and `TradeAmt` matches `orders.total_amount`.
- Keep ATM/CVS/BARCODE payments pending until ECPay query reports paid.

## Tasks
- [x] Add ECPay service for endpoints, CheckMacValue, Taiwan date formatting, item name building, checkout params, and QueryTradeInfo.
- [x] Add idempotent order table migration fields for ECPay metadata.
- [x] Add checkout and query APIs under `/api/orders/:id/ecpay/*`.
- [x] Add local-safe `/api/ecpay/notify` endpoint that acknowledges `1|OK` when reachable.
- [x] Replace simulated payment buttons on order detail page with ECPay checkout and manual status confirmation.
- [x] Add CheckMacValue vector tests and ECPay route tests.
- [x] Update documentation.
- [x] Verify with `$env:JWT_SECRET='test-secret'; npm test`.

