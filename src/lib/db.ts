import { createClient, SupabaseClient } from '@supabase/supabase-js'

let _supabase: SupabaseClient | null = null;
function getSupabase(): SupabaseClient {
  if (!_supabase) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
    _supabase = createClient(url, key, { auth: { persistSession: false } });
  }
  return _supabase;
}

const REL_TABLE: Record<string, string> = {
  user: 'User', entry: 'WorkoutTemplateEntry',
  exercise: 'Exercise', variant: 'ExerciseVariant', sets: 'WorkoutSet',
  workout: 'Workout', template: 'WorkoutTemplate', category: 'Category',
  variants: 'ExerciseVariant', // Exercise.variants → ExerciseVariant
}

/** Context-specific relationship table names keyed by [parentTable][relKey]. */
const REL_TABLE_CTX: Record<string, Record<string, string>> = {
  Workout: { entries: 'WorkoutEntry' },
  WorkoutTemplate: { entries: 'WorkoutTemplateEntry' },
}

/** Which Supabase tables carry Prisma-side timestamp columns (no DB defaults). */
const HAS_CREATED_AT: Record<string, boolean> = {
  User: true, Category: true, Exercise: true, ExerciseVariant: true,
  Workout: true, WorkoutEntry: true, WorkoutSet: true, WorkoutTemplate: true,
}
const HAS_UPDATED_AT: Record<string, boolean> = {
  User: true, Category: true, Exercise: true, ExerciseVariant: true,
  Workout: true, WorkoutTemplate: true,
}

function resolveInclude(cfg: any, parentTable?: string): string {
  if (cfg === true || cfg === undefined) return '*';
  if (typeof cfg !== 'object') return '*';
  return buildSelect(cfg.include, cfg.select, parentTable);
}

function buildSelect(include?: any, select?: any, parentTable?: string): string {
  const cols: string[] = [];
  if (select) {
    for (const [key, val] of Object.entries(select)) {
      if (!val) continue;
      if (typeof val === 'object' && (val.select || val.include)) {
        const inner = resolveInclude(val, key);
        const table = REL_TABLE_CTX[parentTable!]?.[key] ?? REL_TABLE[key];
        cols.push(`${key}:${table || key}(${inner})`);
      } else {
        cols.push(key);
      }
    }
  }
  if (include) {
    if (cols.length === 0) cols.push('*');
    for (const [rel, cfg] of Object.entries(include)) {
      const table = REL_TABLE_CTX[parentTable!]?.[rel] ?? REL_TABLE[rel];
      if (!table) continue;
      cols.push(`${rel}:${table}(${resolveInclude(cfg, table)})`);
    }
  }
  return cols.length ? cols.join(',') : '*';
}

function applyFilters(q: any, where: any): any {
  if (!where) return q;
  for (const [key, val] of Object.entries(where)) {
    if (key === 'OR') {
      const clauses = (val as any[]).map((c: any) => {
        const parts: string[] = [];
        for (const [k, v] of Object.entries(c)) {
          if (v === null) parts.push(`${k}.is.null`);
          else if (typeof v === 'object') {
            for (const [op, operand] of Object.entries(v as any)) {
              if (op === 'contains') parts.push(`${k}.ilike.%25${encodeURIComponent(String(operand))}%25`);
              else if (op === 'startsWith') parts.push(`${k}.ilike.${encodeURIComponent(String(operand))}%25`);
              else if (op === 'endsWith') parts.push(`${k}.ilike.%25${encodeURIComponent(String(operand))}`);
              else if (op === 'in') parts.push(`${k}.in.(${(operand as any[]).join(',')})`);
              else if (op === 'gt') parts.push(`${k}.gt.${operand}`);
              else if (op === 'gte') parts.push(`${k}.gte.${operand}`);
              else if (op === 'lt') parts.push(`${k}.lt.${operand}`);
              else if (op === 'lte') parts.push(`${k}.lte.${operand}`);
              else if (op === 'not') parts.push(`${k}.neq.${operand}`);
            }
          } else parts.push(`${k}.eq.${v}`);
        }
        return parts.join(',');
      });
      q = q.or(clauses.join(','));
      continue;
    }
    if (key === 'AND') { for (const c of val as any[]) q = applyFilters(q, c); continue; }
    if (key === 'NOT') {
      if (val === null) { q = q.not(key, 'is', null); continue; }
      q = applyFilters(q, val).map((_: any) => _);
      continue;
    }
    if (val === null) { q = q.is(key, null); continue; }
    if (typeof val === 'object' && !Array.isArray(val)) {
      for (const [op, operand] of Object.entries(val as any)) {
        if (op === 'contains') q = q.ilike(key, `%${operand}%`);
        else if (op === 'startsWith') q = q.ilike(key, `${operand}%`);
        else if (op === 'endsWith') q = q.ilike(key, `%${operand}`);
        else if (op === 'not') q = q.neq(key, operand);
        else if (op === 'in') q = q.in(key, operand as any[]);
        else if (op === 'notIn') q = q.filter(key, 'not.in', `(${(operand as any[]).join(',')})`);
        else if (op === 'gt') q = q.gt(key, operand);
        else if (op === 'gte') q = q.gte(key, operand);
        else if (op === 'lt') q = q.lt(key, operand);
        else if (op === 'lte') q = q.lte(key, operand);
        else if (op === 'equals') q = q.eq(key, operand);
        else if (op === 'mode') { /* ignore case-insensitive mode */ }
      }
    } else {
      q = q.eq(key, val);
    }
  }
  return q;
}

