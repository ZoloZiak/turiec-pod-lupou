import fetch from 'node-fetch';

export interface TransactionForAudit {
  external_id?: string;
  title?: string;
  subject?: string;
  amount: number;
  buyer_name: string;
  supplier_name: string;
  supplier_ico?: string | null;
  url?: string;
  published_at?: string;
}

export interface RpvsCheckResult {
  ico?: string;
  resolvedIco?: string;
  hasIco: boolean;
  active: boolean;
  exempt?: boolean;
  source?: string;
  error?: string;
}

/**
 * Robust multi-stage RPVS status checker.
 * Stage 1: Direct OData query by ICO.
 * Stage 2: Fallback query via RPVS GetPartners JSON API using ICO.
 * Stage 3: Fallback query via RPVS GetPartners JSON API using Supplier Name.
 */
export async function checkRpvsStatus(
  ico: string | null,
  supplierName?: string
): Promise<RpvsCheckResult> {
  const cleanIco = ico && !ico.startsWith('NO_ICO_') ? ico.trim() : null;

  // 1. Banky a úverové inštitúcie poskytujúce úvery/úverové prísľuby mestám (§ 2 ods. 3 písm. g Zákona o RPVS)
  const KNOWN_BANKS = ['00151653', '31320155', '36854140', '47251336', '31318762', '31575951'];
  if (cleanIco && KNOWN_BANKS.includes(cleanIco)) {
    return { ico: cleanIco, resolvedIco: cleanIco, hasIco: true, active: false, exempt: true, source: 'BANK_EXEMPTION' };
  }

  if (supplierName && /sporiteľňa|vúb|čsob|unicredit|tatra banka|prima banka/i.test(supplierName)) {
    return { ico: cleanIco || undefined, resolvedIco: cleanIco || undefined, hasIco: Boolean(cleanIco), active: false, exempt: true, source: 'BANK_EXEMPTION' };
  }

  // 2. Štát, ministerstvá, štátne fondy, verejné orgány, obce a mestá (§ 2 ods. 3 písm. a, b, c Zákona o RPVS)
  // Štátne orgány a verejnoprávne subjekty nemajú povinnosť zápisu v RPVS, pretože ich konečným užívateľom výhod je verejnosť/štát.
  const STATE_KEYWORDS = /ministerstvo|rezort|štátn|sociálna poisťovňa|environmentálny fond|fond rozvoja|slovenská pošta|železnice|lesy sr|úrad práce|úrad verejného|žilinský samosprávny|mesto |obec |slovenská akadémia|všeobecná zdravotná|všzp/i;
  
  if (supplierName && STATE_KEYWORDS.test(supplierName)) {
    return { ico: cleanIco || undefined, resolvedIco: cleanIco || undefined, hasIco: Boolean(cleanIco), active: false, exempt: true, source: 'STATE_ENTITY_EXEMPTION' };
  }

  // Stage 1: Check by ICO via OData API
  if (cleanIco) {
    try {
      const url = `https://rpvs.gov.sk/opendatav2/PartneriVerejnehoSektora?%24filter=${encodeURIComponent(`Ico eq '${cleanIco}'`)}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = (await res.json()) as any;
        const isActive = data.value?.some((record: any) => {
          if (!record.PlatnostDo) return true;
          return new Date(record.PlatnostDo) > new Date();
        });
        if (isActive) {
          return { ico: cleanIco, resolvedIco: cleanIco, hasIco: true, active: true, source: 'ODATA_ICO' };
        }
      }
    } catch (err: any) {
      console.warn(`[RPVS Stage 1 Error] ICO ${cleanIco}:`, err.message);
    }
  }

  // Stage 2: Fallback - Search by ICO via GetPartners API
  if (cleanIco) {
    try {
      const url = `https://rpvs.gov.sk/rpvs/Partner/Partner/GetPartners?text=${encodeURIComponent(cleanIco)}`;
      const res = await fetch(url);
      if (res.ok) {
        const list = (await res.json()) as any[];
        if (Array.isArray(list) && list.length > 0) {
          const partner = list.find((p: any) => p.TypOsoby === 'Partner verejného sektora');
          if (partner) {
            return { ico: cleanIco, resolvedIco: partner.Ico || cleanIco, hasIco: true, active: true, source: 'GET_PARTNERS_ICO' };
          }
        }
      }
    } catch (err: any) {
      console.warn(`[RPVS Stage 2 Error] ICO ${cleanIco}:`, err.message);
    }
  }

  // Stage 3: Fallback - Search by Supplier Name via GetPartners API
  if (supplierName && supplierName.trim().length >= 3) {
    const searchTerms = [
      supplierName.trim(),
      supplierName.replace(/,?\s*(s\.?\s*r\.?\s*o\.?|a\.?\s*s\.?|spol\.?\s*s\.?\s*r\.?\s*o\.?|k\.?\s*s\.?)$/i, '').trim(),
      supplierName.replace(/,/g, '').trim()
    ];

    for (const term of searchTerms) {
      if (!term || term.length < 3) continue;
      try {
        const url = `https://rpvs.gov.sk/rpvs/Partner/Partner/GetPartners?text=${encodeURIComponent(term)}`;
        const res = await fetch(url);
        if (res.ok) {
          const list = (await res.json()) as any[];
          if (Array.isArray(list) && list.length > 0) {
            const partner = list.find((p: any) => p.TypOsoby === 'Partner verejného sektora' && p.Ico);
            if (partner) {
              const odataUrl = `https://rpvs.gov.sk/opendatav2/PartneriVerejnehoSektora?%24filter=${encodeURIComponent(`Ico eq '${partner.Ico}'`)}`;
              const odataRes = await fetch(odataUrl);
              if (odataRes.ok) {
                const odataData = (await odataRes.json()) as any;
                const isActive = odataData.value?.some((record: any) => {
                  if (!record.PlatnostDo) return true;
                  return new Date(record.PlatnostDo) > new Date();
                });
                if (isActive) {
                  return { ico: cleanIco, resolvedIco: partner.Ico, hasIco: true, active: true, source: `GET_PARTNERS_NAME (${term})` };
                }
              }
            }
          }
        }
      } catch (err: any) {
        console.warn(`[RPVS Stage 3 Error] Name ${term}:`, err.message);
      }
    }
  }

  return { ico: cleanIco, resolvedIco: null, hasIco: !!cleanIco, active: false, source: 'NONE' };
}

