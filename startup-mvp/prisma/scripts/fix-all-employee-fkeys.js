/**
 * Fix ALL orphaned foreign key references in Employee table
 * Run: node prisma/scripts/fix-all-employee-fkeys.js
 */
const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://postgres:postgres@localhost:5432/startup_mvp' });

async function nullOrphanedFK(empColumn, refTable, refColumn = 'id') {
  const checkSQL = `
    SELECT COUNT(*) as cnt FROM "Employee" e 
    WHERE e."${empColumn}" IS NOT NULL 
    AND NOT EXISTS (
      SELECT 1 FROM "${refTable}" r WHERE r."${refColumn}" = e."${empColumn}"
    )
  `;
  const result = await client.query(checkSQL);
  const cnt = parseInt(result.rows[0].cnt);
  
  if (cnt === 0) {
    console.log(`  ✅ Employee.${empColumn} → ${refTable}: no orphans`);
    return 0;
  }

  const fixSQL = `
    UPDATE "Employee" SET "${empColumn}" = NULL 
    WHERE "${empColumn}" IS NOT NULL 
    AND NOT EXISTS (
      SELECT 1 FROM "${refTable}" r WHERE r."${refColumn}" = "Employee"."${empColumn}"
    )
  `;
  const fix = await client.query(fixSQL);
  console.log(`  🔧 Employee.${empColumn} → ${refTable}: fixed ${fix.rowCount} orphaned rows`);
  return fix.rowCount;
}

async function main() {
  await client.connect();
  console.log('✅ Connected\n');

  // All nullable FK columns in Employee model
  const fks = [
    { col: 'advanceAccountId',       table: 'ChartOfAccount' },
    { col: 'salaryPayableAccountId', table: 'ChartOfAccount' },
    { col: 'departmentId',           table: 'Department' },
    { col: 'employeeTypeId',         table: 'EmployeeType' },
    { col: 'productionLineId',       table: 'ProductionLine' },
    { col: 'shiftId',                table: 'Shift' },
    { col: 'userId',                 table: 'User' },
    { col: 'warehouseId',            table: 'Warehouse' },
  ];

  let total = 0;
  for (const { col, table } of fks) {
    // Check table exists
    const exists = await client.query(
      `SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename=$1`, [table]
    );
    if (exists.rows.length === 0) {
      console.log(`  ⚠️  Table "${table}" not found, skipping ${col}`);
      continue;
    }
    total += await nullOrphanedFK(col, table);
  }

  console.log(`\n✅ Total fixed: ${total} rows`);
  console.log('Now run: npx prisma db push --accept-data-loss');
  await client.end();
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
