import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch all entities that have a placeholder ICO (starting with NO_ICO_)
    const { data: unmapped, error } = await supabase
      .from('entities')
      .select('id, ico, name')
      .like('ico', 'NO_ICO_%');

    if (error) throw error;

    // Fetch potential matches from real entities (just a simple dump for the MVP dropdown)
    const { data: realEntities, error: realError } = await supabase
      .from('entities')
      .select('id, ico, name')
      .not('ico', 'like', 'NO_ICO_%');

    if (realError) throw realError;

    return NextResponse.json({
      success: true,
      unmapped: unmapped || [],
      realEntities: realEntities || [],
    });
  } catch (error: any) {
    console.error("API Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
