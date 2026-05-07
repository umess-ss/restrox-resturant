#!/usr/bin/env bash
# ============================================================
# RMS — P1 Menu & Tables curl test suite
# Usage: bash tests/menu-tables-curl-tests.sh
# Requires: curl, jq
# ============================================================

BASE="http://localhost:5000/api"
PASS=0; FAIL=0

# ─── Helpers (same as P0) ─────────────────────────────────────────────────────

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
    echo "  ❌  $name  (expected to contain: '$needle')"
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

check_gt() {
  local name="$1" val="$2" threshold="$3"
  if awk "BEGIN {exit !($val > $threshold)}"; then
    echo "  ✅  $name ($val > $threshold)"
    ((PASS++))
  else
    echo "  ❌  $name  (expected $val > $threshold)"
    ((FAIL++))
  fi
}

check_eq_num() {
  local name="$1" expected="$2" actual="$3"
  # Use awk for numeric comparison — handles floating point correctly
  if awk "BEGIN {exit !($actual == $expected)}"; then
    echo "  ✅  $name"
    ((PASS++))
  else
    echo "  ❌  $name  (expected: $expected, got: $actual)"
    ((FAIL++))
  fi
}

# ─── Setup: login all roles ───────────────────────────────────────────────────

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  SETUP — Authenticating all roles"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

ADMIN_TOKEN=$(curl -s -X POST "$BASE/auth/login" -H "Content-Type: application/json" \
  -d '{"email":"admin@rms.com","password":"admin123"}' | jq -r '.accessToken')
MANAGER_TOKEN=$(curl -s -X POST "$BASE/auth/login" -H "Content-Type: application/json" \
  -d '{"email":"manager@rms.com","password":"manager123"}' | jq -r '.accessToken')
WAITER_TOKEN=$(curl -s -X POST "$BASE/auth/login" -H "Content-Type: application/json" \
  -d '{"email":"waiter@rms.com","password":"waiter123"}' | jq -r '.accessToken')

[ -n "$ADMIN_TOKEN" ]   && echo "  ✅  Admin token acquired" || echo "  ❌  Admin login failed — aborting"
[ -n "$MANAGER_TOKEN" ] && echo "  ✅  Manager token acquired" || echo "  ❌  Manager login failed"
[ -n "$WAITER_TOKEN" ]  && echo "  ✅  Waiter token acquired" || echo "  ❌  Waiter login failed"

if [ -z "$ADMIN_TOKEN" ]; then echo "Cannot continue without admin token."; exit 1; fi

# Grab real ingredient IDs from the seeded database
ING_RESP=$(curl -s "$BASE/inventory/ingredients" -H "Authorization: Bearer $ADMIN_TOKEN")
ING1=$(echo "$ING_RESP" | jq -r '.[0]._id')
ING2=$(echo "$ING_RESP" | jq -r '.[1]._id')
ING3=$(echo "$ING_RESP" | jq -r '.[2]._id')
ING1_COST=$(echo "$ING_RESP" | jq -r '.[0].costPerUnit')
ING2_COST=$(echo "$ING_RESP" | jq -r '.[1].costPerUnit')

echo "  ✅  Ingredient IDs: $ING1, $ING2, $ING3"

# ─── Section 1: Menu CRUD ─────────────────────────────────────────────────────

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  SECTION 1 — Menu Item CRUD"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# M01 — Create menu item (manager)
RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE/menu" \
  -H "Authorization: Bearer $MANAGER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"P1 Test Burger","price":14.50,"category":"main","description":"Test item for P1","preparationTime":12,"overheadCost":1.20}')
BODY=$(echo "$RESP" | head -n1); STATUS=$(echo "$RESP" | tail -n1)
ITEM_ID=$(echo "$BODY" | jq -r '._id // empty')
check "M01 — Create menu item status 201" "201" "$STATUS"
check "M01 — Name matches" "P1 Test Burger" "$(echo "$BODY" | jq -r '.name // empty')"
check "M01 — Category is main" "main" "$(echo "$BODY" | jq -r '.category // empty')"
check "M01 — Price is 14.5" "14.5" "$(echo "$BODY" | jq -r '.price // empty')"
check "M01 — isAvailable defaults true" "true" "$(echo "$BODY" | jq -r '.isAvailable // empty')"
check "M01 — Has _id" "true" "$([ -n "$ITEM_ID" ] && echo true || echo false)"

# M02 — Create menu item with inline recipe (atomic)
RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE/menu" \
  -H "Authorization: Bearer $MANAGER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"P1 Recipe Item\",\"price\":18.00,\"category\":\"main\",\"overheadCost\":1.50,\"recipe\":[{\"ingredient\":\"$ING1\",\"quantity\":0.2},{\"ingredient\":\"$ING2\",\"quantity\":1}]}")
