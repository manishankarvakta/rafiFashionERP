/**
 * Fix orphaned FK references for columns that DON'T YET have DB-level FK constraints.
 * This handles the case where Prisma is ADDING new FK constraints to existing data.
 * 
 * Run: node prisma/scripts/fix-missing-fkeys-pre-push.js
 */
const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://postgres:postgres@localhost:5432/startup_mvp' });

// These are the FK relationships Prisma is trying to add, based on schema.prisma
// Format: { childTable, childCol, parentTable, parentCol }
const fksToAdd = [
  // Item relations
  { child: 'Item', col: 'categoryId',    parent: 'Category',       pcol: 'id' },
  { child: 'Item', col: 'subCategoryId', parent: 'Category',       pcol: 'id' },
  { child: 'Item', col: 'brandId',       parent: 'Brand',          pcol: 'id' },
  { child: 'Item', col: 'seasonId',      parent: 'Season',         pcol: 'id' },
  { child: 'Item', col: 'collectionId',  parent: 'Collection',     pcol: 'id' },
  { child: 'Item', col: 'unitId',        parent: 'Unit',           pcol: 'id' },
  { child: 'Item', col: 'createdBy',     parent: 'User',           pcol: 'id' },
  // Warehouse relations
  { child: 'Warehouse', col: 'createdBy', parent: 'User',          pcol: 'id' },
  // Purchase / Sale items
  { child: 'PurchaseItem', col: 'itemId',   parent: 'Item',        pcol: 'id' },
  { child: 'PurchaseItem', col: 'unitId',   parent: 'Unit',        pcol: 'id' },
  { child: 'SaleItem',     col: 'itemId',   parent: 'Item',        pcol: 'id' },
  // Stock
  { child: 'Stock',     col: 'itemId',      parent: 'Item',        pcol: 'id' },
  { child: 'Stock',     col: 'warehouseId', parent: 'Warehouse',   pcol: 'id' },
  // StockLedger
  { child: 'StockLedger', col: 'itemId',      parent: 'Item',      pcol: 'id' },
  { child: 'StockLedger', col: 'warehouseId', parent: 'Warehouse', pcol: 'id' },
  // GRN
  { child: 'GRN',     col: 'supplierId',  parent: 'Supplier',      pcol: 'id' },
  { child: 'GRNItem', col: 'itemId',      parent: 'Item',          pcol: 'id' },
  // Department
  { child: 'Department', col: 'parentId', parent: 'Department',    pcol: 'id' },
  // Category  
  { child: 'Category', col: 'parentId',   parent: 'Category',      pcol: 'id' },
];

async function checkAndFix(childTable, childCol, parentTable, parentCol) {
  // Check if table and column exist
  const colCheck = await client.query(`
    SELECT is_nullable FROM information_schema.columns 
    WHERE table_schema='public' AND table_name=$1 AND column_name=$2
  `, [childTable, childCol]);
  
  if (colCheck.rows.length === 0) return 0; // Column doesn't exist yet

  const isNullable = colCheck.rows[0].is_nullable === 'YES';

  // Count invalid references
  const countSQL = `
    SELECT COUNT(*) as cnt 
    FROM "${childTable}" c
    WHERE c."${childCol}" IS NOT NULL 
    AND NOT EXISTS (
      SELECT 1 FROM "${parentTable}" p WHERE p."${parentCol}" = c."${childCol}"
    )
  `;

  try {
    const countResult = await client.query(countSQL);
    const cnt = parseInt(countResult.rows[0].cnt);
    if (cnt === 0) return 0;

    console.log(`  ⚠️  "${childTable}".${childCol} has ${cnt} orphaned rows → "${parentTable}"`);

    if (isNullable) {
      const fixSQL = `
        UPDATE "${childTable}" 
        SET "${childCol}" = NULL
        WHERE "${childCol}" IS NOT NULL 
        AND NOT EXISTS (
          SELECT 1 FROM "${parentTable}" p WHERE p."${parentCol}" = "${childTable}"."${childCol}"
        )
      `;
      const fix = await client.query(fixSQL);
      console.log(`  ✅ Nulled ${fix.rowCount} rows in "${childTable}".${childCol}`);
      return fix.rowCount;
    } else {
      // Non-nullable: delete the orphaned rows
      const delSQL = `
        DELETE FROM "${childTable}" 
        WHERE "${childCol}" IS NOT NULL 
        AND NOT EXISTS (
          SELECT 1 FROM "${parentTable}" p WHERE p."${parentCol}" = "${childTable}"."${childCol}"
        )
      `;
      const del = await client.query(delSQL);
      console.log(`  🗑️  Deleted ${del.rowCount} orphaned rows from "${childTable}".${childCol} (non-nullable)`);
      return del.rowCount;
    }
  } catch (err) {
    console.warn(`  ⚠️  Skipped "${childTable}".${childCol}: ${err.message.split('\n')[0]}`);
    return 0;
  }
}

async function main() {
  await client.connect();
  console.log('✅ Connected\n');
  console.log('Fixing orphaned references for FKs Prisma is about to add...\n');

  let total = 0;
  for (const fk of fksToAdd) {
    total += await checkAndFix(fk.child, fk.col, fk.parent, fk.pcol);
  }

  // Also run the generic scan for any we missed
  console.log('\nRunning generic scan for remaining orphans (nullable columns only)...');
  const fkQuery = await client.query(`
    SELECT
      tc.table_name   AS child_table,
      kcu.column_name AS child_col,
      ccu.table_name  AS parent_table,
      ccu.column_name AS parent_col
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'
    ORDER BY tc.table_name, kcu.column_name
  `);

  for (const row of fkQuery.rows) {
    total += await checkAndFix(row.child_table, row.child_col, row.parent_table, row.parent_col);
  }

  if (total === 0) {
    console.log('\n✅ No orphaned references found.');
  } else {
    console.log(`\n✅ Fixed ${total} total orphaned references.`);
  }

  console.log('Now run: npx prisma db push --accept-data-loss');
  await client.end();
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
