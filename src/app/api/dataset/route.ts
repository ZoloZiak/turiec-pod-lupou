import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Whitelist verejných read-only datasetov + ich default zoradenie.
// Prehliadač nikdy nehovorí s DB priamo — kľúč (service-role) ostáva na serveri.
const DATASETS: Record<string, { orderBy: string; ascending: boolean }> = {
  city_companies: { orderBy: 'name', ascending: true },
  nku_reports: { orderBy: 'year', ascending: false },
  eu_funds: { orderBy: 'year', ascending: false },
  asset_declarations: { orderBy: 'year', ascending: false },
  city_council_votes: { orderBy: 'vote_date', ascending: false },
};

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const table = searchParams.get('table') || '';
    const cfg = DATASETS[table];
    if (!cfg) {
      return NextResponse.json({ success: false, error: `Neznámy dataset: ${table}` }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data, error } = await supabase
      .from(table)
      .select('*')
      .order(cfg.orderBy, { ascending: cfg.ascending });

    if (error) throw error;

    return NextResponse.json({ success: true, rows: data || [] });
  } catch (error: unknown) {
    console.error('Dataset API Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