BODY=$(echo "$RESP" | head -n1); STATUS=$(echo "$RESP" | tail -n1)
RECIPE_ITEM_ID=$(echo "$BODY" | jq -r '._id // empty')
check "M02 — Create with recipe status 201" "201" "$STATUS"
check "M02 — Recipe is not null" "true" "$(echo "$BODY" | jq -r '.recipe != null' 2>/dev/null || echo false)"
check "M02 — Recipe has 2 ingredients" "2" "$(echo "$BODY" | jq -r '.recipe.ingredients | length' 2>/dev/null || echo 0)"

# M03 — Validation: missing name
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/menu" \
  -H "Authorization: Bearer $MANAGER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"price":10,"category":"main"}')
check "M03 — Missing name returns 422" "422" "$STATUS"

# M04 — Validation: negative price
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/menu" \
  -H "Authorization: Bearer $MANAGER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Bad Price","price":-5,"category":"main"}')
check "M04 — Negative price returns 422" "422" "$STATUS"

# M05 — Validation: invalid category
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/menu" \
  -H "Authorization: Bearer $MANAGER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Bad Cat","price":10,"category":"pizza"}')
check "M05 — Invalid category returns 422" "422" "$STATUS"

# M06 — Waiter cannot create menu item
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/menu" \
  -H "Authorization: Bearer $WAITER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Waiter Item","price":10,"category":"main"}')
check "M06 — Waiter cannot create menu item (403)" "403" "$STATUS"

# M07 — Get single menu item (public, no auth)
RESP=$(curl -s -w "\n%{http_code}" "$BASE/menu/$ITEM_ID")
BODY=$(echo "$RESP" | head -n1); STATUS=$(echo "$RESP" | tail -n1)
check "M07 — Get single item status 200" "200" "$STATUS"
check "M07 — Correct item returned" "P1 Test Burger" "$(echo "$BODY" | jq -r '.name // empty')"

# M08 — Get non-existent item
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/menu/000000000000000000000001")
check "M08 — Non-existent item returns 404" "404" "$STATUS"

