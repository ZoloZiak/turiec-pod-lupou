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

interface RpvsPartner {
  PartnerId?: number;
  Ico?: string;
  TypOsoby?: string;
}

interface RpvsODataRecord {
  PlatnostDo?: string | null;
}

interface RpvsODataResponse {
  value?: RpvsODataRecord[];
}

interface TelegramApiResponse {
  ok: boolean;
  [key: string]: unknown;
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

const RPVS_FETCH_TIMEOUT_MS = 8000;

/**
 * fetch s hornou hranicou cakania. Ak externy RPVS portal visi, AbortSignal.timeout
 * request preruzi po RPVS_FETCH_TIMEOUT_MS -> vyhodi AbortError, ktory zachyti volajuci
 * try/catch (kazdy stage checkRpvsStatus ma vlastny catch). Bez timeoutu sa mohol cely
 * audit zablokovat na pomalom/nedostupnom rpvs.gov.sk.
 */
async function fetchWithTimeout(url: string) {
  return fetch(url, { signal: AbortSignal.timeout(RPVS_FETCH_TIMEOUT_MS) });
}

export interface RpvsCheckResult {
  ico?: string;
  resolvedIco?: string | null;
  partnerId?: number;
  hasIco: boolean;
  active: boolean;
  exempt?: boolean;
  source?: string;
  error?: string;
}

export function isRpvsExempt(ico?: string | null, supplierName?: string | null): boolean {
  const cleanIco = ico && !ico.startsWith('NO_ICO_') ? ico.trim() : null;

  const KNOWN_BANKS = ['00151653', '31320155', '36854140', '47251336', '31318762', '31575951'];
  if (cleanIco && KNOWN_BANKS.includes(cleanIco)) return true;
  if (supplierName && /sporiteľňa|vúb|čsob|unicredit|tatra banka|prima banka/i.test(supplierName)) return true;

  const KNOWN_STATE_ICOS = [
    '00151866', '00000604', '00151742', '00156884', '42181810', '00165182', '00681156', '00686832', '30416094', '00151513',
    '30807484', '37808427', '00316792', '00316776', '00647365', '00316717', '00316890', '00316601', '00316580', '00316971',
    '00316679', '00316709', '00316806', '00650480', '00316831', '00216822', '00633909', '00316997', '00317012', '31749504',
    '31813811', '00164623', '00164721', '00397563', '30794536', '36145319', '42220360', '37806939', '42386497', '30796491'
  ];
  if (cleanIco && KNOWN_STATE_ICOS.includes(cleanIco)) return true;

  const STATE_KEYWORDS = /ministerstvo|rezort|štátn|sociálna poisťovňa|environmentálny fond|fond rozvoja|slovenská pošta|železnice|lesy sr|úrad práce|úrad verejného|žilinský samosprávny|mesto |obec |slovenská akadémia|všeobecná zdravotná|všzp|knižnica|osvetové centrum/i;
  if (supplierName && STATE_KEYWORDS.test(supplierName)) return true;

  return false;
}

/**
 * Robust multi-stage RPVS status checker.
 * Stage 1: Check GetPartners API for active PartnerId & detail link.
 * Stage 2: Direct OData query by ICO.
 * Stage 3: Fallback query via RPVS GetPartners JSON API using Supplier Name.
 */
export async function checkRpvsStatus(
  ico: string | null,
  supplierName?: string
): Promise<RpvsCheckResult> {
  const cleanIco = ico && !ico.startsWith('NO_ICO_') ? ico.trim() : null;

  if (isRpvsExempt(cleanIco, supplierName)) {
    return { ico: cleanIco || undefined, resolvedIco: cleanIco || undefined, hasIco: Boolean(cleanIco), active: false, exempt: true, source: 'EXEMPTION' };
  }

  // Stage 1: GetPartners API search for PartnerId (Direct working RPVS detail link)
  if (cleanIco) {
    try {
      const getPartnersUrl = `https://rpvs.gov.sk/rpvs/Partner/Partner/GetPartners?text=${encodeURIComponent(cleanIco)}`;
      const getPartnersRes = await fetchWithTimeout(getPartnersUrl);
      if (getPartnersRes.ok) {
        const list = (await getPartnersRes.json()) as RpvsPartner[];
        if (Array.isArray(list) && list.length > 0) {
          const partner = list.find((p: RpvsPartner) => p.TypOsoby === 'Partner verejného sektora' || p.PartnerId);
          if (partner && partner.PartnerId) {
            return {
              ico: cleanIco,
              resolvedIco: partner.Ico || cleanIco,
              partnerId: partner.PartnerId,
              hasIco: true,
              active: true,
              source: 'GET_PARTNERS_ICO'
            };
          }
        }
      }
    } catch (err: unknown) {
      console.warn(`[RPVS GetPartners Error] ICO ${cleanIco}:`, errorMessage(err));
    }
  }

  // Stage 2: Check by ICO via OData API
  if (cleanIco) {
    try {
      const url = `https://rpvs.gov.sk/opendatav2/PartneriVerejnehoSektora?%24filter=${encodeURIComponent(`Ico eq '${cleanIco}'`)}`;
      const res = await fetchWithTimeout(url);
      if (res.ok) {
        const data = (await res.json()) as RpvsODataResponse;
        const isActive = data.value?.some((record: RpvsODataRecord) => {
          if (!record.PlatnostDo) return true;
          return new Date(record.PlatnostDo) > new Date();
        });
        if (isActive) {
          let resolvedPartnerId: number | undefined = undefined;
          try {
            const gpRes = await fetchWithTimeout(`https://rpvs.gov.sk/rpvs/Partner/Partner/GetPartners?text=${encodeURIComponent(cleanIco)}`);
            if (gpRes.ok) {
              const gpList = (await gpRes.json()) as RpvsPartner[];
              if (Array.isArray(gpList) && gpList.length > 0 && gpList[0].PartnerId) {
                resolvedPartnerId = gpList[0].PartnerId;
              }
            }
          } catch {}
          return { ico: cleanIco, resolvedIco: cleanIco, partnerId: resolvedPartnerId, hasIco: true, active: true, source: 'ODATA_ICO' };
        }
      }
    } catch (err: unknown) {
      console.warn(`[RPVS OData Error] ICO ${cleanIco}:`, errorMessage(err));
    }
  }

  // Stage 2: Fallback - Search by ICO via GetPartners API
  if (cleanIco) {
    try {
      const url = `https://rpvs.gov.sk/rpvs/Partner/Partner/GetPartners?text=${encodeURIComponent(cleanIco)}`;
      const res = await fetchWithTimeout(url);
      if (res.ok) {
        const list = (await res.json()) as RpvsPartner[];
        if (Array.isArray(list) && list.length > 0) {
          const partner = list.find((p: RpvsPartner) => p.TypOsoby === 'Partner verejného sektora');
          if (partner) {
            return { ico: cleanIco, resolvedIco: partner.Ico || cleanIco, hasIco: true, active: true, source: 'GET_PARTNERS_ICO' };
          }
        }
      }
    } catch (err: unknown) {
      console.warn(`[RPVS Stage 2 Error] ICO ${cleanIco}:`, errorMessage(err));
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
        const res = await fetchWithTimeout(url);
        if (res.ok) {
          const list = (await res.json()) as RpvsPartner[];
          if (Array.isArray(list) && list.length > 0) {
            const partner = list.find((p: RpvsPartner) => p.TypOsoby === 'Partner verejného sektora' && p.Ico);
            if (partner) {
              const odataUrl = `https://rpvs.gov.sk/opendatav2/PartneriVerejnehoSektora?%24filter=${encodeURIComponent(`Ico eq '${partner.Ico}'`)}`;
              const odataRes = await fetchWithTimeout(odataUrl);
              if (odataRes.ok) {
                const odataData = (await odataRes.json()) as RpvsODataResponse;
                const isActive = odataData.value?.some((record: RpvsODataRecord) => {
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
      } catch (err: unknown) {
        console.warn(`[RPVS Stage 3 Error] Name ${term}:`, errorMessage(err));
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

    const json = (await res.json()) as TelegramApiResponse;
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
