`const { Client } = require('pg');

async function test() {
  const connectionString = 'postgresql://postgres:postgres@172.25.159.128:5432/startup_mvp?schema=public';
  console.log('Connecting with pg client to:', connectionString.replace(/:[^:@]+@/, ':****@'));
  const client = new Client({ connectionString });
  
  try {
    await client.connect();
    console.log('✅ Client connected successfully!');
    const res = await client.query('SELECT current_database(), current_user, version()');
    console.log('Query result:', res.rows[0]);
  } catch (err) {
    console.error('❌ Connection failed with pg client:');
    console.error(err);
  } finally {
    await client.end();
  }
}

test();
