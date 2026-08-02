import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(request: Request) {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data, error } = await supabase
    .from('promises')
    .select('*')
    .order('created_at', { ascending: false });
    
  return NextResponse.json({ success: true, promises: data || [], error });
}

export async function POST(request: Request) {
  const authHeader = request.headers.get("Authorization");
  if (authHeader !== `Bearer ${process.env.ADMIN_PASSWORD}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const json = await request.json();
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  
  const { action, promise } = json;
  
  if (action === 'CREATE') {
    const { data, error } = await supabase.from('promises').insert([promise]).select();
    return NextResponse.json({ success: !error, error, data });
  } else if (action === 'UPDATE') {
    const { id, ...rest } = promise;
    const { data, error } = await supabase.from('promises').update(rest).eq('id', id).select();
    return NextResponse.json({ success: !error, error, data });
  } else if (action === 'DELETE') {
    const { id } = promise;
    const { error } = await supabase.from('promises').delete().eq('id', id);
    return NextResponse.json({ success: !error, error });
  }
  
  return NextResponse.json({ success: false, error: "Invalid action" });
}
