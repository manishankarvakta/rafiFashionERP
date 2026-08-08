/**
 * Fix all duplicate unique constraint violations before prisma db push
 * Fixes: Item.code, Warehouse.code, User.email
 * Run: node prisma/scripts/fix-all-duplicates.js
 */

const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://postgres:postgres@localhost:5432/startup_mvp',
});

async function fixDuplicates(table, column, orderBy = '"createdAt" ASC') {
  const dupsResult = await client.query(`
    SELECT "${column}", COUNT(*) as cnt, array_agg(id) as ids
    FROM "${table}"
    WHERE "${column}" IS NOT NULL
    GROUP BY "${column}"
    HAVING COUNT(*) > 1
  `);

  if (dupsResult.rows.length === 0) {
    console.log(`  ✅ No duplicates in ${table}.${column}`);
    return 0;
  }

  console.log(`  ⚠️  Found ${dupsResult.rows.length} duplicate group(s) in ${table}.${column}:`);
  dupsResult.rows.forEach(row => {
    console.log(`     - "${row[column]}" x${row.cnt}`);
  });

  const fixResult = await client.query(`
    WITH ranked AS (
      SELECT 
        id,
        "${column}",
        ROW_NUMBER() OVER (
          PARTITION BY "${column}" 
          ORDER BY ${orderBy}
        ) AS rn
      FROM "${table}"
      WHERE "${column}" IS NOT NULL
    )
    UPDATE "${table}" t
    SET "${column}" = r."${column}" || '-DUP' || (r.rn - 1)
    FROM ranked r
    WHERE t.id = r.id
      AND r.rn > 1
    RETURNING t.id, t."${column}"
  `);

  console.log(`  ✅ Fixed ${fixResult.rowCount} rows in ${table}.${column}`);
  return fixResult.rowCount;
}

async function fixUserEmailDuplicates() {
  const dupsResult = await client.query(`
    SELECT "email", COUNT(*) as cnt, array_agg(id) as ids
    FROM "User"
    WHERE "email" IS NOT NULL
    GROUP BY "email"
    HAVING COUNT(*) > 1
  `);

  if (dupsResult.rows.length === 0) {
    console.log(`  ✅ No duplicates in User.email`);
    return 0;
  }

  console.log(`  ⚠️  Found ${dupsResult.rows.length} duplicate email(s) in User:`);
  dupsResult.rows.forEach(row => {
    console.log(`     - "${row.email}" x${row.cnt}`);
  });

  const fixResult = await client.query(`
    WITH ranked AS (
      SELECT 
        id,
        "email",
        ROW_NUMBER() OVER (
          PARTITION BY "email" 
          ORDER BY "createdAt" ASC
        ) AS rn
      FROM "User"
      WHERE "email" IS NOT NULL
    )
    UPDATE "User" u
    SET "email" = r.rn || '-dup-' || r."email"
    FROM ranked r
    WHERE u.id = r.id
      AND r.rn > 1
    RETURNING u.id, u."email"
  `);

  console.log(`  ✅ Fixed ${fixResult.rowCount} duplicate User email rows`);
  return fixResult.rowCount;
}

async function main() {
  await client.connect();
  console.log('✅ Connected to database\n');

  let totalFixed = 0;

  console.log('Checking Item.code...');
  totalFixed += await fixDuplicates('Item', 'code');

  console.log('\nChecking Warehouse.code...');
  totalFixed += await fixDuplicates('Warehouse', 'code');

  console.log('\nChecking User.email...');
  totalFixed += await fixUserEmailDuplicates();

  console.log('\nChecking Employee.employeeCode...');
  totalFixed += await fixDuplicates('Employee', 'employeeCode');

  if (totalFixed === 0) {
    console.log('\n✅ No duplicates found. You can safely run: npx prisma db push');
  } else {
    console.log(`\n✅ Fixed ${totalFixed} total duplicate rows. Now run: npx prisma db push`);
  }

  await client.end();
}

main().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
