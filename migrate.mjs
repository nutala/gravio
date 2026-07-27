import pg from "pg";

const OLD = "postgresql://calitrack_k3z9_user:25waR1Dm5OoWvWdzMSylpMOqZYiUGcr3@dpg-d8v7mknavr4c7383dddg-a.frankfurt-postgres.render.com/calitrack_k3z9";
const NEW = "postgresql://postgres:Scarlett68550!!@db.arxxskchdxswntqkdspy.supabase.co:5432/postgres";

const TABLES = [
  "User",
  "Category",
  "Exercise",
  "ExerciseVariant",
  "WorkoutTemplate",
  "WorkoutTemplateEntry",
  "Workout",
  "WorkoutEntry",
  "WorkoutSet",
];

async function connect(url) {
  const c = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await c.connect();
  return c;
}

async function main() {
  const oldDb = await connect(OLD);
  const newDb = await connect(NEW);

  try {
    for (const table of TABLES) {
      process.stdout.write(`${table}... `);

      const { rows } = await oldDb.query(`SELECT * FROM "${table}"`);
      if (rows.length === 0) { console.log("0 rows (skip)"); continue; }

      const cols = Object.keys(rows[0]);
      const placeholders = cols.map((_, i) => `$${i + 1}`).join(", ");
      const insertSQL = `INSERT INTO "${table}" (${cols.map(c => `"${c}"`).join(", ")}) VALUES (${placeholders})`;

      let inserted = 0;
      for (const row of rows) {
        try {
          await newDb.query(insertSQL, cols.map(c => row[c]));
          inserted++;
        } catch (err) {
          console.error(`\n  \u26A0 Row ${row.id}: ${err.message}`);
        }
      }

      console.log(`${inserted}/${rows.length} rows`);
    }

    console.log("\n\u2705 Migration termin\u00E9e !");
  } finally {
    await oldDb.end();
    await newDb.end();
  }
}

main().catch((e) => { console.error("\n\u274C \u00C9chec:", e.message); process.exit(1); });
