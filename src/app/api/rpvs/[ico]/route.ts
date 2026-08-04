import { NextResponse } from 'next/server';
import { checkRpvsStatus } from '@/lib/telegram';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, context: { params: Promise<{ ico: string }> }) {
  try {
    const { ico } = await context.params;
    const { searchParams } = new URL(request.url);
    const name = searchParams.get('name') || undefined;

    if (!ico) return NextResponse.json({ error: 'Missing ICO' }, { status: 400 });

    const result = await checkRpvsStatus(ico, name);

    return NextResponse.json({ 
      active: result.active,
      ico: result.resolvedIco || result.ico,
      hasIco: result.hasIco,
      source: result.source,
    });
  } catch (error) {
    console.error("RPVS API Route error:", error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