# M09 — Update menu item price
RESP=$(curl -s -w "\n%{http_code}" -X PUT "$BASE/menu/$ITEM_ID" \
  -H "Authorization: Bearer $MANAGER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"price":16.00,"name":"P1 Test Burger Updated"}')
BODY=$(echo "$RESP" | head -n1); STATUS=$(echo "$RESP" | tail -n1)
check "M09 — Update item status 200" "200" "$STATUS"
check "M09 — Price updated to 16" "16" "$(echo "$BODY" | jq -r '.price // empty')"
check "M09 — Name updated" "P1 Test Burger Updated" "$(echo "$BODY" | jq -r '.name // empty')"

# ─── Section 2: Menu Filtering ────────────────────────────────────────────────

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  SECTION 2 — Menu Filtering"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# F01 — Get all menu items (public)
RESP=$(curl -s -w "\n%{http_code}" "$BASE/menu")
BODY=$(echo "$RESP" | head -n1); STATUS=$(echo "$RESP" | tail -n1)
TOTAL_COUNT=$(echo "$BODY" | jq 'length')
check "F01 — Get all items status 200" "200" "$STATUS"
check_gt "F01 — Returns at least 5 items" "$TOTAL_COUNT" "4"

# F02 — Filter by category=main
RESP=$(curl -s -w "\n%{http_code}" "$BASE/menu?category=main")
BODY=$(echo "$RESP" | head -n1); STATUS=$(echo "$RESP" | tail -n1)
MAIN_COUNT=$(echo "$BODY" | jq 'length')
NON_MAIN=$(echo "$BODY" | jq '[.[] | select(.category != "main")] | length')
check "F02 — Filter by category=main status 200" "200" "$STATUS"
check "F02 — All returned items are category=main" "0" "$NON_MAIN"
check_gt "F02 — At least 1 main item returned" "$MAIN_COUNT" "0"

# F03 — Filter by category=beverage
RESP=$(curl -s "$BASE/menu?category=beverage")
NON_BEV=$(echo "$RESP" | jq '[.[] | select(.category != "beverage")] | length')
check "F03 — Filter by category=beverage — no non-beverage items" "0" "$NON_BEV"

# F04 — Filter available=true
RESP=$(curl -s "$BASE/menu?available=true")
UNAVAIL=$(echo "$RESP" | jq '[.[] | select(.isAvailable != true)] | length')
check "F04 — available=true returns only available items" "0" "$UNAVAIL"

# F05 — Filter available=false (mark one item unavailable first)
curl -s -X PUT "$BASE/menu/$ITEM_ID" \
  -H "Authorization: Bearer $MANAGER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"isAvailable":false}' > /dev/null

RESP=$(curl -s "$BASE/menu?available=false")
AVAIL=$(echo "$RESP" | jq '[.[] | select(.isAvailable == true)] | length')
check "F05 — available=false returns only unavailable items" "0" "$AVAIL"
check_gt "F05 — At least 1 unavailable item returned" "$(echo "$RESP" | jq 'length')" "0"

# Restore availability
curl -s -X PUT "$BASE/menu/$ITEM_ID" \
  -H "Authorization: Bearer $MANAGER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"isAvailable":true}' > /dev/null

# F06 — Get menu with recipes (withRecipe=true)
RESP=$(curl -s -w "\n%{http_code}" "$BASE/menu?withRecipe=true")
BODY=$(echo "$RESP" | head -n1); STATUS=$(echo "$RESP" | tail -n1)
check "F06 — withRecipe=true status 200" "200" "$STATUS"
# Every item should have a recipe key (null or object, never missing)
MISSING_RECIPE_KEY=$(echo "$BODY" | jq '[.[] | select(has("recipe") | not)] | length')
check "F06 — Every item has recipe key" "0" "$MISSING_RECIPE_KEY"
# At least one item should have a non-null recipe (from seed data)
ITEMS_WITH_RECIPE=$(echo "$BODY" | jq '[.[] | select(.recipe != null)] | length')
check_gt "F06 — At least 1 item has a recipe" "$ITEMS_WITH_RECIPE" "0"

# ─── Section 3: Recipe Management ────────────────────────────────────────────

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  SECTION 3 — Recipe Management"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# R01 — Get recipe for item that has one (RECIPE_ITEM_ID was created with recipe in M02)
RESP=$(curl -s -w "\n%{http_code}" "$BASE/menu/$RECIPE_ITEM_ID/recipe" \
  -H "Authorization: Bearer $MANAGER_TOKEN")
BODY=$(echo "$RESP" | head -n1); STATUS=$(echo "$RESP" | tail -n1)
check "R01 — Get recipe status 200" "200" "$STATUS"
check "R01 — Recipe has ingredients array" "true" "$(echo "$BODY" | jq 'has("ingredients")' 2>/dev/null || echo false)"
check "R01 — Recipe has 2 ingredients" "2" "$(echo "$BODY" | jq '.ingredients | length' 2>/dev/null || echo 0)"
check "R01 — Ingredient has name populated" "true" "$(echo "$BODY" | jq '.ingredients[0].ingredient | has("name")' 2>/dev/null || echo false)"

# R02 — Get recipe for item with no recipe (ITEM_ID has no recipe)
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/menu/$ITEM_ID/recipe" \
  -H "Authorization: Bearer $MANAGER_TOKEN")
check "R02 — No recipe returns 404" "404" "$STATUS"

# R03 — Upsert recipe (add recipe to item that had none)
RESP=$(curl -s -w "\n%{http_code}" -X PUT "$BASE/menu/$ITEM_ID/recipe" \
  -H "Authorization: Bearer $MANAGER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"ingredients\":[{\"ingredient\":\"$ING1\",\"quantity\":0.25},{\"ingredient\":\"$ING2\",\"quantity\":1},{\"ingredient\":\"$ING3\",\"quantity\":0.05}],\"notes\":\"Test recipe\"}")
BODY=$(echo "$RESP" | head -n1); STATUS=$(echo "$RESP" | tail -n1)
check "R03 — Upsert recipe status 200" "200" "$STATUS"
check "R03 — Recipe has 3 ingredients" "3" "$(echo "$BODY" | jq '.recipe.ingredients | length' 2>/dev/null || echo 0)"
check "R03 — Diff object present" "true" "$(echo "$BODY" | jq 'has("diff")' 2>/dev/null || echo false)"
# First upsert — diff should show 3 added ingredients
ADDED_COUNT=$(echo "$BODY" | jq '.diff.added | length' 2>/dev/null || echo 0)
check_gt "R03 — Diff shows added ingredients" "$ADDED_COUNT" "0"

# R04 — Update recipe (change quantity — diff should show changed)
RESP=$(curl -s -w "\n%{http_code}" -X PUT "$BASE/menu/$ITEM_ID/recipe" \
  -H "Authorization: Bearer $MANAGER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"ingredients\":[{\"ingredient\":\"$ING1\",\"quantity\":0.30},{\"ingredient\":\"$ING2\",\"quantity\":1}],\"notes\":\"Updated recipe\"}")
BODY=$(echo "$RESP" | head -n1); STATUS=$(echo "$RESP" | tail -n1)
check "R04 — Update recipe status 200" "200" "$STATUS"
check "R04 — Recipe now has 2 ingredients" "2" "$(echo "$BODY" | jq '.recipe.ingredients | length' 2>/dev/null || echo 0)"
# ING3 was removed — diff.removed should have 1 entry
REMOVED_COUNT=$(echo "$BODY" | jq '.diff.removed | length' 2>/dev/null || echo 0)
check "R04 — Diff shows 1 removed ingredient" "1" "$REMOVED_COUNT"
# ING1 quantity changed — diff.changed should have 1 entry
CHANGED_COUNT=$(echo "$BODY" | jq '.diff.changed | length' 2>/dev/null || echo 0)
check "R04 — Diff shows 1 changed quantity" "1" "$CHANGED_COUNT"

# R05 — Recipe validation: empty ingredients array
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X PUT "$BASE/menu/$ITEM_ID/recipe" \
  -H "Authorization: Bearer $MANAGER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"ingredients":[]}')
check "R05 — Empty ingredients array returns 422" "422" "$STATUS"

# R06 — Recipe validation: invalid ingredient ID
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X PUT "$BASE/menu/$ITEM_ID/recipe" \
  -H "Authorization: Bearer $MANAGER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"ingredients":[{"ingredient":"not-a-mongo-id","quantity":1}]}')
check "R06 — Invalid ingredient ID returns 422" "422" "$STATUS"

# R07 — Recipe validation: quantity = 0
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X PUT "$BASE/menu/$ITEM_ID/recipe" \
  -H "Authorization: Bearer $MANAGER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"ingredients\":[{\"ingredient\":\"$ING1\",\"quantity\":0}]}")
