# Vehicle Sales Report

A **single, fully standalone HTML tool** for building a per-dealership vehicle sales
report from two exports:

1. **CDK GL export** — the "bible" that determines *which deals appear* on the report.
2. **Deskit export** — the cross-reference that supplies dates, customer, vehicle and
   salespeople.

The two files are joined on **GL `Reference` number = Deskit `STOCK#`**.

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

> Built with placeholder defaults. Once the real account lists for each dealership and a
> live GL export are loaded, the figures populate immediately — adjust the account lists
> in Step 1 anytime accounts are added, removed, or changed in the GL.
