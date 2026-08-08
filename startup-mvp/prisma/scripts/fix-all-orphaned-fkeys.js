/**
 * Auto-detect and fix ALL orphaned FK references across the entire database
 * Uses pg_constraint to find every FK relationship dynamically.
 * 
 * Run: node prisma/scripts/fix-all-orphaned-fkeys.js
 */
const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://postgres:postgres@localhost:5432/startup_mvp' });

async function main() {
  await client.connect();
  console.log('✅ Connected to database\n');

  // Query all FK constraints in the public schema
  const fkQuery = await client.query(`
    SELECT
      tc.table_name        AS child_table,
      kcu.column_name      AS child_col,
      ccu.table_name       AS parent_table,
      ccu.column_name      AS parent_col,
      -- Is the child column nullable?
      (
        SELECT c.is_nullable 
        FROM information_schema.columns c 
        WHERE c.table_schema = 'public' 
          AND c.table_name = tc.table_name 
          AND c.column_name = kcu.column_name
      ) AS is_nullable
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
     AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
     AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = 'public'
    ORDER BY tc.table_name, kcu.column_name
  `);

  let totalFixed = 0;
  let totalErrors = 0;

  for (const row of fkQuery.rows) {
    const { child_table, child_col, parent_table, parent_col, is_nullable } = row;

    if (is_nullable !== 'YES') {
      // Can't null a non-nullable column — skip (would need to delete rows instead)
      continue;
    }

    try {
      // Count orphans
      const countSQL = `
        SELECT COUNT(*) as cnt 
        FROM "${child_table}" c
        WHERE c."${child_col}" IS NOT NULL 
        AND NOT EXISTS (
          SELECT 1 FROM "${parent_table}" p WHERE p."${parent_col}" = c."${child_col}"
        )
      `;
      const countResult = await client.query(countSQL);
      const cnt = parseInt(countResult.rows[0].cnt);

      if (cnt === 0) continue;

      // Fix orphans by setting to NULL
      const fixSQL = `
        UPDATE "${child_table}" 
        SET "${child_col}" = NULL
        WHERE "${child_col}" IS NOT NULL 
        AND NOT EXISTS (
          SELECT 1 FROM "${parent_table}" p WHERE p."${parent_col}" = "${child_table}"."${child_col}"
        )
      `;
      const fixResult = await client.query(fixSQL);
      totalFixed += fixResult.rowCount;
      console.log(`  🔧 Fixed ${fixResult.rowCount} rows in "${child_table}".${child_col} → "${parent_table}".${parent_col}`);

    } catch (err) {
      console.warn(`  ⚠️  Skipped "${child_table}".${child_col}: ${err.message.split('\n')[0]}`);
      totalErrors++;
    }
  }

  if (totalFixed === 0) {
    console.log('✅ No orphaned FK references found.');
  } else {
    console.log(`\n✅ Total fixed: ${totalFixed} orphaned rows across all tables`);
    if (totalErrors > 0) {
      console.log(`⚠️  ${totalErrors} FK(s) were skipped (non-nullable columns require manual review)`);
    }
  }

  console.log('\nNow run: npx prisma db push --accept-data-loss');
  await client.end();
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