check "R07 — Quantity 0 returns 422" "422" "$STATUS"

# ─── Section 4: Cost & Margin ─────────────────────────────────────────────────

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  SECTION 4 — Cost & Margin Calculations"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ITEM_ID now has recipe: ING1 × 0.30 + ING2 × 1
# ING1_COST and ING2_COST fetched at setup
# Expected ingredient cost = (ING1_COST * 0.30) + (ING2_COST * 1.0)
EXPECTED_ING_COST=$(awk "BEGIN {printf \"%.4f\", ($ING1_COST * 0.30) + ($ING2_COST * 1.0)}")
EXPECTED_OVERHEAD="1.2"
EXPECTED_TOTAL=$(awk "BEGIN {printf \"%.4f\", $EXPECTED_ING_COST + $EXPECTED_OVERHEAD}")

# C01 — Get cost breakdown
RESP=$(curl -s -w "\n%{http_code}" "$BASE/menu/$ITEM_ID/cost" \
  -H "Authorization: Bearer $MANAGER_TOKEN")
BODY=$(echo "$RESP" | head -n1); STATUS=$(echo "$RESP" | tail -n1)
check "C01 — Get cost status 200" "200" "$STATUS"
check "C01 — Has ingredientCost field" "true" "$(echo "$BODY" | jq 'has("ingredientCost")' 2>/dev/null || echo false)"
check "C01 — Has overheadCost field" "true" "$(echo "$BODY" | jq 'has("overheadCost")' 2>/dev/null || echo false)"
check "C01 — Has totalCost field" "true" "$(echo "$BODY" | jq 'has("totalCost")' 2>/dev/null || echo false)"
check "C01 — Has breakdown array" "true" "$(echo "$BODY" | jq 'has("breakdown")' 2>/dev/null || echo false)"
check "C01 — Breakdown has 2 items" "2" "$(echo "$BODY" | jq '.breakdown | length' 2>/dev/null || echo 0)"

ACTUAL_ING_COST=$(echo "$BODY" | jq -r '.ingredientCost // 0')
ACTUAL_OVERHEAD=$(echo "$BODY" | jq -r '.overheadCost // 0')
ACTUAL_TOTAL=$(echo "$BODY" | jq -r '.totalCost // 0')

check_eq_num "C01 — ingredientCost matches formula" "$EXPECTED_ING_COST" "$ACTUAL_ING_COST"
check_eq_num "C01 — overheadCost is 1.2" "$EXPECTED_OVERHEAD" "$ACTUAL_OVERHEAD"
check_eq_num "C01 — totalCost = ingredientCost + overhead" "$EXPECTED_TOTAL" "$ACTUAL_TOTAL"

# C02 — Get cost for item with no recipe
RESP=$(curl -s -w "\n%{http_code}" "$BASE/menu/$RECIPE_ITEM_ID/cost" \
  -H "Authorization: Bearer $MANAGER_TOKEN")
