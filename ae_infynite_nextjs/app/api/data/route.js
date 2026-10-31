import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorized(request) {
  return Boolean(process.env.APP_PASSWORD &&
    request.headers.get("x-app-password") === process.env.APP_PASSWORD);
}
function db() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase environment variables");
  return createClient(url, key, { auth: { persistSession: false } });
}
export async function GET(request) {
  if (!authorized(request)) return NextResponse.json({error:"Unauthorized"},{status:401});
  const month = request.nextUrl.searchParams.get("month") || "";
  if (!/^\d{4}-\d{2}$/.test(month)) return NextResponse.json({error:"Invalid month"},{status:400});
  try {
    const {data,error} = await db().from("schedules").select("payload").eq("month_key",month).maybeSingle();
    if (error) throw error;
    return NextResponse.json({data:data?.payload || {days:{},orders:[],notes:""}},{headers:{"Cache-Control":"no-store"}});
  } catch (e) {
    console.error(e);
    return NextResponse.json({error:"Database error"},{status:500});
  }
}
export async function PUT(request) {
  if (!authorized(request)) return NextResponse.json({error:"Unauthorized"},{status:401});
  try {
    const body = await request.json();
    const month = String(body.month || "");
    if (!/^\d{4}-\d{2}$/.test(month) || !body.data || typeof body.data !== "object")
      return NextResponse.json({error:"Invalid schedule payload"},{status:400});
    const {error} = await db().from("schedules").upsert(
      {month_key:month,payload:body.data,updated_at:new Date().toISOString()},
      {onConflict:"month_key"}
    );
    if (error) throw error;
    return NextResponse.json({ok:true});
  } catch (e) {
    console.error(e);
    return NextResponse.json({error:"Database save failed"},{status:500});
  }
}
