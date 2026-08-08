const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://postgres:postgres@localhost:5432/startup_mvp' });

async function main() {
  await client.connect();
  console.log('Connected\n');

  // Check tables that exist
  const tables = await client.query(`SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename`);
  const tableNames = tables.rows.map(r => r.tablename);
  console.log('Tables:', tableNames.join(', '), '\n');

  // Fix orphaned departmentId in Employee
  if (tableNames.includes('Department') || tableNames.includes('department')) {
    const deptTable = tableNames.find(t => t.toLowerCase() === 'department');
    if (deptTable) {
      const r1 = await client.query(`
        SELECT COUNT(*) as cnt FROM "Employee" e 
        WHERE e."departmentId" IS NOT NULL 
        AND NOT EXISTS (SELECT 1 FROM "${deptTable}" d WHERE d.id = e."departmentId")
      `);
      console.log('Orphaned Employee.departmentId:', r1.rows[0].cnt);
      if (parseInt(r1.rows[0].cnt) > 0) {
        const fix1 = await client.query(`
          UPDATE "Employee" SET "departmentId" = NULL 
          WHERE "departmentId" IS NOT NULL 
          AND NOT EXISTS (SELECT 1 FROM "${deptTable}" d WHERE d.id = "Employee"."departmentId")
        `);
        console.log('Fixed Employee.departmentId rows:', fix1.rowCount);
      }
    }
  }

  // Fix orphaned employeeTypeId in Employee
  const etTable = tableNames.find(t => t.toLowerCase() === 'employeetype');
  if (etTable) {
    const r2 = await client.query(`
      SELECT COUNT(*) as cnt FROM "Employee" e 
      WHERE e."employeeTypeId" IS NOT NULL 
      AND NOT EXISTS (SELECT 1 FROM "${etTable}" et WHERE et.id = e."employeeTypeId")
    `);
    console.log('Orphaned Employee.employeeTypeId:', r2.rows[0].cnt);
    if (parseInt(r2.rows[0].cnt) > 0) {
      const fix2 = await client.query(`
        UPDATE "Employee" SET "employeeTypeId" = NULL 
        WHERE "employeeTypeId" IS NOT NULL 
        AND NOT EXISTS (SELECT 1 FROM "${etTable}" et WHERE et.id = "Employee"."employeeTypeId")
      `);
      console.log('Fixed Employee.employeeTypeId rows:', fix2.rowCount);
    }
  }

  // Fix orphaned productionLineId in Employee
  const plTable = tableNames.find(t => t.toLowerCase() === 'productionline');
  if (plTable) {
    const r3 = await client.query(`
      SELECT COUNT(*) as cnt FROM "Employee" e 
      WHERE e."productionLineId" IS NOT NULL 
      AND NOT EXISTS (SELECT 1 FROM "${plTable}" pl WHERE pl.id = e."productionLineId")
    `);
    console.log('Orphaned Employee.productionLineId:', r3.rows[0].cnt);
    if (parseInt(r3.rows[0].cnt) > 0) {
      const fix3 = await client.query(`
        UPDATE "Employee" SET "productionLineId" = NULL 
        WHERE "productionLineId" IS NOT NULL 
        AND NOT EXISTS (SELECT 1 FROM "${plTable}" pl WHERE pl.id = "Employee"."productionLineId")
      `);
      console.log('Fixed Employee.productionLineId rows:', fix3.rowCount);
    }
  }

  console.log('\nDone. Now run: npx prisma db push --accept-data-loss');
  await client.end();
}

main().catch(e => { console.error(e.message); process.exit(1); });