BODY=$(echo "$RESP" | head -n1); STATUS=$(echo "$RESP" | tail -n1)
check "C02 — Cost for item with recipe status 200" "200" "$STATUS"
check_gt "C02 — ingredientCost > 0 for item with recipe" "$(echo "$BODY" | jq -r '.ingredientCost // 0')" "0"

# C03 — Get profit margin
RESP=$(curl -s -w "\n%{http_code}" "$BASE/menu/$ITEM_ID/margin" \
  -H "Authorization: Bearer $MANAGER_TOKEN")
BODY=$(echo "$RESP" | head -n1); STATUS=$(echo "$RESP" | tail -n1)
check "C03 — Get margin status 200" "200" "$STATUS"
check "C03 — Has sellingPrice" "true" "$(echo "$BODY" | jq 'has("sellingPrice")' 2>/dev/null || echo false)"
check "C03 — Has grossProfit" "true" "$(echo "$BODY" | jq 'has("grossProfit")' 2>/dev/null || echo false)"
check "C03 — Has marginPct" "true" "$(echo "$BODY" | jq 'has("marginPct")' 2>/dev/null || echo false)"
check "C03 — sellingPrice is 16 (updated in M09)" "16" "$(echo "$BODY" | jq -r '.sellingPrice // empty')"

# Verify margin formula: marginPct = (grossProfit / sellingPrice) * 100
SELLING=$(echo "$BODY" | jq -r '.sellingPrice')
TOTAL_COST=$(echo "$BODY" | jq -r '.totalCost')
GROSS=$(echo "$BODY" | jq -r '.grossProfit')
MARGIN=$(echo "$BODY" | jq -r '.marginPct')
# Recompute expected values using awk (rounds correctly, unlike bc scale=2 which truncates)
EXPECTED_GROSS=$(awk "BEGIN {printf \"%.4f\", $SELLING - $TOTAL_COST}")
EXPECTED_MARGIN=$(awk "BEGIN {printf \"%.2f\", ($EXPECTED_GROSS / $SELLING) * 100}")
check_eq_num "C03 — grossProfit = sellingPrice - totalCost" "$EXPECTED_GROSS" "$GROSS"
check_eq_num "C03 — marginPct formula correct" "$EXPECTED_MARGIN" "$MARGIN"

# C04 — Margins analytics endpoint
RESP=$(curl -s -w "\n%{http_code}" "$BASE/menu/analytics/margins" \
  -H "Authorization: Bearer $MANAGER_TOKEN")
BODY=$(echo "$RESP" | head -n1); STATUS=$(echo "$RESP" | tail -n1)
check "C04 — Margins analytics status 200" "200" "$STATUS"
check "C04 — Has avgMargin field" "true" "$(echo "$BODY" | jq 'has("avgMargin")' 2>/dev/null || echo false)"
check "C04 — Has count field" "true" "$(echo "$BODY" | jq 'has("count")' 2>/dev/null || echo false)"
check "C04 — Has items array" "true" "$(echo "$BODY" | jq 'has("items")' 2>/dev/null || echo false)"
check_gt "C04 — At least 1 item in margins" "$(echo "$BODY" | jq '.count')" "0"

# Verify items are sorted by marginPct descending (first item >= second item)
FIRST_MARGIN=$(echo "$BODY" | jq -r '.items[0].marginPct // 0')
SECOND_MARGIN=$(echo "$BODY" | jq -r '.items[1].marginPct // 0')
SORTED=$(echo "$FIRST_MARGIN >= $SECOND_MARGIN" | bc -l 2>/dev/null)
check "C04 — Items sorted by margin descending" "1" "$SORTED"

# Items with no recipe should be at the end (marginPct = null)
LAST_ITEM_MARGIN=$(echo "$BODY" | jq -r '.items[-1].marginPct')
FIRST_ITEM_MARGIN=$(echo "$BODY" | jq -r '.items[0].marginPct')
check "C04 — First item has marginPct (not null)" "true" "$([ "$FIRST_ITEM_MARGIN" != "null" ] && echo true || echo false)"

# C05 — Margins analytics requires auth
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/menu/analytics/margins")
check "C05 — Margins analytics requires auth (401)" "401" "$STATUS"

# C06 — Waiter cannot access margins analytics
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/menu/analytics/margins" \
  -H "Authorization: Bearer $WAITER_TOKEN")
check "C06 — Waiter cannot access margins analytics (403)" "403" "$STATUS"

# ─── Section 5: Menu Delete ───────────────────────────────────────────────────

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  SECTION 5 — Menu Item Delete"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# D01 — Manager cannot delete (admin only)
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE "$BASE/menu/$ITEM_ID" \
  -H "Authorization: Bearer $MANAGER_TOKEN")
