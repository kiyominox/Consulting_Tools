# Tool design system

The shared look-and-feel for every tool so they read as **one family** even when
laid out differently (the cash-clearing stepper layout is fine — it just uses the
same fonts, colors, buttons, and header motif). The repo-root `index.html`
launcher is the reference implementation.

## Fonts

- **Body / UI:** `"Segoe UI", system-ui, -apple-system, BlinkMacSystemFont, Roboto, "Helvetica Neue", Arial, sans-serif`
- **Numbers / AGJE strings / codes:** `ui-monospace, "SF Mono", SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace`
- Tabular figures everywhere money/counts appear: `font-variant-numeric: tabular-nums`.
- No web fonts — system stacks only (hard offline rule).

Map these onto each tool's existing `--font` / `--mono` token (or define them).
Body text is the sans stack; reserve mono for figures, account numbers, and AGJE.

## Color (already in place)

Master purple `#6B298C` accent family in light mode; the dark palette from the
dark-mode pass. Keep semantic green `#15784c` / red `#c0392b` / amber `#9a6207`
and per-brand badge colors. Token values (light → dark):

| token | light | dark |
|---|---|---|
| accent | `#6B298C` | `#9b4dc0` |
| accent-strong | `#561f70` | `#8a3cb0` |
| accent-ink | `#45195a` | `#c79fe0` |
| accent-soft | `#f3eaf8` | `#2a1f33` |
| accent-line | `#dcc4e8` | `#4a3357` |
| ink / text | `#16191d` | `#e9e6ef` |
| muted | `#79808a` | `#9089a0` |
| paper / surface | `#ffffff` | `#211b29` |
| bg | `#eceff3` | `#15121b` |
| line | `#e3e7ec` | `#332b3d` |

## Header motif

A sticky top bar with: a **purple rounded-square brand mark** (the two-line glyph
from the launcher), the tool name (bold, ~17px), a muted one-line subtitle, then
right-aligned actions ending in the 🌙/☀️ theme toggle (`id="btnTheme"`). Exact
markup can vary per layout; the motif (mark + title + subtitle + actions) and the
fonts/colors must match.

## Buttons & controls

- Primary: purple background, white text, radius ~8px, padding ~8×14.
- Ghost/secondary: transparent, subtle border, accent-soft hover.
- Inputs/selects: 1px line border, radius ~8px; focus ring `outline:2px solid var(--accent)`.
- Border radius family: `--r:12px` (cards), `--r-sm:8px` (controls).

## Keyboard navigation (required on every tool)

Every input/select in forms and editable tables must be reachable and advanceable
from the keyboard:

- **Tab / Shift+Tab** uses native order — make sure inputs aren't `tabindex="-1"`
  and are in DOM order matching visual order.
- **Enter** advances to the next editable field. In a column-oriented data-entry
  table (e.g. typing amounts down a column) Enter should move to the **same column
  in the next row**; elsewhere it moves to the next field in DOM order. **Shift+Enter**
  goes back. Don't hijack Enter inside a `<textarea>` or on buttons/links.
- On focus, text inputs should `select()` their contents so typing replaces.

Reference helper (adapt the "next field" rule per tool):

```js
function wireEnterNav(root, opts){
  opts=opts||{};
  root.addEventListener('keydown',function(e){
    if(e.key!=='Enter'||e.isComposing) return;
    var el=e.target;
    if(!el.matches('input:not([type=checkbox]):not([type=radio]):not([type=file]),select')) return;
    e.preventDefault();
    var next;
    var cell=el.closest('td');
    if(opts.columnar && cell){                 // same column, next row
      var tr=el.closest('tr'), idx=Array.prototype.indexOf.call(tr.children,cell);
      var rows=Array.prototype.slice.call(tr.parentNode.children);
      var ri=rows.indexOf(tr)+(e.shiftKey?-1:1);
      while(rows[ri]){ var c=rows[ri].children[idx], f=c&&c.querySelector('input,select,textarea');
        if(f){ next=f; break; } ri+=(e.shiftKey?-1:1); }
    }
    if(!next){                                 // fall back to DOM order
      var all=Array.prototype.slice.call(root.querySelectorAll('input:not([type=hidden]):not([disabled]),select,textarea'))
        .filter(function(x){return x.offsetParent!==null;});
      var i=all.indexOf(el); next=all[i+(e.shiftKey?-1:1)];
    }
    if(next){ next.focus(); if(next.select) try{next.select();}catch(_){} }
  });
}
```

Also: clickable rows/cells that toggle state (e.g. "Received in full", tab strips)
should be real `<button>`s or have `tabindex="0"` + Enter/Space handlers so they're
keyboard-operable.

## Sample data (required on every tool)

Each tool has a **"Generate sample data"** button that loads a small, balanced,
self-contained example so the tool can be demoed/tested with no real files. For
file-input tools, inject the already-parsed in-memory structures (don't fabricate
a real PDF) and run the tool's normal render/reconcile path. Use the fictional
cast below — never a real store/customer/bank/account.

## Fictional cast (use consistently; nerdy + funny)

Refresh any older demo data to this cast. **Toyota and Chevrolet (and each make)
are always _separate_ single-brand stores** — never combine brands into one store
(CMA's combined Toyota-Chevrolet store is a real-world oddity, not the default).

**Dealership stores (single brand each):**
Rivendell Toyota · Mordor Chevrolet · Tatooine Honda · Hyrule Hyundai ·
Bricksburg Subaru · Rapture CDJR · Pallet Town Kia · Tamriel GMC · Vault City Ford ·
Azeroth Nissan

**Customers:** Frodo Baggins · Lara Croft · Master Chief · Geralt of Rivia ·
Commander Shepard · Samus Aran · Gordon Freeman · Ellen Ripley · Cloud Strife ·
Princess Zelda · Boba Fett · Trevor Belmont · Aloy Sobeck · Bilbo Baggins · Kratos ·
Sub-Zero

**Salespeople:** Han Solo · Lando Calrissian · Nathan Drake · Jill Valentine ·
Marcus Fenix · Chun-Li

**F&I / business managers:** Tony Stark · Bruce Wayne · Lex Luthor · Gollum

**Banks / lenders / floorplan / processors:** Bank of Braavos · Iron Bank Floorplan ·
Gondor Capital · Stark Industries Financial · Wayne Financial · Cyberdyne Credit

**Employees / clerks / parts mgr:** Bilbo Baggins · "Rivendell Parts Dept" ·
Samwise Gamgee

Account numbers in masters stay obvious placeholders; real VINs/brands are fine
(they drive matching demos). Keep it funny but still a believable accounting demo.
</content>
