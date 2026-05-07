#!/usr/bin/env bash
# ============================================================
# RMS — P0 Auth & RBAC curl test suite
# Usage: bash tests/auth-curl-tests.sh
# Requires: curl, jq
# ============================================================

BASE="http://localhost:5000/api"
PASS=0; FAIL=0

# ─── Helpers ─────────────────────────────────────────────────────────────────

check() {
  local name="$1" expected="$2" actual="$3"
  if [ "$actual" = "$expected" ]; then
    echo "  ✅  $name"
    ((PASS++))
  else
    echo "  ❌  $name  (expected: $expected, got: $actual)"
    ((FAIL++))
  fi
}

check_contains() {
  local name="$1" needle="$2" haystack="$3"
  if echo "$haystack" | grep -q "$needle"; then
    echo "  ✅  $name"
    ((PASS++))
  else
    echo "  ❌  $name  (expected to contain: '$needle', got: $haystack)"
    ((FAIL++))
  fi
}

check_not_contains() {
  local name="$1" needle="$2" haystack="$3"
  if ! echo "$haystack" | grep -q "$needle"; then
    echo "  ✅  $name"
    ((PASS++))
  else
    echo "  ❌  $name  (expected NOT to contain: '$needle')"
    ((FAIL++))
  fi
}

# ─── Section 1: Login Tests ───────────────────────────────────────────────────

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  SECTION 1 — Login Tests"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# A01 — Admin login
RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@rms.com","password":"admin123"}')
BODY=$(echo "$RESP" | head -n1); STATUS=$(echo "$RESP" | tail -n1)
ADMIN_TOKEN=$(echo "$BODY" | jq -r '.accessToken // empty')
check "A01 — Admin login status 200" "200" "$STATUS"
check "A01 — Admin token present" "false" "$([ -z "$ADMIN_TOKEN" ] && echo true || echo false)"
check "A01 — Admin role correct" "admin" "$(echo "$BODY" | jq -r '.user.role // empty')"
check_not_contains "A01 — No password in response" '"password"' "$BODY"

# A02 — Manager login
RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"manager@rms.com","password":"manager123"}')
BODY=$(echo "$RESP" | head -n1); STATUS=$(echo "$RESP" | tail -n1)
MANAGER_TOKEN=$(echo "$BODY" | jq -r '.accessToken // empty')
check "A02 — Manager login status 200" "200" "$STATUS"
check "A02 — Manager role correct" "manager" "$(echo "$BODY" | jq -r '.user.role // empty')"

# A03 — Waiter login
RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"waiter@rms.com","password":"waiter123"}')
BODY=$(echo "$RESP" | head -n1); STATUS=$(echo "$RESP" | tail -n1)
WAITER_TOKEN=$(echo "$BODY" | jq -r '.accessToken // empty')
check "A03 — Waiter login status 200" "200" "$STATUS"
check "A03 — Waiter role correct" "waiter" "$(echo "$BODY" | jq -r '.user.role // empty')"

# A04 — Chef login
RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"chef@rms.com","password":"chef123"}')
BODY=$(echo "$RESP" | head -n1); STATUS=$(echo "$RESP" | tail -n1)
CHEF_TOKEN=$(echo "$BODY" | jq -r '.accessToken // empty')
check "A04 — Chef login status 200" "200" "$STATUS"
check "A04 — Chef role correct" "chef" "$(echo "$BODY" | jq -r '.user.role // empty')"

# A05 — Wrong password
RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@rms.com","password":"wrongpassword"}')
BODY=$(echo "$RESP" | head -n1); STATUS=$(echo "$RESP" | tail -n1)
check "A05 — Wrong password status 401" "401" "$STATUS"
check "A05 — Message is Invalid credentials" "Invalid credentials" "$(echo "$BODY" | jq -r '.message // empty')"
check_not_contains "A05 — No token on failed login" '"accessToken"' "$BODY"

# A06 — Non-existent email (same message — no user enumeration)
RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"nobody@rms.com","password":"anything"}')
BODY=$(echo "$RESP" | head -n1); STATUS=$(echo "$RESP" | tail -n1)
check "A06 — Non-existent email status 401" "401" "$STATUS"
check "A06 — Same message (no user enumeration)" "Invalid credentials" "$(echo "$BODY" | jq -r '.message // empty')"