function applyOrder(q: any, orderBy: any): any {
  if (!orderBy) return q;
  const orders = Array.isArray(orderBy) ? orderBy : [orderBy];
  for (const o of orders) {
    const [col, dir] = Object.entries(o)[0];
    q = q.order(col, { ascending: dir === 'asc' });
  }
  return q;
}

function buildModel(table: string) {
  return {
    findUnique: async (args: { where?: any; include?: any; select?: any }) => {
      const sel = buildSelect(args.include, args.select, table);
      let q = getSupabase().from(table).select(sel);
      q = applyFilters(q, args.where);
      const { data, error } = await q.maybeSingle();
      if (error) throw new Error(error.message);
      return data;
    },

    findMany: async (args: { where?: any; include?: any; select?: any; orderBy?: any; take?: number }) => {
      const sel = buildSelect(args.include, args.select, table);
      let q = getSupabase().from(table).select(sel);
      q = applyFilters(q, args.where);
      q = applyOrder(q, args.orderBy);
      if (args.take) q = q.limit(args.take);
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      return data || [];
    },

    findFirst: async (args: { where?: any; include?: any; select?: any; orderBy?: any }) => {
      const sel = buildSelect(args.include, args.select, table);
      let q = getSupabase().from(table).select(sel);
      q = applyFilters(q, args.where);
      q = applyOrder(q, args.orderBy);
      q = q.limit(1);
      const { data, error } = await q.maybeSingle();
      if (error && error.code !== 'PGRST116') throw new Error(error.message);
      return data;
    },

    create: async (args: { data: any; include?: any; select?: any }) => {
      const sel = buildSelect(args.include, args.select, table) || '*';
      const row = { ...args.data };
      // Supabase columns lack DB defaults for cuid() ids and Prisma-side
      // @default(now())/@updatedAt timestamps, so supply them client-side.
      if (!row.id) row.id = crypto.randomUUID();
      const now = new Date().toISOString();
      if (HAS_CREATED_AT[table] && !row.createdAt) row.createdAt = now;
      if (HAS_UPDATED_AT[table] && !row.updatedAt) row.updatedAt = now;
      const { data, error } = await getSupabase().from(table).insert(row).select(sel).single();
      if (error) throw new Error(error.message);
      return data;
    },

    createMany: async (args: { data: any[] }) => {
      const now = new Date().toISOString();
      const rows = args.data.map((r) => ({
        ...r,
        id: r.id || crypto.randomUUID(),
        ...(HAS_CREATED_AT[table] ? { createdAt: r.createdAt || now } : {}),
        ...(HAS_UPDATED_AT[table] ? { updatedAt: r.updatedAt || now } : {}),
      }));
      const { data, error } = await getSupabase().from(table).insert(rows).select();
      if (error) throw new Error(error.message);
      return data;
    },

    update: async (args: { where: any; data: any; include?: any }) => {
      const sel = buildSelect(args.include, undefined, table) || '*';
      const data = { ...args.data };
      // Prisma's @updatedAt is applied client-side; Supabase has no DB default.
      if (HAS_UPDATED_AT[table] && !data.updatedAt) {
        data.updatedAt = new Date().toISOString();
      }
      let q = getSupabase().from(table).update(data).select(sel).single();
      q = applyFilters(q, args.where);
      const { data: result, error } = await q;
      if (error && error.code === 'PGRST116') return null;
      if (error) throw new Error(error.message);
      return result;
    },

    updateMany: async (args: { where: any; data: any }) => {
      const data = { ...args.data };
      if (HAS_UPDATED_AT[table] && !data.updatedAt) {
        data.updatedAt = new Date().toISOString();
      }
      let q = getSupabase().from(table).update(data).select();
      q = applyFilters(q, args.where);
      const { data: result, error } = await q;
      if (error) throw new Error(error.message);
      return result || [];
    },

    delete: async (args: { where: any }) => {
      let q = getSupabase().from(table).delete().select();
      q = applyFilters(q, args.where);
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      return data?.[0];
    },

    deleteMany: async (args: { where: any }) => {
      let q = getSupabase().from(table).delete();
      q = applyFilters(q, args.where);
      const { error } = await q;
      if (error) throw new Error(error.message);
    },

    count: async (args: { where?: any }) => {
      let q = getSupabase().from(table).select('*', { count: 'exact', head: true });
      q = applyFilters(q, args.where);
      const { count, error } = await q;
      if (error) throw new Error(error.message);
      return count ?? 0;
    },
  }
}

const MODELS = ['User', 'Category', 'Exercise', 'ExerciseVariant', 'Workout', 'WorkoutEntry', 'WorkoutSet', 'WorkoutTemplate', 'WorkoutTemplateEntry'] as const;

export const db: any = {};
for (const name of MODELS) {
  const key = name.charAt(0).toLowerCase() + name.slice(1);
  db[key] = buildModel(name);
}

db.$transaction = async (fn: (tx: any) => Promise<any>) => {
  const tx: any = {};
  for (const name of MODELS) {
    const key = name.charAt(0).toLowerCase() + name.slice(1);
    tx[key] = buildModel(name);
  }
  tx.$rpc = async (fnName: string, args: Record<string, any>) => {
    const { data, error } = await getSupabase().rpc(fnName, args);
    if (error) throw new Error(error.message);
    return data;
  };
  return fn(tx);
};

db.$executeRawUnsafe = async (query: string, ...params: any[]) => {
  console.warn('[db] $executeRawUnsafe is deprecated, use $rpc instead');
};

db.$rpc = async (fn: string, args: Record<string, any>) => {
  const { data, error } = await getSupabase().rpc(fn, args);
  if (error) throw new Error(error.message);
  return data;
};
