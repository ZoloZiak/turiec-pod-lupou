import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ ico: string }> }
) {
  const { ico } = await params;
  const cleanIco = ico && !ico.startsWith("NO_ICO_") ? ico.trim() : null;

  if (!cleanIco) {
    return NextResponse.redirect("https://finstat.sk");
  }

  try {
    const res = await fetch(`https://rpvs.gov.sk/rpvs/Partner/Partner/GetPartners?text=${encodeURIComponent(cleanIco)}`);
    if (res.ok) {
      const list = await res.json();
      if (Array.isArray(list) && list.length > 0 && list[0].PartnerId) {
        return NextResponse.redirect(`https://rpvs.gov.sk/rpvs/Partner/Partner/Detail/${list[0].PartnerId}`);
      }
    }
  } catch (err) {
    console.error("[RPVS Redirect Error]:", err);
  }

  // Fallback if not found in RPVS
  return NextResponse.redirect(`https://finstat.sk/${cleanIco}`);
}
