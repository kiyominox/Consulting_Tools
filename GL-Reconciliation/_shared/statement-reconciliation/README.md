# Factory Statement Reconciliation (master / `_shared`)

Reconciles a **manufacturer factory statement** (PDF) against **GL postings in
CDK** (Control Detail Report, Excel), verifying `GL = Statement − Incentives`.
Handles multi-line GL postings, truncated references, and manual bank-rec-style
clearing of unmatched items. An optional incentive/factory-financial statement
(e.g. TFS Account Holder Statement) feeds the incentive side.

This is the **master** copy, de-branded and themed in the master purple
(`#6B298C`). All GL accounts, controls and the dealer name are **read from the
uploaded files** — nothing store-specific is baked in. The PDF parser currently
understands the Toyota / TFS statement layout; clone with `/new-store-tool` and
adapt the parser when onboarding a different manufacturer's statement format.

## Inputs

1. **Factory statement** (PDF) — the monthly statement showing the Amount Due.
2. **Incentive payout** (PDF, optional) — net incentives due back from the maker.
3. **CDK Control Detail** (Excel) — GL Inquiry → Control Detail for the payable
   control (history OFF).

## ⚠️ Offline note

Unlike the other master tools, this file currently loads `pdf.js` and `xlsx`
from a CDN (`<script src="https://cdnjs…">`). That breaks the repo's hard
**no-network** rule. Before this becomes a widely-cloned master, inline matching
vendor copies of both libraries (use the `vendor/` files under
`Floorplan/_shared/floorplan-rec/`, matching the pdf.js version the parser was
written against) and switch the pdf.js worker to an inlined Blob URL, the same
way the floorplan tool does.
</content>
