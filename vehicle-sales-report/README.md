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
computer.** Just double-click `index.html`.

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
5. **Step 3 – Report.** Sort, filter, **Export CSV**, or **Print / PDF**.

## Report columns

Sold Date · Stock # · Year · Model · Customer Name · Days In Stock · Price · Cost ·
Salesperson · Sales Commission · Business Manager · F&I Gross · F&I Commission ·
Sales F&I Commission.

### Where each value comes from

| Column | Source |
|---|---|
| Sold Date, Days In Stock | Deskit `SOLD DATE`; days = Sold − `INSERVICE DATE` |
| Stock # | GL `Reference` (= Deskit `STOCK#`) |
| Year, Model | Parsed from Deskit `VEHICLE` (leading year split off) |
| Customer Name | Deskit `FIRST NAME` + `LAST NAME` |
| Salesperson | Deskit `SP1` |
| Business Manager | Deskit `FI MANAGER` |
| Price | Sum of **Sale** accounts |
| Cost | Sum of **Cost** accounts |
| F&I Gross | **F&I Sale** − **F&I Cost** accounts |
| Sales Commission | Sum of **Sales Commission** accounts |
| F&I Commission | Sum of **F&I Commission** accounts |
| Sales F&I Commission | Sales Commission + F&I Commission |

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

## Known data note — F&I Commission

MacDonald's F&I commission accounts (`74000`, `85500`, `85600`) have **no activity in the
vehicle-sales journals (10/12/20)** that make up the sample Journal Report, so the F&I
Commission column computes to `$0`. F&I manager pay appears to be booked outside these
journals (payroll/back-end). To populate that column, either include the journal where
F&I commission is posted in the export, or point the **F&I Commission** category at the
account that actually carries it. Sales commission (`1101`/`1102`/`1103`,
"FRONTCOMMISSION DUE") posts in these journals and computes correctly.

> The single "Commissions" list from the chart of accounts is pre-split into **Sales
> Commission** (`1100`–`1103`) and **F&I Commission** (`74000`, `85500`, `85600`) so the
> report can show both columns. Adjust the split in Step 1 if needed.
