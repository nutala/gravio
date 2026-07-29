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
  user: 'User', entries: 'WorkoutEntry', entry: 'WorkoutTemplateEntry',
  exercise: 'Exercise', variant: 'ExerciseVariant', sets: 'WorkoutSet',
  workout: 'Workout', template: 'WorkoutTemplate', category: 'Category',
}

function buildSelect(include?: any, select?: any): string {
  if (select) {
    const cols = Object.keys(select).filter(k => select[k]).map(k => {
      const v = select[k];
      if (typeof v === 'object' && (v.select || v.include)) {
        const nested = buildSelect(v.include || v.select);
        return `${k}:${REL_TABLE[k] || k}(${nested})`;
      }
      return k;
    });
    return cols.join(',');
  }
  if (!include) return '*';
  const parts: string[] = ['*'];
  for (const [rel, cfg] of Object.entries(include)) {
    const table = REL_TABLE[rel];
    if (!table) continue;
    const inner = typeof cfg === 'object' ? buildSelect(cfg.include || cfg.select) : '*';
    parts.push(`${rel}:${table}(${inner})`);
  }
  return parts.join(',');
}

function applyFilters(q: any, where: any): any {
  if (!where) return q;
  for (const [key, val] of Object.entries(where)) {
    if (key === 'OR') {
      const clauses = (val as any[]).map(c => {
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
          } else parts.push(`${k}.eq.${val}`);
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
      const sel = buildSelect(args.include, args.select);
      let q = getSupabase().from(table).select(sel);
      q = applyFilters(q, args.where);
      const { data, error } = await q.maybeSingle();
      if (error) throw new Error(error.message);
      return data;
    },

    findMany: async (args: { where?: any; include?: any; select?: any; orderBy?: any; take?: number }) => {
      const sel = buildSelect(args.include, args.select);
      let q = getSupabase().from(table).select(sel);
      q = applyFilters(q, args.where);
      q = applyOrder(q, args.orderBy);
      if (args.take) q = q.limit(args.take);
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      return data || [];
    },

    findFirst: async (args: { where?: any; include?: any; select?: any; orderBy?: any }) => {
      const sel = buildSelect(args.include, args.select);
      let q = getSupabase().from(table).select(sel);
      q = applyFilters(q, args.where);
      q = applyOrder(q, args.orderBy);
      q = q.limit(1);
      const { data, error } = await q.maybeSingle();
      if (error && error.code !== 'PGRST116') throw new Error(error.message);
      return data;
    },

    create: async (args: { data: any; include?: any; select?: any }) => {
      const sel = buildSelect(args.include, args.select) || '*';
      const { data, error } = await getSupabase().from(table).insert(args.data).select(sel).single();
      if (error) throw new Error(error.message);
      return data;
    },

    createMany: async (args: { data: any[] }) => {
      const { data, error } = await getSupabase().from(table).insert(args.data).select();
      if (error) throw new Error(error.message);
      return data;
    },

    update: async (args: { where: any; data: any; include?: any }) => {
      const sel = buildSelect(args.include) || '*';
      let q = getSupabase().from(table).update(args.data).select(sel).single();
      q = applyFilters(q, args.where);
      const { data, error } = await q;
      if (error && error.code === 'PGRST116') return null;
      if (error) throw new Error(error.message);
      return data;
    },

    updateMany: async (args: { where: any; data: any }) => {
      let q = getSupabase().from(table).update(args.data).select();
      q = applyFilters(q, args.where);
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      return data || [];
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