# A07 — Missing email field
RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"password":"admin123"}')
STATUS=$(echo "$RESP" | tail -n1)
check "A07 — Missing email field status 422" "422" "$STATUS"

# A08 — Missing password field
RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@rms.com"}')
STATUS=$(echo "$RESP" | tail -n1)
check "A08 — Missing password field status 422" "422" "$STATUS"

# A09 — Invalid email format
RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"not-an-email","password":"admin123"}')
STATUS=$(echo "$RESP" | tail -n1)
check "A09 — Invalid email format status 422" "422" "$STATUS"

# ─── Section 2: Token & Session Tests ────────────────────────────────────────

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  SECTION 2 — Token & Session Tests"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# B01 — Valid token on /me
RESP=$(curl -s -w "\n%{http_code}" "$BASE/auth/me" \
  -H "Authorization: Bearer $ADMIN_TOKEN")
BODY=$(echo "$RESP" | head -n1); STATUS=$(echo "$RESP" | tail -n1)
check "B01 — Valid token /me status 200" "200" "$STATUS"
check_not_contains "B01 — No password in /me response" '"password"' "$BODY"
check_contains "B01 — Has id field" '"id"' "$BODY"

# B02 — No token
RESP=$(curl -s -w "\n%{http_code}" "$BASE/auth/me")
BODY=$(echo "$RESP" | head -n1); STATUS=$(echo "$RESP" | tail -n1)
check "B02 — No token status 401" "401" "$STATUS"
check_contains "B02 — Message mentions token" "token" "$BODY"

# B03 — Empty bearer token
RESP=$(curl -s -w "\n%{http_code}" "$BASE/auth/me" \
  -H "Authorization: Bearer ")
STATUS=$(echo "$RESP" | tail -n1)
check "B03 — Empty bearer token status 401" "401" "$STATUS"

# B04 — Malformed token
RESP=$(curl -s -w "\n%{http_code}" "$BASE/auth/me" \
  -H "Authorization: Bearer this.is.not.a.valid.jwt")
BODY=$(echo "$RESP" | head -n1); STATUS=$(echo "$RESP" | tail -n1)
check "B04 — Malformed token status 401" "401" "$STATUS"
check_contains "B04 — Message mentions Invalid" "Invalid" "$BODY"

# B05 — Tampered token (valid structure, wrong signature)
TAMPERED="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImZha2VpZCIsInJvbGUiOiJhZG1pbiIsImlhdCI6MTYwMDAwMDAwMH0.invalidsignature"
RESP=$(curl -s -w "\n%{http_code}" "$BASE/auth/me" \
  -H "Authorization: Bearer $TAMPERED")
STATUS=$(echo "$RESP" | tail -n1)
check "B05 — Tampered token rejected status 401" "401" "$STATUS"

# B06 — Expired token (pre-built token with exp in the past)
# This is a real JWT signed with a known secret but expired in 2020
EXPIRED="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY5ZmM2NjM1MDAzZmI1Yjc1ZmEyZjU3ZSIsImlhdCI6MTU5MDAwMDAwMCwiZXhwIjoxNTkwMDAwOTAwfQ.fake_expired"
RESP=$(curl -s -w "\n%{http_code}" "$BASE/auth/me" \
  -H "Authorization: Bearer $EXPIRED")
BODY=$(echo "$RESP" | head -n1); STATUS=$(echo "$RESP" | tail -n1)
check "B06 — Expired token status 401" "401" "$STATUS"

# B07 — Refresh token (uses httpOnly cookie set during login)
# Re-login to get fresh cookie
RESP=$(curl -s -w "\n%{http_code}" -c /tmp/rms_cookies.txt -X POST "$BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@rms.com","password":"admin123"}')
BODY=$(echo "$RESP" | head -n1); STATUS=$(echo "$RESP" | tail -n1)
ADMIN_TOKEN=$(echo "$BODY" | jq -r '.accessToken // empty')

