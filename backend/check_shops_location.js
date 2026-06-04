import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Client } = pg;
const client = new Client({
  connectionString: process.env.SUPABASE_DB_URL,
});

async function run() {
  await client.connect();
  try {
    const res = await client.query(`
      SELECT id, "Location" FROM "Shops" LIMIT 10;
    `);
    console.log("SHOPS LOCATION DATA:");
    console.log(JSON.stringify(res.rows, null, 2));
  } catch (err) {
    console.error("ERROR:", err);
  } finally {
    await client.end();
  }
}
run();