check "D01 — Manager cannot delete menu item (403)" "403" "$STATUS"

# D02 — Admin deletes item
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE "$BASE/menu/$ITEM_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN")
check "D02 — Admin deletes item (204)" "204" "$STATUS"

# D03 — Deleted item returns 404
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/menu/$ITEM_ID")
check "D03 — Deleted item returns 404" "404" "$STATUS"

# D04 — Recipe soft-deactivated after item delete
RESP=$(curl -s -w "\n%{http_code}" "$BASE/menu/$ITEM_ID/recipe" \
  -H "Authorization: Bearer $MANAGER_TOKEN")
STATUS=$(echo "$RESP" | tail -n1)
check "D04 — Recipe returns 404 after item delete" "404" "$STATUS"

# D05 — Delete non-existent item
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE "$BASE/menu/000000000000000000000001" \
  -H "Authorization: Bearer $ADMIN_TOKEN")
check "D05 — Delete non-existent item returns 404" "404" "$STATUS"

# Cleanup: delete the recipe item too
curl -s -o /dev/null -X DELETE "$BASE/menu/$RECIPE_ITEM_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# ─── Section 6: Tables CRUD ───────────────────────────────────────────────────

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  SECTION 6 — Tables CRUD"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# T01 — Create table (manager)
RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE/tables" \
  -H "Authorization: Bearer $MANAGER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"number":99,"capacity":4,"location":"indoor"}')
BODY=$(echo "$RESP" | head -n1); STATUS=$(echo "$RESP" | tail -n1)
TEST_TABLE_ID=$(echo "$BODY" | jq -r '._id // empty')
check "T01 — Create table status 201" "201" "$STATUS"
check "T01 — Table number is 99" "99" "$(echo "$BODY" | jq -r '.number // empty')"
check "T01 — Capacity is 4" "4" "$(echo "$BODY" | jq -r '.capacity // empty')"
check "T01 — Status defaults to available" "available" "$(echo "$BODY" | jq -r '.status // empty')"
check "T01 — Location is indoor" "indoor" "$(echo "$BODY" | jq -r '.location // empty')"
check "T01 — currentOrder is null" "null" "$(echo "$BODY" | jq -r '.currentOrder // "null"')"

# T02 — Duplicate table number blocked
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/tables" \
  -H "Authorization: Bearer $MANAGER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"number":99,"capacity":2,"location":"bar"}')
check "T02 — Duplicate table number blocked (409 or 500)" "true" \
  "$([ "$STATUS" = "409" ] || [ "$STATUS" = "500" ] && echo true || echo false)"

# T03 — Waiter cannot create table
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/tables" \
  -H "Authorization: Bearer $WAITER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"number":100,"capacity":2,"location":"bar"}')
check "T03 — Waiter cannot create table (403)" "403" "$STATUS"

# T04 — Get all tables (waiter)
RESP=$(curl -s -w "\n%{http_code}" "$BASE/tables" \
  -H "Authorization: Bearer $WAITER_TOKEN")
BODY=$(echo "$RESP" | head -n1); STATUS=$(echo "$RESP" | tail -n1)
check "T04 — Get tables status 200" "200" "$STATUS"
check_gt "T04 — Returns at least 1 table" "$(echo "$BODY" | jq 'length')" "0"

# T05 — Get single table
RESP=$(curl -s -w "\n%{http_code}" "$BASE/tables/$TEST_TABLE_ID" \
  -H "Authorization: Bearer $WAITER_TOKEN")
BODY=$(echo "$RESP" | head -n1); STATUS=$(echo "$RESP" | tail -n1)
check "T05 — Get single table status 200" "200" "$STATUS"
check "T05 — Correct table returned" "99" "$(echo "$BODY" | jq -r '.number // empty')"

# T06 — Filter tables by location
RESP=$(curl -s "$BASE/tables?location=indoor" \
  -H "Authorization: Bearer $WAITER_TOKEN")
NON_INDOOR=$(echo "$RESP" | jq '[.[] | select(.location != "indoor")] | length')
check "T06 — Filter by location=indoor returns only indoor tables" "0" "$NON_INDOOR"

