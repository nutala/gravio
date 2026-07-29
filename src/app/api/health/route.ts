import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const dbUrl = process.env.DATABASE_URL;

  const info: any = {
    supabaseUrlSet: !!url,
    supabaseKeySet: !!key,
    databaseUrlSet: !!dbUrl,
  };

  if (url && key) {
    try {
      const supabase = createClient(url, key);
      const { data, error } = await supabase.from("User").select("id,email,name").limit(3);
      info.supabaseQueryOk = !error;
      info.supabaseQueryResult = error ? error.message : `Found ${data?.length || 0} users`;
      if (data?.length) info.sample = data;
    } catch (e: any) {
      info.supabaseQueryOk = false;
      info.supabaseQueryError = e.message;
    }
  }

  return NextResponse.json(info);
}
