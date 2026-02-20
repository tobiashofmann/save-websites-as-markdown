#!/usr/bin/env bash
set -euo pipefail

# get-links.sh - Extract links from a webpage using wget + parsing
# Usage examples:
#   ./get-links.sh https://example.com
#   ./get-links.sh -a href,src -u -S https://example.com
#   ./get-links.sh -a href -r 'pdf$' https://example.com
#   ./get-links.sh --spider -l 1 -S https://example.com

show_help() {
  cat <<'EOF'
Usage:
  get-links.sh [options] URL

Options:
  -a, --attrs LIST         Attributes to extract (comma-separated). Default: href
                          Examples: href   or   href,src
  -u, --unique            Deduplicate output (stable sort). Default: off
  -S, --same-domain       Keep only URLs on the same domain as URL. Default: off
  -r, --regex REGEX       Filter extracted URLs by regex (grep -E). Default: no filter
  -x, --exclude REGEX     Exclude extracted URLs by regex (grep -E). Default: no exclude
  -t, --timeout SECONDS   wget timeout. Default: 20
  --user-agent UA         Custom User-Agent. Default: Wget
  --spider                Use wget spider mode to discover links (not HTML parsing).
  -l, --level N           Spider recursion depth (only with --spider). Default: 1
  -h, --help              Show help

Output:
  Prints one URL per line to stdout.

Notes:
  - HTML parsing is best-effort (works well for typical href/src patterns).
  - For JS-rendered sites, you may need a headless browser instead.
EOF
}

attrs="href"
unique=0
same_domain=0
regex=""
exclude=""
timeout=20
ua="Wget"
spider=0
level=1

# --- argument parsing ---
url=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    -a|--attrs) attrs="${2:-}"; shift 2 ;;
    -u|--unique) unique=1; shift ;;
    -S|--same-domain) same_domain=1; shift ;;
    -r|--regex) regex="${2:-}"; shift 2 ;;
    -x|--exclude) exclude="${2:-}"; shift 2 ;;
    -t|--timeout) timeout="${2:-}"; shift 2 ;;
    --user-agent) ua="${2:-}"; shift 2 ;;
    --spider) spider=1; shift ;;
    -l|--level) level="${2:-}"; shift 2 ;;
    -h|--help) show_help; exit 0 ;;
    -*)
      echo "Unknown option: $1" >&2
      show_help
      exit 2
      ;;
    *)
      url="$1"; shift ;;
  esac
done

if [[ -z "${url}" ]]; then
  echo "Error: URL is required." >&2
  show_help
  exit 2
fi

# --- helpers ---
# Extract scheme://host[:port] and base path
get_origin() {
  local u="$1"
  # shellcheck disable=SC2001
  echo "$u" | sed -E 's#(https?://[^/]+).*#\1#'
}

get_host() {
  local u="$1"
  echo "$u" | sed -E 's#https?://([^/]+).*#\1#'
}

get_base_dir() {
  local u="$1"
  # If URL ends with '/', base dir is itself; else strip filename
  if [[ "$u" =~ /$ ]]; then
    echo "$u"
  else
    echo "$u" | sed -E 's#(https?://.*/)[^/]*$#\1#'
  fi
}

is_absolute() {
  [[ "$1" =~ ^https?:// ]]
}

normalize_url() {
  local raw="$1"
  # Trim surrounding quotes/spaces
  raw="${raw%\"}"; raw="${raw#\"}"
  raw="${raw%\'}"; raw="${raw#\'}"
  raw="$(echo -n "$raw" | sed -E 's/^[[:space:]]+|[[:space:]]+$//g')"
  echo -n "$raw"
}

resolve_url() {
  local link="$1"
  local origin="$2"
  local base="$3"

  link="$(normalize_url "$link")"
  [[ -z "$link" ]] && return 0

  # ignore non-web schemes and fragments
  if [[ "$link" =~ ^(#|javascript:|mailto:|tel:|data:) ]]; then
    return 0
  fi

  # Protocol-relative
  if [[ "$link" =~ ^// ]]; then
    echo "${origin%%://*}://$(get_host "$origin")${link#//}" | sed -E 's#(https?://[^/]+)//+#\1/#g'
    return 0
  fi

  # Absolute
  if is_absolute "$link"; then
    echo "$link"
    return 0
  fi

  # Root-relative
  if [[ "$link" =~ ^/ ]]; then
    echo "${origin}${link}" | sed -E 's#(https?://[^/]+)//+#\1/#g'
    return 0
  fi

  # Relative to base
  echo "${base}${link}" | sed -E 's#(https?://[^/]+)//+#\1/#g'
}

# --- main ---
origin="$(get_origin "$url")"
base="$(get_base_dir "$url")"
host="$(get_host "$url")"

if [[ $spider -eq 1 ]]; then
  # Discover links via wget spider (not HTML parsing)
  # Parse discovered URLs from wget stderr output lines starting with '--'
  # Example: --2026-...--  https://example.com/foo
  output="$(wget --spider --force-html -r -l "$level" \
    --timeout="$timeout" --user-agent="$ua" \
    "$url" 2>&1 | awk '/^--/{print $3}')"

  links="$output"
else
  # Fetch HTML and extract attrs from tags (href/src best-effort)
  # This captures patterns like: href="..." or src='...'
  html="$(wget -q --timeout="$timeout" --user-agent="$ua" -O - "$url" || true)"

  # Build grep regex for selected attributes
  # Converts "href,src" -> (href|src)
  attr_re="$(echo "$attrs" | tr ',' '|' | sed -E 's/[^a-zA-Z0-9|]//g')"
  [[ -z "$attr_re" ]] && attr_re="href"

  raw_links="$(printf "%s" "$html" \
    | grep -Eoi "(${attr_re})[[:space:]]*=[[:space:]]*(['\"][^'\"]+['\"])" \
    | sed -E "s/^(${attr_re})[[:space:]]*=[[:space:]]*['\"]([^'\"]+)['\"]/\\2/i")"

  # Resolve to absolute
  links="$(while IFS= read -r l; do
    resolve_url "$l" "$origin" "$base" || true
  done <<< "$raw_links")"
fi

# Filter same domain if requested
if [[ $same_domain -eq 1 ]]; then
  links="$(printf "%s\n" "$links" | grep -E "^https?://(${host//./\\.})(/|$)")"
fi

# Apply include/exclude filters if set
if [[ -n "$regex" ]]; then
  links="$(printf "%s\n" "$links" | grep -E "$regex" || true)"
fi
if [[ -n "$exclude" ]]; then
  links="$(printf "%s\n" "$links" | grep -Ev "$exclude" || true)"
fi

# Deduplicate if requested
if [[ $unique -eq 1 ]]; then
  # stable unique (keeps first occurrence)
  links="$(printf "%s\n" "$links" | awk '!seen[$0]++')"
fi

# Print non-empty lines
printf "%s\n" "$links" | sed '/^$/d'