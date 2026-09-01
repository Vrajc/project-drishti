#!/bin/sh
# check-no-mocks.sh — fail the build if fabricated data is present in the product.
#
# Drishti's one non-negotiable rule: if a number reaches a user, it must come from a real
# detection, a real database row, or a real computation. This script is the automated half
# of that rule. It greps the application source for the shapes fabrication takes and exits
# non-zero on any hit that is not explicitly allowlisted.
#
#   ./scripts/check-no-mocks.sh          list every hit and exit 1 if there are any
#   ./scripts/check-no-mocks.sh --count  print just the hit count (still exits 1 on hits)
#
# Exemptions live in scripts/no-mocks-allowlist.txt, one reasoned line each. Read the
# header of that file before adding one.

set -u

REPO_ROOT=$(cd "$(dirname "$0")/.." && pwd)
cd "$REPO_ROOT" || exit 2

ALLOWLIST="scripts/no-mocks-allowlist.txt"
COUNT_ONLY=0
[ "${1:-}" = "--count" ] && COUNT_ONLY=1

# Directories we scan: application source only. Docs describe the problem and must be able
# to name it; scripts/ contains this checker and its allowlist.
SEARCH_PATHS="backend/src frontend/src"
[ -d ai-service ] && SEARCH_PATHS="$SEARCH_PATHS ai-service"

# The patterns. Case-insensitive for the words; Math.random is matched literally.
#   Math.random  — a measurement that is a coin flip
#   mock/dummy/fake/stub(bed) — a generator or a value standing in for a real one
#   hardcode(d)  — an admission in a comment that a value was pinned
#   "to be implemented" — a route that answers with a promise instead of data
PATTERN='Math\.random|mock|dummy|fake|hardcode|to be implemented'

EXCLUDES='--exclude-dir=node_modules --exclude-dir=dist --exclude-dir=build
          --exclude-dir=.git --exclude-dir=__pycache__ --exclude-dir=generated
          --exclude-dir=.vite --exclude-dir=venv --exclude-dir=coverage
          --exclude=*.map --exclude=*.snap --exclude=*.md'

# Test files are exempt: a test may legitimately construct a fixture named "fake".
TEST_RE='(\.test\.|\.spec\.|/__tests__/|/tests?/|conftest\.py)'

raw=$(mktemp) || exit 2
hits=$(mktemp) || exit 2
trap 'rm -f "$raw" "$hits"' EXIT INT TERM

# shellcheck disable=SC2086
grep -rIniE "$PATTERN" $EXCLUDES $SEARCH_PATHS 2>/dev/null \
  | grep -vE "$TEST_RE" \
  > "$raw" || true

# Apply the allowlist. Each entry suppresses a hit only when the path substring AND the
# line regex both match, so an exemption stays pinned to the thing it was written for.
: > "$hits"
suppressed=0

while IFS= read -r hit; do
  hit_path=${hit%%:*}
  hit_text=${hit#*:}          # strip path
  hit_text=${hit_text#*:}     # strip line number
  allowed=0

  if [ -f "$ALLOWLIST" ]; then
    while IFS= read -r entry; do
      case "$entry" in ''|\#*) continue ;; esac

      a_path=$(printf '%s' "$entry" | awk -F'|' '{ gsub(/^[ \t]+|[ \t]+$/, "", $1); print $1 }')
      a_re=$(printf   '%s' "$entry" | awk -F'|' '{ gsub(/^[ \t]+|[ \t]+$/, "", $2); print $2 }')
      [ -z "$a_path" ] || [ -z "$a_re" ] && continue

      case "$hit_path" in
        *"$a_path"*)
          if printf '%s' "$hit_text" | grep -qE "$a_re"; then
            allowed=1
            break
          fi
          ;;
      esac
    done < "$ALLOWLIST"
  fi

  if [ "$allowed" -eq 1 ]; then
    suppressed=$((suppressed + 1))
  else
    printf '%s\n' "$hit" >> "$hits"
  fi
done < "$raw"

total=$(wc -l < "$hits" | tr -d ' ')

if [ "$COUNT_ONLY" -eq 1 ]; then
  printf '%s\n' "$total"
  [ "$total" -eq 0 ] && exit 0 || exit 1
fi

if [ "$total" -eq 0 ]; then
  printf 'check-no-mocks: PASS — no fabricated data found (%s allowlisted).\n' "$suppressed"
  exit 0
fi

printf 'check-no-mocks: FAIL — %s occurrence(s) of fabricated data (%s allowlisted).\n\n' \
  "$total" "$suppressed"

# Group by file so the output reads as a work list rather than a wall of grep.
cut -d: -f1 "$hits" | sort -u | while IFS= read -r f; do
  n=$(grep -c "^$f:" "$hits")
  printf '  %s  (%s)\n' "$f" "$n"
  grep "^$f:" "$hits" | while IFS= read -r line; do
    ln=$(printf '%s' "$line" | cut -d: -f2)
    txt=$(printf '%s' "$line" | cut -d: -f3- | sed 's/^[ \t]*//' | cut -c1-100)
    printf '      %s: %s\n' "$ln" "$txt"
  done
done

cat <<'EOF'

Every hit above must be removed, not relabelled. If the real value is not available yet,
render an explicit empty state ("No camera assigned", "Awaiting first detection") — never a
plausible-looking invented number. Exemptions belong in scripts/no-mocks-allowlist.txt and
are limited to animation, particle effects and identifier generation.
EOF

exit 1
