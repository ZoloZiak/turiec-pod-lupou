import { NextResponse } from 'next/server';
import cloudscraper from 'cloudscraper';
import * as cheerio from 'cheerio';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, context: { params: Promise<{ ico: string }> }) {
  try {
    const { ico } = await context.params;
    if (!ico) return NextResponse.json({ error: 'Missing ICO' }, { status: 400 });

    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
    
    // Fetch finstat html
    // @ts-expect-error cloudscraper nemá typové definície
    const html = await cloudscraper.get(`https://finstat.sk/${ico}`);
    const $ = cheerio.load(html);
    
    // Zisk: 1 317 €, Tržby: 1 856 186 €, Aktíva: 8 932 472 €
    const metaDescription = $('meta[name="description"]').attr('content') || '';
    
    let zisk = null;
    let trzby = null;
    
    const ziskMatch = metaDescription.match(/Zisk:\s*([\d\s\u00A0]+) €/i) || metaDescription.match(/Hospodársky výsledok:\s*([\d\s\u00A0]+) €/i);
    if (ziskMatch) zisk = parseInt(ziskMatch[1].replace(/[\s\u00A0]/g, ''), 10);
    
    const trzbyMatch = metaDescription.match(/Tržby:\s*([\d\s\u00A0]+) €/i) || metaDescription.match(/Výnosy:\s*([\d\s\u00A0]+) €/i);
    if (trzbyMatch) trzby = parseInt(trzbyMatch[1].replace(/[\s\u00A0]/g, ''), 10);
    
    // Also extract name to be sure
    const name = $('h1.title').text().trim() || $('title').text().replace(/ IČO.*/, '').trim();

    return NextResponse.json({ 
      success: true,
      data: {
        zisk,
        trzby,
        name,
        metaDescription
      }
    });
  } catch (error: unknown) {
    console.error("Finstat fetch error:", error);
    return NextResponse.json({ success: false, error: 'Nepodarilo sa stiahnuť FinStat dáta' }, { status: 500 });
  }
}
