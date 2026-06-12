# Account / Control / Settlement Maps

Per-store and per-brand mappings used by the tools. **These are real GL accounts
— never invent or guess one.** Where a tool bakes in a full chart of accounts,
this pack points to the source file rather than re-listing hundreds of accounts.

## Powerposting — brand maps (authoritative copy in `agje-expert-mode-format.md`)

| Brand | Co | Control | Account map |
|---|---|---|---|
| Honda (invoice) | 19 | last 6 of VIN | DMA→511162, FLRPLN→511171, TRFR→511161 (flip negative) |
| Hyundai (invoice) | 20 | last 6 of VIN | Advertising Assessment→521161, Dealer Holdback→521160, Dealer Flooring Allowance→521171 (negative) |
| Toyota (warranty) | 21 | VIN/RO | PDS→541180 (last 8 VIN), Sublet→532450, Non-PDS & ToyotaCare/Boost→541140 (RO); balance debit 532099 ctrl 321 |
| GM (warranty) | 21 | VIN/RO | letter job card→531180 (last 8 VIN), digit job card→531140 (RO); balance debit 532099 ctrl 121 |

## Cash Clearing — per store

Stores: **CO18, CO19, CO20, CO21, CO23**. Each store carries its own **Company
number, clearing/deposit account numbers, deposit types, round-up donation
account + control, and Not-On-Schedule (NOS) categories** — all extracted from
that store's `.xlsm` workbook and editable in the HTML tool's ⚙ Setup screen.

- **Donation split (all stores):** overage posts to the store's donation account
  under control `DONATION` by default; descriptions `ROUND UP DONATION` vs
  `CUSTOMER DONATION`.
- **CO21 / CO23 specifics:** deposit types include **XTIME**; unmatched items
  route by **NOS category** — `EXT WARRANTY`, `GM WARRANTY`, `TOY WARRANTY`,
  `CHRY WARRANTY`, `PNC`, `AR` — each to its own account. Other stores post
  unmatched items to schedule clearing.

> The exact per-store account numbers live baked into each workbook
> (`AR/CMA/cash-clearing/CASHCLEARINGTEMPLATE_CO##.xlsm`) and in the HTML tool's
> saved settings. When onboarding a new store, capture its real clearing/deposit/
> donation accounts and categories into its ⚙ Setup before going live — do not
> copy another store's numbers blindly.

## Vehicle Sales — chart of accounts

Two dealerships, **MacDonald** and **Hillside** (Hillside starts as an independent
copy of MacDonald's lists, signs, and F&I tiers). Six categories with counts
(MacDonald): **Sale 299, Cost 299, F&I Sale 46, F&I Cost 31, Sales Commission 4,
F&I Commission 3.**

- Full account list: **`Vehicle-Sales/_shared/vehicle-sales-report/src/mac_defaults.js`**
  (`window.MAC_DEFAULTS`, keyed `sale / cost / fiSale / fiCost / salesComm / fiComm`).
- **Sales Commission** accounts: `1100`–`1103`.
- **F&I Commission** accounts: `74000`, `85500`, `85600` (but F&I comp is normally
  *not* read from GL — see tiers below).
- **Balance signs:** Sale & F&I Sale = credit (negated to display positive); Cost,
  F&I Cost, both commissions = debit (as-is).

### F&I commission tiers (by business manager's monthly avg F&I gross / deal)

| Manager monthly avg F&I gross / deal | Rate |
|---|---|
| < $2,000 | 16% |
| $2,000 – $2,250 | 18% |
| > $2,250 | 20% |

Each manager (Deskit `FI MANAGER`) gets one monthly rate by their average; it
applies to all their deals: `F&I Commission = rate × F&I Gross`. Editable per
dealership; per-manager rate override available. Deals with no business manager
get none. A dealership can switch to "sum of GL commission accounts" instead.

## Parts Reconciliation — accounts

- **Account Balance History (`BUR_ACCTHIST.xlsx`)** auto-fills accounts **24200 /
  24300 / 24401** for every month.
- GL Detail supplies the row-level parts entries; Step 11 / Step 13 capture
  post-rec-month timing differences (non-month controls).

## Onboarding a new store (checklist)

1. Confirm the new store's **Company number**.
2. Capture its **real account numbers** (clearing/deposit/donation, or chart of
   accounts for vehicle sales) from its CDK setup — do not reuse another store's.
3. Capture store-specific options (deposit types, NOS categories, F&I tiers).
4. Record them in this pack and in the tool's Setup/defaults, then verify with a
   sample run before going live. See `/new-store-tool`.
