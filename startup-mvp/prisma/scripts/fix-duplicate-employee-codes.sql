-- ============================================================
-- Fix duplicate employeeCode values in Employee table
-- Run this BEFORE: npx prisma db push
-- ============================================================

-- Step 1: Check how many duplicates exist (preview only)
SELECT 
  "employeeCode", 
  COUNT(*) as cnt, 
  array_agg(id) as employee_ids
FROM "Employee"
WHERE "employeeCode" IS NOT NULL
GROUP BY "employeeCode"
HAVING COUNT(*) > 1;

-- Step 2: Show employees with NULL employeeCode (NULLs are fine for unique, but good to know)
-- SELECT id, name, "employeeCode" FROM "Employee" WHERE "employeeCode" IS NULL;

-- ============================================================
-- FIX: Append a suffix to duplicate codes so each is unique
-- Keeps the first occurrence as-is, renames duplicates.
-- ============================================================
WITH ranked AS (
  SELECT 
    id,
    "employeeCode",
    ROW_NUMBER() OVER (
      PARTITION BY "employeeCode" 
      ORDER BY "createdAt" ASC
    ) AS rn
  FROM "Employee"
  WHERE "employeeCode" IS NOT NULL
)
UPDATE "Employee" e
SET "employeeCode" = r."employeeCode" || '-DUP' || (r.rn - 1)
FROM ranked r
WHERE e.id = r.id
  AND r.rn > 1;

-- Step 3: Verify — should return 0 rows after fix
SELECT 
  "employeeCode", 
  COUNT(*) as cnt
FROM "Employee"
WHERE "employeeCode" IS NOT NULL
GROUP BY "employeeCode"
HAVING COUNT(*) > 1;
