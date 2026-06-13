#!/usr/bin/env bash
#
# Emit the GitHub release body (Markdown) for one release group on stdout.
#
# For every tool in the group it prints the tool's embedded one-line
# description (from <meta name="description">) plus, when a previous release
# exists, a per-tool list of what changed since that release. It ALSO doubles
# as the release-time guard: if any released HTML lacks a non-empty embedded
# description it prints the offenders to stderr and exits non-zero, failing the
# release job before anything is published.
#
# Inputs (env): MATRIX_PATH (company folder or "_shared"), MATRIX_TAG, MATRIX_NAME.
set -euo pipefail

GROUP_PATH="${MATRIX_PATH:?MATRIX_PATH is required}"
TAG="${MATRIX_TAG:?MATRIX_TAG is required}"
DISPLAY="${MATRIX_NAME:?MATRIX_NAME is required}"

# Commit of the previously published release (empty on the first ever release).
prev=$(git rev-parse -q --verify "refs/tags/${TAG}^{commit}" 2>/dev/null || true)

# Files in this release — same filter as the publish globs in the workflow.
# HTML tools first, then .xlsm templates.
find_group() {
  find . -type f -name "$1" \
    -path "*/${GROUP_PATH}/*" \
    -not -path '*/src/*' \
    -not -path '*/templates/*' \
    -not -path '*/web/*' \
    -not -path './.*' \
    | sed -E 's#^\./##' | sort
}
mapfile -t files < <(find_group '*.html'; find_group '*.xlsm')

# ── Guard: every released HTML must carry an embedded description ─────────────
missing=()
for f in "${files[@]}"; do
  case "$f" in
    *.html)
      grep -qiE '<meta[[:space:]]+name="description"[[:space:]]+content="[^"]+"' "$f" \
        || missing+=("$f") ;;
  esac
done
if [ "${#missing[@]}" -gt 0 ]; then
  {
    echo "ERROR: these released tools have no non-empty <meta name=\"description\">:"
    printf '  - %s\n' "${missing[@]}"
    echo "Embed a one-line description in each tool (rebuild from src/ if applicable)."
  } >&2
  exit 1
fi

# ── Helpers ──────────────────────────────────────────────────────────────────
desc_of() {
  case "$1" in
    *.html)
      grep -oiE '<meta[[:space:]]+name="description"[[:space:]]+content="[^"]*"' "$1" \
        | head -1 | sed -E 's/.*content="([^"]*)".*/\1/' ;;
    *.xlsm)
      printf 'Excel working template (.xlsm) for the cash-clearing reconciliation — company file %s.' \
        "$(basename "$1" .xlsm | sed -E 's/.*_//')" ;;
  esac
}

title_of() {
  grep -oiE '<title>[^<]*</title>' "$1" | head -1 \
    | sed -E 's#</?title>##gI; s/^[[:space:]]+//; s/[[:space:]]+$//'
}

changes_of() {
  local f="$1" logs n
  logs=$(git log --follow --no-merges --pretty=format:'%s' "${prev}..HEAD" -- "$f" 2>/dev/null \
    | awk 'NF && !seen[$0]++')
  if [ -z "$logs" ]; then
    echo "_No changes in this release._"
    return
  fi
  n=$(printf '%s\n' "$logs" | grep -c .)
  printf '%s\n' "$logs" | head -8 | sed -E 's/^/- /'
  if [ "$n" -gt 8 ]; then
    echo "- …plus general fixes and improvements ($((n - 8)) more)"
  fi
}

# ── Body ─────────────────────────────────────────────────────────────────────
clean="${DISPLAY% – Latest}"
echo "Latest **${clean}** — offline, single-file tools. Download what you need and double-click to open; nothing leaves your machine."
echo
if [ -z "$prev" ]; then
  echo "_First published release — no prior version to compare against._"
else
  echo "_Each tool below lists what changed since the previous published release._"
fi
echo

for f in "${files[@]}"; do
  case "$f" in
    *.html) name=$(title_of "$f"); [ -z "$name" ] && name=$(basename "$f") ;;
    *)      name=$(basename "$f") ;;
  esac
  echo "### ${name}"
  echo "\`${f}\`"
  echo
  echo "$(desc_of "$f")"
  echo
  if [ -n "$prev" ]; then
    echo "**What's new:**"
    echo
    changes_of "$f"
    echo
  fi
done
