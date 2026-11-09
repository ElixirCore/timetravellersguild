#!/usr/bin/env bash
set -euo pipefail
tmp=$(mktemp)
for p in "$@"; do
  if [ -d "$p" ]; then
    find "$p" -type f \( -name '*.php' -o -name '*.js' -o -name '*.css' -o -name '*.md' -o -name '*.json' -o -name '*.html' \) | sort | while IFS= read -r f; do
      printf '\n=== %s ===\n' "$f"; cat "$f"
    done
  else
    printf '\n=== %s ===\n' "$p"; cat "$p"
  fi
done > "$tmp"
n=$(wc -l < "$tmp" | tr -d ' ')
printf '%s lines\n' "$n"
[ "$n" -gt 4000 ] && printf 'BIG — split the argument list\n'
gh gist create --filename reveal.txt "$tmp" | tail -1