# T07 — Update table status
RESP=$(curl -s -w "\n%{http_code}" -X PUT "$BASE/tables/$TEST_TABLE_ID" \
  -H "Authorization: Bearer $MANAGER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"reserved"}')
BODY=$(echo "$RESP" | head -n1); STATUS=$(echo "$RESP" | tail -n1)
check "T07 — Update table status 200" "200" "$STATUS"
check "T07 — Status updated to reserved" "reserved" "$(echo "$BODY" | jq -r '.status // empty')"

# T08 — Get non-existent table
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/tables/000000000000000000000001" \
  -H "Authorization: Bearer $WAITER_TOKEN")
check "T08 — Non-existent table returns 404" "404" "$STATUS"

# ─── Section 7: Table + Order Integration ────────────────────────────────────

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  SECTION 7 — Table + Order Integration"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Reset test table to available
curl -s -o /dev/null -X PUT "$BASE/tables/$TEST_TABLE_ID" \
  -H "Authorization: Bearer $MANAGER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"available"}'

# Get a real menu item ID (Classic Burger from seed)
BURGER_ID=$(curl -s "$BASE/menu" | jq -r '[.[] | select(.name == "Classic Burger")][0]._id')
check "SETUP — Classic Burger found in DB" "true" "$([ -n "$BURGER_ID" ] && echo true || echo false)"

# TI01 — Table has no active order initially
RESP=$(curl -s -w "\n%{http_code}" "$BASE/tables/$TEST_TABLE_ID/order" \
  -H "Authorization: Bearer $WAITER_TOKEN")
BODY=$(echo "$RESP" | head -n1); STATUS=$(echo "$RESP" | tail -n1)
check "TI01 — Get table order status 200" "200" "$STATUS"
check "TI01 — No active order (null)" "null" "$(echo "$BODY" | jq -r '. // "null"')"

# TI02 — Create order on test table
RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE/orders" \
  -H "Authorization: Bearer $WAITER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"table\":\"$TEST_TABLE_ID\",\"items\":[{\"menuItem\":\"$BURGER_ID\",\"quantity\":2}]}")
BODY=$(echo "$RESP" | head -n1); STATUS=$(echo "$RESP" | tail -n1)
ORDER_ID=$(echo "$BODY" | jq -r '._id // empty')
check "TI02 — Create order on table status 201" "201" "$STATUS"
check "TI02 — Order has ID" "true" "$([ -n "$ORDER_ID" ] && echo true || echo false)"

# TI03 — Table status is now occupied
RESP=$(curl -s "$BASE/tables/$TEST_TABLE_ID" \
  -H "Authorization: Bearer $WAITER_TOKEN")
check "TI03 — Table status is occupied after order" "occupied" "$(echo "$RESP" | jq -r '.status // empty')"
check "TI03 — Table currentOrder is set" "true" \
  "$(echo "$RESP" | jq -r '.currentOrder != null' 2>/dev/null || echo false)"

# TI04 — Get table active order
RESP=$(curl -s -w "\n%{http_code}" "$BASE/tables/$TEST_TABLE_ID/order" \
  -H "Authorization: Bearer $WAITER_TOKEN")
BODY=$(echo "$RESP" | head -n1); STATUS=$(echo "$RESP" | tail -n1)
check "TI04 — Get active order status 200" "200" "$STATUS"
check "TI04 — Active order ID matches" "$ORDER_ID" "$(echo "$BODY" | jq -r '._id // empty')"
check "TI04 — Order has items" "true" "$(echo "$BODY" | jq '.items | length > 0' 2>/dev/null || echo false)"

# TI05 — Cannot create second order on occupied table
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/orders" \
  -H "Authorization: Bearer $WAITER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"table\":\"$TEST_TABLE_ID\",\"items\":[{\"menuItem\":\"$BURGER_ID\",\"quantity\":1}]}")
check "TI05 — Second order on occupied table blocked (409)" "409" "$STATUS"

# TI06 — Advance order through full workflow to paid
# confirmed
curl -s -o /dev/null -X POST "$BASE/orders/$ORDER_ID/kot" \
  -H "Authorization: Bearer $WAITER_TOKEN"
# preparing
curl -s -o /dev/null -X PATCH "$BASE/orders/$ORDER_ID/status" \
  -H "Authorization: Bearer $WAITER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"preparing"}'
# ready
curl -s -o /dev/null -X PATCH "$BASE/orders/$ORDER_ID/status" \
  -H "Authorization: Bearer $WAITER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"ready"}'
# served
curl -s -o /dev/null -X PATCH "$BASE/orders/$ORDER_ID/status" \
  -H "Authorization: Bearer $WAITER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"served"}'
# checkout (paid)
RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE/orders/$ORDER_ID/checkout" \
  -H "Authorization: Bearer $MANAGER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"paymentMethod":"cash"}')
BODY=$(echo "$RESP" | head -n1); STATUS=$(echo "$RESP" | tail -n1)
check "TI06 — Checkout status 200" "200" "$STATUS"
check "TI06 — Order paymentStatus is paid" "paid" "$(echo "$BODY" | jq -r '.order.paymentStatus // empty')"
check "TI06 — Order status is paid" "paid" "$(echo "$BODY" | jq -r '.order.status // empty')"

