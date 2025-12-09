-- =============================================================
-- Verification Script: Order Items Quantity Alias
-- Purpose: Verify that the quantity column was added correctly
-- Safe to run multiple times
-- =============================================================

-- Step 1: Check if the column exists
SELECT 
  '✓ Column Check' as test,
  CASE 
    WHEN COUNT(*) = 2 THEN 'PASS - Both qty and quantity columns exist'
    WHEN COUNT(*) = 1 THEN 'FAIL - Only qty exists, quantity missing'
    ELSE 'FAIL - Neither column found'
  END as result
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'order_items' 
  AND column_name IN ('qty', 'quantity');

-- Step 2: Check column properties
SELECT 
  '✓ Column Properties' as test,
  column_name,
  data_type,
  is_generated,
  CASE 
    WHEN column_name = 'qty' AND is_generated = 'NEVER' THEN 'PASS'
    WHEN column_name = 'quantity' AND is_generated = 'ALWAYS' THEN 'PASS'
    ELSE 'CHECK'
  END as status
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'order_items' 
  AND column_name IN ('qty', 'quantity')
ORDER BY column_name;

-- Step 3: Check existing data (if any)
SELECT 
  '✓ Data Consistency' as test,
  COUNT(*) as total_rows,
  COUNT(CASE WHEN qty = quantity THEN 1 END) as matching_rows,
  CASE 
    WHEN COUNT(*) = 0 THEN 'N/A - No data yet'
    WHEN COUNT(*) = COUNT(CASE WHEN qty = quantity THEN 1 END) THEN 'PASS - All rows match'
    ELSE 'FAIL - Some rows do not match'
  END as result
FROM order_items;

-- Step 4: Sample data (if exists)
SELECT 
  '✓ Sample Data' as test,
  id,
  qty,
  quantity,
  price_cents,
  CASE 
    WHEN qty = quantity THEN 'PASS'
    ELSE 'FAIL'
  END as match_status
FROM order_items
ORDER BY created_at DESC
LIMIT 5;

-- Summary
SELECT 
  '=== VERIFICATION SUMMARY ===' as summary,
  CASE 
    WHEN EXISTS (
      SELECT 1 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
        AND table_name = 'order_items' 
        AND column_name = 'quantity'
        AND is_generated = 'ALWAYS'
    ) THEN '✓ Migration successful - quantity column is properly configured'
    ELSE '✗ Migration incomplete - please run add-order-items-quantity-alias.sql'
  END as status;
