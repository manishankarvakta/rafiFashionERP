/**
 * Fix duplicate employeeCode values in the Employee table
 * Run: node prisma/scripts/fix-duplicate-employee-codes.js
 */

const { Client } = require('pg');

async function main() {
  const client = new Client({
    connectionString: 'postgresql://postgres:postgres@localhost:5432/startup_mvp',
  });

  await client.connect();
  console.log('✅ Connected to database\n');

  // Step 1: Show duplicates
  const dupsResult = await client.query(`
    SELECT "employeeCode", COUNT(*) as cnt, array_agg(id) as employee_ids
    FROM "Employee"
    WHERE "employeeCode" IS NOT NULL
    GROUP BY "employeeCode"
    HAVING COUNT(*) > 1
  `);

  if (dupsResult.rows.length === 0) {
    console.log('✅ No duplicate employeeCode values found. Safe to run prisma db push.');
    await client.end();
    return;
  }

  console.log(`⚠️  Found ${dupsResult.rows.length} duplicate employeeCode group(s):`);
  dupsResult.rows.forEach(row => {
    console.log(`  - "${row.employeeCode}" appears ${row.cnt} times: [${row.employee_ids.join(', ')}]`);
  });

  // Step 2: Fix duplicates — keep oldest, rename the rest with -DUP1, -DUP2 suffix
  console.log('\n🔧 Fixing duplicates...');
  const fixResult = await client.query(`
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
      AND r.rn > 1
    RETURNING e.id, e."employeeCode", e.name
  `);

  console.log(`✅ Fixed ${fixResult.rowCount} duplicate rows:`);
  fixResult.rows.forEach(row => {
    console.log(`  - Employee "${row.name}" (${row.id}) → code: "${row.employeeCode}"`);
  });

  // Step 3: Verify
  const verifyResult = await client.query(`
    SELECT "employeeCode", COUNT(*) as cnt
    FROM "Employee"
    WHERE "employeeCode" IS NOT NULL
    GROUP BY "employeeCode"
    HAVING COUNT(*) > 1
  `);

  if (verifyResult.rows.length === 0) {
    console.log('\n✅ All duplicates resolved. You can now run: npx prisma db push');
  } else {
    console.log('\n❌ Some duplicates remain:', verifyResult.rows);
  }

  await client.end();
}

main().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
