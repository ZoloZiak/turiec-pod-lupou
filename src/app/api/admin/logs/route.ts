import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch the 50 most recent logs
    const { data: logs, error } = await supabase
      .from('system_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    // If the table doesn't exist yet, return empty array instead of throwing 500 error
    if (error && error.code === '42P01') {
      return NextResponse.json({ success: true, logs: [] });
    }
    
    if (error) throw error;

    return NextResponse.json({
      success: true,
      logs: logs || [],
    });
  } catch (error: any) {
    console.error("Logs API Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
