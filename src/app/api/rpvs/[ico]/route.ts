import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, context: { params: Promise<{ ico: string }> }) {
  try {
    const { ico } = await context.params;
    if (!ico) return NextResponse.json({ error: 'Missing ICO' }, { status: 400 });

    const res = await fetch(`https://rpvs.gov.sk/opendatav2/PartneriVerejnehoSektora?$filter=Ico eq '${ico}'`);
    if (!res.ok) {
      return NextResponse.json({ error: 'RPVS API failed' }, { status: 502 });
    }
    const data = await res.json();
    
    // Check if there is any active registration (PlatnostDo is null or in the future)
    const isActive = data.value?.some((record: any) => {
      if (!record.PlatnostDo) return true;
      const validUntil = new Date(record.PlatnostDo);
      return validUntil > new Date();
    });

    return NextResponse.json({ 
      active: !!isActive, 
      records: data.value 
    });
  } catch (error) {
    console.error("RPVS fetch error:", error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