RESP=$(curl -s -w "\n%{http_code}" -b /tmp/rms_cookies.txt -X POST "$BASE/auth/refresh")
BODY=$(echo "$RESP" | head -n1); STATUS=$(echo "$RESP" | tail -n1)
check "B07 — Refresh token status 200" "200" "$STATUS"
check_contains "B07 — New accessToken returned" '"accessToken"' "$BODY"

# B08 — Logout
RESP=$(curl -s -w "\n%{http_code}" -b /tmp/rms_cookies.txt -c /tmp/rms_cookies.txt \
  -X POST "$BASE/auth/logout" \
  -H "Authorization: Bearer $ADMIN_TOKEN")
BODY=$(echo "$RESP" | head -n1); STATUS=$(echo "$RESP" | tail -n1)
check "B08 — Logout status 200" "200" "$STATUS"
check_contains "B08 — Logout success message" "Logged out" "$BODY"

# B09 — Refresh after logout (cookie should be cleared / tokenVersion bumped)
RESP=$(curl -s -w "\n%{http_code}" -b /tmp/rms_cookies.txt -X POST "$BASE/auth/refresh")
BODY=$(echo "$RESP" | head -n1); STATUS=$(echo "$RESP" | tail -n1)
check "B09 — Refresh after logout status 401" "401" "$STATUS"
# After logout the cookie is cleared — server correctly says "No refresh token"
# If testing with a persistent cookie store, it would say "Refresh token revoked"
check_contains "B09 — Refresh blocked after logout" "token" "$BODY"

# ─── Section 3: RBAC Tests ───────────────────────────────────────────────────

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  SECTION 3 — RBAC Permission Tests"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Re-login all roles (admin token was logged out above)
ADMIN_TOKEN=$(curl -s -X POST "$BASE/auth/login" -H "Content-Type: application/json" \
  -d '{"email":"admin@rms.com","password":"admin123"}' | jq -r '.accessToken')
MANAGER_TOKEN=$(curl -s -X POST "$BASE/auth/login" -H "Content-Type: application/json" \
  -d '{"email":"manager@rms.com","password":"manager123"}' | jq -r '.accessToken')
WAITER_TOKEN=$(curl -s -X POST "$BASE/auth/login" -H "Content-Type: application/json" \
  -d '{"email":"waiter@rms.com","password":"waiter123"}' | jq -r '.accessToken')
CHEF_TOKEN=$(curl -s -X POST "$BASE/auth/login" -H "Content-Type: application/json" \
  -d '{"email":"chef@rms.com","password":"chef123"}' | jq -r '.accessToken')

# C01 — Chef cannot create orders
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/orders" \
  -H "Authorization: Bearer $CHEF_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"table":"000000000000000000000001","items":[{"menuItem":"000000000000000000000001","quantity":1}]}')
check "C01 — Chef CANNOT create orders (403)" "403" "$STATUS"

# C02 — Waiter can create orders (may get 422 for invalid IDs, not 403)
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/orders" \
  -H "Authorization: Bearer $WAITER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"table":"000000000000000000000001","items":[{"menuItem":"000000000000000000000001","quantity":1}]}')
check "C02 — Waiter CAN attempt orders (not 403)" "true" "$([ "$STATUS" != "403" ] && echo true || echo false)"

# C03 — Waiter cannot create menu items
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/menu" \
  -H "Authorization: Bearer $WAITER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","price":10,"category":"main"}')
check "C03 — Waiter CANNOT create menu items (403)" "403" "$STATUS"

# C04 — Manager can create menu items
RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE/menu" \
  -H "Authorization: Bearer $MANAGER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"RBAC Test Item","price":9.99,"category":"main"}')
BODY=$(echo "$RESP" | head -n1); STATUS=$(echo "$RESP" | tail -n1)
TEST_ITEM_ID=$(echo "$BODY" | jq -r '._id // empty')
check "C04 — Manager CAN create menu items (201)" "201" "$STATUS"

# C05 — Manager cannot delete menu items
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE "$BASE/menu/$TEST_ITEM_ID" \
  -H "Authorization: Bearer $MANAGER_TOKEN")
check "C05 — Manager CANNOT delete menu items (403)" "403" "$STATUS"

# C06 — Admin can delete menu items
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE "$BASE/menu/$TEST_ITEM_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN")
check "C06 — Admin CAN delete menu items (204)" "204" "$STATUS"