export async function sendTelegramMessage(text: string, parseMode: 'HTML' | 'Markdown' = 'HTML'): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    console.log('ℹ️ [TELEGRAM DRY-RUN] TELEGRAM_BOT_TOKEN alebo TELEGRAM_CHAT_ID chýba v .env.local.');
    console.log('--- Správa, ktorá by bola odoslaná ---');
    console.log(text);
    console.log('------------------------------------');
    return false;
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: parseMode,
        disable_web_page_preview: false,
      }),
    });

    const json = (await res.json()) as any;
    if (!json.ok) {
      console.error('❌ Telegram API error:', json);
      return false;
    }

    console.log('📱 Telegram notifikácia úspešne odoslaná na mobil!');
    return true;
  } catch (err) {
    console.error('❌ Chyba pri odosielaní Telegram notifikácie:', err);
    return false;
  }
}

export interface AuditResult {
  isSuspicious: boolean;
  reason?: string;
  rpvsStatus: RpvsCheckResult;
  telegramSent: boolean;
}

export async function auditAndNotifyTransaction(tx: TransactionForAudit): Promise<AuditResult> {
  const HIGH_AMOUNT_THRESHOLD = 100000;
  const rpvs = await checkRpvsStatus(tx.supplier_ico || null, tx.supplier_name);
  const title = tx.subject || tx.title || 'Neznámy predmet';

  let isSuspicious = false;
  let reason = '';

  if (tx.amount >= HIGH_AMOUNT_THRESHOLD) {
    if (!rpvs.active) {
      isSuspicious = true;
      if (!rpvs.hasIco && !rpvs.resolvedIco) {
        reason = `Vysoká suma (${tx.amount.toLocaleString('sk-SK')} €) a CHÝBAJÚCE IČO dodávateľa bez nálezu v RPVS`;
      } else {
        const checkedIco = rpvs.resolvedIco || tx.supplier_ico;
        reason = `Vysoká suma (${tx.amount.toLocaleString('sk-SK')} €) a BEZ aktívneho zápisu v RPVS (IČO: ${checkedIco})`;
      }
    }
  }

  let telegramSent = false;

  if (isSuspicious) {
    const formattedAmount = new Intl.NumberFormat('sk-SK', { style: 'currency', currency: 'EUR' }).format(tx.amount);
    const displayIco = rpvs.resolvedIco || (tx.supplier_ico && !tx.supplier_ico.startsWith('NO_ICO_') ? tx.supplier_ico : null);
    
    const message = `🚨 <b>KRTKO AUDIT ALERT: PODOZRIVÁ ZMLUVA</b> 🚨

💶 <b>Suma:</b> ${formattedAmount}
🏢 <b>Dodávateľ:</b> ${tx.supplier_name} ${displayIco ? `(IČO: ${displayIco})` : '(IČO NEZNÁME)'}
🏛️ <b>Objednávateľ:</b> ${tx.buyer_name}
📜 <b>Predmet:</b> ${title}

⚠️ <b>Dôvod varovania:</b> ${reason}
${displayIco ? `🔍 <a href="https://rpvs.gov.sk/rpvs/Partner/Partner/Vyhladavanie?NazovPodniku=&Ico=${displayIco}">Overiť v RPVS portáli</a>` : ''}
${tx.url ? `🔗 <a href="${tx.url}">Zobraziť zmluvu v CRZ</a>` : ''}

<i>Krtko - Turiec pod Lupou 🔎</i>`;

    telegramSent = await sendTelegramMessage(message, 'HTML');
  }

  return {
    isSuspicious,
    reason,
    rpvsStatus: rpvs,
    telegramSent,
  };
}
