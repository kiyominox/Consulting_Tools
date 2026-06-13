# GL Posting Month Validator (master / `_shared`)

Compares **GL postings** against **receipt history (RRH PDF)** by order number to
verify each entry is booked in the correct month, every receipt-backed item has a
GL posting, and amounts agree. Supports multi-month analysis, split GL postings,
and typo-tolerant order matching.

This is the **master** copy: already fully store-agnostic (no GL accounts, Co
numbers, or dealer names are hardcoded — everything comes from the uploaded
files) and themed in the master purple (`#6B298C`) so you can tell at a glance
it's the source version.

## Inputs

1. **GL Report** (Excel) — columns: Reference, Acctg. Date, Amount, Control Month.
2. **All Data** (Excel) — invoice/order data (order number, value).
3. **RRH Receipt History** (PDF) — Receipt Date, Order Number, Order Value.

Months present in the GL file are auto-detected and checked; adjust with the
month selector before validating.
</content>
