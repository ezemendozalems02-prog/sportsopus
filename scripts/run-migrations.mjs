// Aplica las migraciones de supabase/migrations/*.sql contra SUPABASE_DB_URL,
// en orden, saltando las que ya se aplicaron antes (registradas en
// _migrations). Uso: node --env-file=.env.local scripts/run-migrations.mjs
import { Client } from "pg";
import { readdirSync, readFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

const dbUrl = process.env.SUPABASE_DB_URL;
if (!dbUrl) throw new Error("Falta SUPABASE_DB_URL (correr con --env-file=.env.local)");

const migrationsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "supabase", "migrations");
const files = readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort();

const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
await client.connect();

try {
  await client.query(`
    create table if not exists _migrations (
      filename text primary key,
      applied_at timestamptz not null default now()
    );
  `);
  const { rows } = await client.query("select filename from _migrations");
  const applied = new Set(rows.map((r) => r.filename));

  for (const file of files) {
    if (applied.has(file)) {
      console.log(`Ya aplicada: ${file}`);
      continue;
    }
    const sql = readFileSync(path.join(migrationsDir, file), "utf8");
    console.log(`Aplicando ${file}...`);
    await client.query("begin");
    try {
      await client.query(sql);
      await client.query("insert into _migrations (filename) values ($1)", [file]);
      await client.query("commit");
      console.log(`  OK`);
    } catch (e) {
      await client.query("rollback");
      throw e;
    }
  }
  console.log("Migraciones al día.");
} finally {
  await client.end();
}
