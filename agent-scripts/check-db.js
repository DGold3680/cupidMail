const { Client } = require('pg');

async function main() {
  const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
  console.log("Connecting to:", connectionString.replace(/:[^:@]+@/, ":****@"));
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log("Connected successfully!");

    // Check migration table
    const migs = await client.query('SELECT migration_name, started_at, finished_at, rolled_back_at, logs FROM _prisma_migrations;');
    console.log("Migration records:", JSON.stringify(migs.rows, null, 2));

    // Check existing tables
    const tables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);
    console.log("Existing tables in public schema:", tables.rows.map(r => r.table_name));

  } catch (err) {
    console.error("Query error:", err);
  } finally {
    await client.end();
  }
}

main();