# TI07 — Table freed after payment
RESP=$(curl -s "$BASE/tables/$TEST_TABLE_ID" \
  -H "Authorization: Bearer $WAITER_TOKEN")
check "TI07 — Table status is cleaning after payment" "cleaning" "$(echo "$RESP" | jq -r '.status // empty')"
check "TI07 — Table currentOrder is null after payment" "null" \
  "$(echo "$RESP" | jq -r '.currentOrder // "null"')"

# TI08 — Table order endpoint returns null after payment
RESP=$(curl -s "$BASE/tables/$TEST_TABLE_ID/order" \
  -H "Authorization: Bearer $WAITER_TOKEN")
check "TI08 — Table order is null after payment" "null" "$(echo "$RESP" | jq -r '. // "null"')"

# Cleanup: delete test table
curl -s -o /dev/null -X DELETE "$BASE/tables/$TEST_TABLE_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# ─── Section 8: Edge Cases ────────────────────────────────────────────────────

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  SECTION 8 — Edge Cases"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# E01 — Price = 0 is valid (complimentary item)
RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE/menu" \
  -H "Authorization: Bearer $MANAGER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Free Water","price":0,"category":"beverage"}')
BODY=$(echo "$RESP" | head -n1); STATUS=$(echo "$RESP" | tail -n1)
FREE_ITEM_ID=$(echo "$BODY" | jq -r '._id // empty')
check "E01 — Price=0 is valid (201)" "201" "$STATUS"
# Cleanup
[ -n "$FREE_ITEM_ID" ] && curl -s -o /dev/null -X DELETE "$BASE/menu/$FREE_ITEM_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# E02 — analytics/margins route does not collide with /:id param
# (This would return 404 if Express matched 'analytics' as an :id)
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/menu/analytics/margins" \
  -H "Authorization: Bearer $MANAGER_TOKEN")
check "E02 — /analytics/margins not treated as /:id (200 not 404)" "200" "$STATUS"

# E03 — Cost endpoint for item with no recipe returns 0 ingredient cost
RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE/menu" \
  -H "Authorization: Bearer $MANAGER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"No Recipe Item","price":20,"category":"special","overheadCost":2}')
BODY=$(echo "$RESP" | head -n1)
NO_RECIPE_ID=$(echo "$BODY" | jq -r '._id // empty')

RESP=$(curl -s -w "\n%{http_code}" "$BASE/menu/$NO_RECIPE_ID/cost" \
  -H "Authorization: Bearer $MANAGER_TOKEN")
BODY=$(echo "$RESP" | head -n1); STATUS=$(echo "$RESP" | tail -n1)
check "E03 — Cost for no-recipe item status 200" "200" "$STATUS"
check "E03 — ingredientCost is 0 with no recipe" "0" "$(echo "$BODY" | jq -r '.ingredientCost // empty')"
check "E03 — overheadCost is 2" "2" "$(echo "$BODY" | jq -r '.overheadCost // empty')"
check "E03 — breakdown is empty array" "0" "$(echo "$BODY" | jq '.breakdown | length' 2>/dev/null || echo -1)"
# Cleanup
[ -n "$NO_RECIPE_ID" ] && curl -s -o /dev/null -X DELETE "$BASE/menu/$NO_RECIPE_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# E04 — Margin for item with price=0 and no recipe: marginPct should be 0
RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE/menu" \
  -H "Authorization: Bearer $MANAGER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Zero Price Item","price":0,"category":"beverage","overheadCost":0}')
BODY=$(echo "$RESP" | head -n1)
ZERO_ID=$(echo "$BODY" | jq -r '._id // empty')

RESP=$(curl -s "$BASE/menu/$ZERO_ID/margin" -H "Authorization: Bearer $MANAGER_TOKEN")
check "E04 — marginPct is 0 when price=0" "0" "$(echo "$RESP" | jq -r '.marginPct // empty')"
[ -n "$ZERO_ID" ] && curl -s -o /dev/null -X DELETE "$BASE/menu/$ZERO_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# E05 — Table with capacity=0 must fail validation (min: 1 enforced in schema)
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/tables" \
  -H "Authorization: Bearer $MANAGER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"number":200,"capacity":0,"location":"indoor"}')
check "E05 — Table capacity=0 returns 422" "422" "$STATUS"

# E06 — Table with invalid location enum
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/tables" \
  -H "Authorization: Bearer $MANAGER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"number":201,"capacity":4,"location":"rooftop"}')
check "E06 — Invalid table location rejected (not 201)" "true" \
  "$([ "$STATUS" != "201" ] && echo true || echo false)"

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
