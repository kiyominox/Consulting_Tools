# Dealership Accounting Glossary

Domain terms used across these tools. Keep this current — it is the shared
vocabulary for AI assistants and new collaborators.

## Systems & vendors

- **CDK / CDK Drive** — the dealership Dealer Management System (DMS) and
  accounting platform. Source of GL Detail, the cash clearing schedule, Account
  Balance History, and the Journal Report exports.
- **AGJE** — Accounting General Journal Entry, the CDK module where journal
  entries are posted. **Expert Mode** accepts dot-delimited posting strings
  (see `agje-expert-mode-format.md`); paste there with **right-click → Paste**.
- **Deskit** — sales desking system; the cross-reference for vehicle-sales deals
  (dates, customer, vehicle, salesperson, F&I manager), joined to the GL on
  stock number.
- **Processor / settlement report** — the credit-card processor's export of
  settled transactions; reconciled against the cash clearing schedule. Switched
  to a new processor format in June 2026.
- **CDK Journal Report** — the hierarchical GL export with `Refer Detail` lines.

## Posting / GL terms

- **Company (Co)** — the company/store number that prefixes a posting (e.g. 19
  Honda, 20 Hyundai, 21 warranty).
- **Account** — the GL account number a line posts to.
- **Control / Control2** — sub-ledger reference fields on a GL line. Common
  control values: a VIN fragment (last 6 or last 8), an RO number, a job-card
  number, or a routing code (e.g. `DONATION`, `321`, `121`).
- **Reference** — on the GL export, the field carrying the stock number (vehicle
  sales join key) or document reference.

## Documents & reports

- **RO (Repair Order)** — service order number; a frequent control value.
- **Job card** — GM warranty unit of work; letter-prefixed → VIN control,
  all-digits → RO control.
- **MGR / Value by Source** — CDK parts report feeding parts-rec monthly inputs.
- **Fast Lane** — quick-service report feeding parts-rec monthly inputs.
- **Recap (physical recap)** — physical parts inventory recap.
- **BUR_ACCTHIST** — Account Balance History export (parts-rec balances).
- **RAD** — a monthly parts figure; the tool sums it **YTD (Jan → rec month)**.

## Cash clearing terms

- **Schedule** — the CDK cash clearing schedule being reconciled.
- **NOS (Not On Schedule)** — unmatched deposit items, routed by category
  (e.g. EXT/GM/TOY/CHRY WARRANTY, PNC, AR) to the right account.
- **Round-up / donation** — a payment received above the schedule amount; the
  overage posts to the store's donation account (`ROUND UP DONATION` when rounded
  to the next dollar, `CUSTOMER DONATION` when a custom amount).
- **XTIME** — a deposit type present at CO21 / CO23.
- **BALFWD** — the workbook's old balance-forward table; **dropped** from the HTML
  tool workflow.

## Vehicle sales terms

- **Front gross** — Price − Cost.
- **F&I gross** — F&I Sales − F&I Cost.
- **PVR** — per-vehicle-retail averages shown on the dashboard.
- **F&I manager / business manager** — Deskit `FI MANAGER`; drives tiered F&I
  commission.
- **Veh Type** — New / Used / CPO. **Deal Type** — Finance / Cash / Lease /
  Wholesale / DealerTrade / etc.

## Parts-rec workflow terms

- **Step 11 / Step 13** — review buckets for post-rec-month GL entries with
  non-month controls (timing differences) to include or ignore.
- **Rec month** — the month being reconciled; RAD and balances are summed up to it.
