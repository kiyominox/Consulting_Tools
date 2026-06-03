# Vehicle Sales Report

A **single, fully standalone HTML tool** for building a per-dealership vehicle sales
report from two exports:

1. **CDK GL / Journal export** — the "bible" that determines *which deals appear*.
2. **Deskit export** — the cross-reference that supplies dates, customer, vehicle and
   salespeople.

The two files are joined on **GL `Reference` number = Deskit `STOCK#`**.

The tool auto-detects the **CDK Journal Report** layout (the hierarchical export with
`Refer Detail` lines) and reads the account/amount/reference from those detail lines. A
plain flat GL (one row per entry with Account/Amount columns) also works — the column
mapping is auto-detected and adjustable.

**MacDonald's chart of accounts is pre-loaded** (Sale 299, Cost 299, F&I Sale 46,
F&I Cost 31, Sales Commission 4, F&I Commission 3). Hillside starts empty until those
accounts are provided. Everything is editable in Step 1 and saved in the browser.

Everything runs in the browser. No server, no internet connection required — the
SheetJS spreadsheet parser is embedded directly in the file. **No data ever leaves the
computer.** Just double-click **`Vehicle Sales Report.html`**.

---

## How to use

1. **Pick the dealership** (MacDonald / Hillside) in the top-right selector.
2. **Step 1 – GL Account Setup.** For the selected dealership, list the GL account
   numbers that belong to each category. Settings save automatically in the browser and
   can be exported to a JSON backup file (and re-imported on another machine).
3. **Step 2 – Upload files.** Drop in the CDK GL export and the Deskit export. The GL
   columns (Account #, Reference, Posting Date, Amount or Debit/Credit) are
   auto-detected; adjust the mapping if a heading is unusual.
4. Click **Generate Report**.
5. **Step 3 – Report.** Sort, search, filter by **Veh Type** and **Deal Type** (checkbox
   dropdowns), **Export**, or **Print / PDF**. The **Export** menu
   offers four choices — *All deals* or *Only deals found in Deskit*, each as **Excel
   (.xlsx)** or **CSV**. Excel exports keep real dates and numeric/money formatting.

## Report columns

Sold Date · Stock # · Year · Model · Veh Type · Deal Type · Customer Name · Days In Stock ·
Price · Cost · Front Gross · Salesperson · Sales Commission · Business Manager · F&I Sales ·
F&I Cost · F&I Gross · F&I Commission · Sales F&I Commission.

**Veh Type** comes from Deskit's `VEH TYPE` field (New / Used / CPO). **Deal Type** comes
from Deskit's `TYPE` field (Finance, Cash, Lease, Cash Wholesale, Cash DealerTrade, etc.).
Both have a **checkbox dropdown** in Step 3 (Select all / Clear) to show/hide values; the
two filters combine (a row must pass both).

### Where each value comes from

| Column | Source |
|---|---|
| Sold Date, Days In Stock | Deskit `SOLD DATE`; days = Sold − `INSERVICE DATE` |
| Stock # | GL `Reference` (= Deskit `STOCK#`) |
| Year, Model | Parsed from Deskit `VEHICLE` (leading year split off) |
| Veh Type | Deskit `VEH TYPE` (New / Used / CPO) |
| Deal Type | Deskit `TYPE` (Finance / Cash / Lease / Wholesale / …) |
| Customer Name | Deskit `FIRST NAME` + `LAST NAME` |
| Salesperson | Deskit `SP1` |
| Business Manager | Deskit `FI MANAGER` |
| Price | Sum of **Sale** accounts |
| Cost | Sum of **Cost** accounts |
| Front Gross | Price − Cost |
| F&I Sales | Sum of **F&I Sale** accounts |
| F&I Cost | Sum of **F&I Cost** accounts |
| F&I Gross | F&I Sales − F&I Cost |
| Sales Commission | Sum of **Sales Commission** accounts |
| F&I Commission | Tiered % of the deal's F&I Gross (see below), or sum of accounts |
| Sales F&I Commission | Sales Commission + F&I Commission |

## F&I Commission — tiered by business manager

By default F&I Commission is **not** read from GL accounts (MacDonald's F&I pay isn't
booked in the sales journals). Instead it is calculated as a **percentage of each deal's
F&I Gross**, where the rate is set by the **business manager's average F&I Gross per deal
for the month**:

| Manager's monthly average F&I Gross / deal | Rate |
|---|---|
| less than $2,000 | 16% |
| $2,000 – $2,250 | 18% |
| above $2,250 | 20% |

So each manager (Deskit `FI MANAGER`) gets one rate for the month based on their average,
and that rate is applied to every one of their deals: `F&I Commission = rate × F&I Gross`.
Deals with no business manager (e.g. wholesale) get none. The thresholds and rates are
**editable per dealership** in Step 1, and the report shows a per-manager breakdown
(deals, average, rate, commission).

You can switch a dealership back to **"Sum of GL commission accounts"** in Step 1 if its
F&I commission is posted to the ledger instead.

## Account categories & balance signs

Six categories: **Sale, Cost, F&I Sale, F&I Cost, Sales Commission, F&I Commission.**

Each category has a **balance type** so GL signs come out right on the report:

- **Credit (revenue)** — values are negated so they display as positive. Default for
  *Sale* and *F&I Sale*.
- **Debit (cost/expense)** — values shown as-is. Default for *Cost*, *F&I Cost* and both
  commission categories.

Only GL lines posted to a configured account are counted; everything else is ignored.

## Notes

- A deal that exists in the GL but **isn't found in Deskit** is still shown (highlighted,
  flagged "not in Deskit"), so nothing from the GL is silently dropped.
- Reference/stock matching is case-insensitive and ignores surrounding spaces.
- The bottom row totals every money column; the cards above summarise units, price,
  front gross, F&I gross and commission.

> The single "Commissions" list from the chart of accounts is pre-split into **Sales
> Commission** (`1100`–`1103`) and **F&I Commission** (`74000`, `85500`, `85600`). Sales
> Commission is read from those accounts; F&I Commission uses the tiered method above.
> Adjust either in Step 1 if needed.

## Editing & rebuilding (`Vehicle Sales Report.html` is generated)

`Vehicle Sales Report.html` is a built artifact — do not hand-edit it. The sources live in:

```
src/index.template.html   page layout + styles
src/app.js                 application logic
src/mac_defaults.js        MacDonald chart of accounts (window.MAC_DEFAULTS)
vendor/xlsx.full.min.js    SheetJS parser (embedded for offline use)
build.py                   inlines all of the above into "Vehicle Sales Report.html"
```

After changing anything in `src/`, rebuild the standalone file:

```bash
python3 build.py
```
