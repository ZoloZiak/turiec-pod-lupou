import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { INCOME_TX_IDS } from '@/lib/income-ids';
import { UNSURE_REVIEW } from '@/lib/unsure-ids';
import { requireAdmin } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

const MIGRATION_MESSAGE =
  "Stlpec 'direction' neexistuje — spustite database/add_direction_column.sql v Supabase SQL editore";

interface EntityRef {
  name: string;
  ico: string;
}

interface DirectionRow {
  id: string;
  external_id: string;
  source_type: string;
  amount_eur: number | string;
  subject: string;
  date_published: string;
  source_url: string;
  direction?: string | null;
  buyer: EntityRef | null;
  supplier: EntityRef | null;
}

// Detekcia, ci je chyba sposobena chybajucim stlpcom 'direction'.
function isMissingDirectionColumn(error: { message?: string } | null): boolean {
  if (!error) return false;
  const msg = (error.message || '').toLowerCase();
  return msg.includes('column') && msg.includes('direction');
}

function getClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(supabaseUrl, supabaseKey);
}

export async function GET(request: Request) {
  try {
    const denied = requireAdmin(request);
    if (denied) return denied;

    const { searchParams } = new URL(request.url);
    const filter = searchParams.get('filter') || 'unsure';

    const supabase = getClient();

    // Zistime, ci stlpec 'direction' existuje.
    const { error: probeError } = await supabase
      .from('transactions')
      .select('direction')
      .limit(1);

    const hasDirectionColumn = !isMissingDirectionColumn(probeError);
    if (probeError && !hasDirectionColumn) {
      return NextResponse.json({ success: false, error: MIGRATION_MESSAGE, needsMigration: true });
    }
    if (probeError) throw probeError;

    const columns = hasDirectionColumn
      ? 'id, external_id, source_type, amount_eur, subject, date_published, source_url, direction, buyer:buyer_entity_id(name, ico), supplier:supplier_entity_id(name, ico)'
      : 'id, external_id, source_type, amount_eur, subject, date_published, source_url, buyer:buyer_entity_id(name, ico), supplier:supplier_entity_id(name, ico)';

    if (filter === 'all') {
      const { data, error } = await supabase
        .from('transactions')
        .select(columns)
        .eq('source_type', 'CRZ_CONTRACT')
        .order('date_published', { ascending: false })
        .limit(100);
      if (error) throw error;
      const rows = (data || []) as unknown as DirectionRow[];
      const items = rows.map((t) => enrich(t, hasDirectionColumn));
      return NextResponse.json({ success: true, needsMigration: false, filter: 'all', items });
    }

    // Default: UNSURE — zoznam sporných zmlúv z auditu.
    const unsureIds = UNSURE_REVIEW.map((r) => r.id);
    const { data, error } = await supabase
      .from('transactions')
      .select(columns)
      .in('id', unsureIds);
    if (error) throw error;
    const rows = (data || []) as unknown as DirectionRow[];
    const byId = new Map(rows.map((r) => [r.id, r]));

    // Poradie a metadata drzime podla auditu (aj ak niektore riadky v DB chybaju).
    const items = UNSURE_REVIEW.map((meta) => {
      const t = byId.get(meta.id);
      const current = t
        ? currentDirection(t, hasDirectionColumn)
        : INCOME_TX_IDS.has(meta.id)
          ? 'INCOME'
          : 'EXPENSE';
      return {
        id: meta.id,
        subject: t?.subject || meta.subject,
        amount_eur: t ? Number(t.amount_eur) || 0 : meta.amount_eur,
        buyer: t?.buyer?.name || meta.buyer,
        supplier: t?.supplier?.name || meta.supplier,
        source_url: t?.source_url || meta.url,
        reason: meta.reason,
        current_direction: current,
        in_db: Boolean(t),
      };
    });

    return NextResponse.json({ success: true, needsMigration: false, filter: 'unsure', items });
  } catch (error: unknown) {
    console.error('Direction GET Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

function currentDirection(t: DirectionRow, hasColumn: boolean): 'INCOME' | 'EXPENSE' {
  if (hasColumn && t.direction) {
    return t.direction === 'INCOME' ? 'INCOME' : 'EXPENSE';
  }
  return INCOME_TX_IDS.has(t.id) ? 'INCOME' : 'EXPENSE';
}

function enrich(t: DirectionRow, hasColumn: boolean) {
  return {
    id: t.id,
    subject: t.subject,
    amount_eur: Number(t.amount_eur) || 0,
    buyer: t.buyer?.name || '',
    supplier: t.supplier?.name || '',
    source_url: t.source_url,
    current_direction: currentDirection(t, hasColumn),
    in_db: true,
  };
}

export async function POST(request: Request) {
  try {
    const denied = requireAdmin(request);
    if (denied) return denied;

    const body = await request.json();
    const { id, direction } = body || {};

    if (!id || typeof id !== 'string') {
      return NextResponse.json({ success: false, error: 'Chýba id transakcie.' }, { status: 400 });
    }
    if (direction !== 'INCOME' && direction !== 'EXPENSE') {
      return NextResponse.json(
        { success: false, error: "direction musí byť 'INCOME' alebo 'EXPENSE'." },
        { status: 400 }
      );
    }

    const supabase = getClient();

    const { error: updateError } = await supabase
      .from('transactions')
      .update({ direction })
      .eq('id', id);

    if (updateError) {
      if (isMissingDirectionColumn(updateError)) {
        return NextResponse.json({ success: false, error: MIGRATION_MESSAGE, needsMigration: true });
      }
      throw updateError;
    }

    return NextResponse.json({ success: true, needsMigration: false, id, direction });
  } catch (error: unknown) {
    console.error('Direction POST Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
