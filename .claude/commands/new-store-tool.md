---
description: Clone a _shared tool into a new per-store variant with its own account maps
argument-hint: <tool-type> <store-or-group> (e.g. cash-clearing CO24)
---

Onboard a new store/group by creating a per-store variant of an existing tool.
Arguments: `$ARGUMENTS` (first = tool type/name, second = store or group name).

Follow the repo's `_shared`/`<store>` convention from `CLAUDE.md` and the
onboarding checklist in `docs/reference/account-control-maps.md`.

Steps:

1. **Identify the source.** Locate the `_shared` (or canonical) version of the
   requested tool — e.g. `AR/CMA/cash-clearing/`,
   `Vehicle-Sales/_shared/vehicle-sales-report/`,
   `Powerposting/CMA/`. Confirm with the user if the tool name is ambiguous.

2. **Create the destination** `<ToolType>/<store-or-group>/<tool-name>/` using
   hyphenated, space-free folder names. Copy the tool's deliverable(s) and README.

3. **Swap the per-store data — do NOT reuse another store's numbers blindly.**
   Read `docs/reference/account-control-maps.md` for what must change:
   Company number, clearing/deposit/donation accounts, deposit types, NOS
   categories (cash clearing); or the chart of accounts and F&I tiers (vehicle
   sales). **Ask the user for the new store's real account numbers** — never
   invent a GL account. For HTML tools, set them as the baked-in defaults (the
   "Download shareable copy" / Setup defaults mechanism).

4. **Update the new store's README** to name the store and list its specific
   accounts/categories.

5. **Record the new store** in `docs/reference/account-control-maps.md` so the
   knowledge pack stays authoritative.

6. **Verify** with the tool's sample-data path before declaring done, then
   summarize what was created and which values still need real numbers from the
   user.

Preserve the offline, single-file, no-network guarantees throughout.
