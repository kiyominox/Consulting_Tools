# AGJE Expert Mode — Posting String Format

The output format every posting tool in this repo produces. Pasted into CDK
Drive's **AGJE Expert Mode** (Accounting General Journal Entry). This pack is
the authoritative spec; tools must match it exactly.

## The string

```
Co.Account.(Amount×100).Control.Control2.Description.Count
```

Fields are dot-separated:

| Field | Meaning | Notes |
|---|---|---|
| **Co** | Company number | The store/franchise company (e.g. 19 Honda, 20 Hyundai, 21 warranty). |
| **Account** | GL account number | From the per-brand/per-store map (see `account-control-maps.md`). |
| **Amount×100** | Dollar amount in cents, no decimal point | `$1,234.56` → `123456`. Multiplying by 100 removes the decimal so CDK reads it cleanly. |
| **Control** | Primary sub-ledger reference | Usually a VIN fragment or RO/job-card number — varies by tool (see below). |
| **Control2** | Secondary reference | Often blank or a fixed routing code. |
| **Description** | Free-text JE description | Human-readable note (e.g. "ROUND UP DONATION"). |
| **Count** | Line count / multiplier | Trailing field per the CDK posting template. |

### Pasting rule

In CDK AGJE Expert Mode, **right-click → Paste**. `Ctrl+V` does **not** work
there. Tools copy one line per posting row to the clipboard.

## Sign conventions

- Amounts are **multiplied by 100** to drop the decimal point in every tool.
- **Honda** invoice amounts are **flipped to negative**; **Hyundai** amounts are
  **kept negative**. (These are credit-memo invoices.)
- **Warranty** postings (Toyota & GM) are entered as **credits, balanced by a
  single debit to 532099** so the entry nets to zero. The balancing 532099 line
  auto-recalculates when any amount is edited.
- **Vehicle-sales** report categories carry a balance type so signs display
  correctly: revenue (Sale, F&I Sale) is **credit** (negated to show positive);
  cost/commission is **debit** (as-is). (This is for reporting, not posting.)

## Worked examples by tool

### Powerposting — Honda invoice (Co 19)

Control = **last 6 of VIN**; amounts flipped negative.

| Invoice column | Account |
|---|---|
| DMA | 511162 |
| FLRPLN | 511171 |
| TRFR | 511161 |

### Powerposting — Hyundai invoice (Co 20)

Control = **last 6 of VIN**; amounts negative.

| Report line | Account |
|---|---|
| Advertising Assessment | 521161 |
| Dealer Holdback Report | 521160 |
| Dealer Flooring Allowance | 521171 |

### Powerposting — Toyota warranty (Co 21, Settled Claims Report)

All credits, balanced by debit to **532099 control 321**.

| Report section | Account | Control |
|---|---|---|
| PDS claims (Labor Amt Paid) | 541180 | last 8 of VIN |
| PDS Sub-Total Sublet Amt | 532450 | — |
| Non-PDS claims (Amt Paid) | 541140 | RO number |
| ToyotaCare / Boost (Amt Paid) | 541140 | RO number |
| Balancing debit | 532099 | 321 |

### Powerposting — GM warranty (Co 21, Transaction Summary Report)

One posting per job card from the Processed Transaction Summary, using **Job Card
Amount Paid** (unpaid job cards skipped). Balanced by debit to **532099 control 121**.

| Job card number | Account | Control |
|---|---|---|
| Starts with a letter | 531180 | last 8 of VIN |
| All digits | 531140 | job card (RO) # |
| Balancing debit | 532099 | 121 |

After reading, both warranty tools sum what they read and compare to the totals
printed on the report (green = read correctly; yellow = a misread to fix).

### Cash Clearing (per-store Co)

Posts schedule clearing lines plus, when a payment came in above the schedule
amount, a **donation** split: schedule amount → clearing account; the overage →
the store's donation account under control `DONATION` (default). JE descriptions
distinguish `ROUND UP DONATION` from `CUSTOMER DONATION`. CO21/CO23 unmatched
items route by **category** (EXT/GM/TOY/CHRY WARRANTY, PNC, AR) to that
category's account. Per-store accounts: see `account-control-maps.md`.

## When you change a posting format

Trace every account/control to this pack or `account-control-maps.md`. If a tool
disagrees with this pack, the tool's actual code wins — update this pack and note
it. Never invent an account number.