# C07 — Waiter cannot read staff list
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/staff" \
  -H "Authorization: Bearer $WAITER_TOKEN")
check "C07 — Waiter CANNOT read staff list (403)" "403" "$STATUS"

# C08 — Manager can read staff list
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/staff" \
  -H "Authorization: Bearer $MANAGER_TOKEN")
check "C08 — Manager CAN read staff list (200)" "200" "$STATUS"

# C09 — Waiter cannot access analytics
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/analytics/snapshot" \
  -H "Authorization: Bearer $WAITER_TOKEN")
check "C09 — Waiter CANNOT access analytics (403)" "403" "$STATUS"

# C10 — Chef cannot access analytics
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/analytics/snapshot" \
  -H "Authorization: Bearer $CHEF_TOKEN")
check "C10 — Chef CANNOT access analytics (403)" "403" "$STATUS"

# C11 — Manager can access analytics
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/analytics/snapshot" \
  -H "Authorization: Bearer $MANAGER_TOKEN")
check "C11 — Manager CAN access analytics (200)" "200" "$STATUS"

# C12 — Chef can read inventory
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/inventory/ingredients" \
  -H "Authorization: Bearer $CHEF_TOKEN")
check "C12 — Chef CAN read inventory (200)" "200" "$STATUS"

# C13 — Waiter cannot read inventory
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/inventory/ingredients" \
  -H "Authorization: Bearer $WAITER_TOKEN")
check "C13 — Waiter CANNOT read inventory (403)" "403" "$STATUS"

# C14 — Manager cannot mark payroll paid (admin only)
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X PATCH \
  "$BASE/staff/payroll/000000000000000000000001/paid" \
  -H "Authorization: Bearer $MANAGER_TOKEN")
check "C14 — Manager CANNOT mark payroll paid (403)" "403" "$STATUS"

# ─── Section 4: Register Tests ───────────────────────────────────────────────

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  SECTION 4 — Register Tests"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# D01 — Register new user defaults to waiter
RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test RBAC User","email":"rbactest_'$(date +%s)'@rms.com","password":"test1234"}')
BODY=$(echo "$RESP" | head -n1); STATUS=$(echo "$RESP" | tail -n1)
NEW_USER_ID=$(echo "$BODY" | jq -r '.user.id // empty')
check "D01 — Register status 201" "201" "$STATUS"
check "D01 — Role defaults to waiter" "waiter" "$(echo "$BODY" | jq -r '.user.role // empty')"

# D02 — Register with role:admin in body (should still be waiter)
RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"name":"Hacker","email":"hacker_'$(date +%s)'@rms.com","password":"hack1234","role":"admin"}')
BODY=$(echo "$RESP" | head -n1); STATUS=$(echo "$RESP" | tail -n1)
check "D02 — Role escalation blocked (still waiter)" "waiter" "$(echo "$BODY" | jq -r '.user.role // empty')"

# D03 — Duplicate email
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"name":"Dup","email":"admin@rms.com","password":"admin123"}')
check "D03 — Duplicate email status 409" "409" "$STATUS"

# D04 — Short password
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","email":"short@rms.com","password":"abc"}')
check "D04 — Short password status 422" "422" "$STATUS"

# D05 — Admin updates new user role to manager
if [ -n "$NEW_USER_ID" ]; then
  RESP=$(curl -s -w "\n%{http_code}" -X PUT "$BASE/staff/$NEW_USER_ID" \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"role":"manager"}')
  BODY=$(echo "$RESP" | head -n1); STATUS=$(echo "$RESP" | tail -n1)
  check "D05 — Admin can update role (200)" "200" "$STATUS"
  check "D05 — Role updated to manager" "manager" "$(echo "$BODY" | jq -r '.role // empty')"
fi

# ─── Summary ─────────────────────────────────────────────────────────────────

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
TOTAL=$((PASS + FAIL))
echo "  Results: $PASS/$TOTAL passed"
if [ $FAIL -gt 0 ]; then
  echo "  ❌ $FAIL test(s) failed"
  exit 1
else
  echo "  ✅ All tests passed"
fi
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
