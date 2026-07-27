import pg from 'pg';

const SUPA = "postgresql://postgres:Scarlett68550!!@db.arxxskchdxswntqkdspy.supabase.co:5432/postgres";

async function main() {
  const c = new pg.Client({ connectionString: SUPA, ssl: { rejectUnauthorized: false } });
  await c.connect();
  const tables = ['User','Category','Exercise','ExerciseVariant','Workout','WorkoutEntry','WorkoutSet','WorkoutTemplate','WorkoutTemplateEntry'];
  for (const t of tables) {
    const r = await c.query('SELECT COUNT(*)::int AS cnt FROM "' + t + '"');
    console.log(t + ': ' + r.rows[0].cnt + ' rows');
  }
  await c.end();
}
main().catch(e => console.error(e));
