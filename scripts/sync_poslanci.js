require('dotenv').config({ path: '.env.local' });

/**
 * Krtko modul: Hlasovania Poslancov MsZ — BEZPEČNÝ NO-OP.
 *
 * PÔVODNÝ skript bol FABRIKÁCIA: obsahoval vymyslené mená poslancov
 * (Ing. Ján Kováč, MUDr. Peter Novák, Mgr. Lucia Kováčová — generické fejk mená),
 * vymyslené hlasovania k vymyslenému "VZN č. 42/2024" a mŕtvy source_url
 * (https://www.martin.sk/zapisnica-msz). Vkladať menovaným osobám do úst hlasovania,
 * ktoré nikdy neurobili, je na transparentnostnom webe neprípustné.
 *
 * Preto skript NIČ NEVKLADÁ do DB. Reálne hlasovania sa dajú doplniť len z
 * overiteľného zdroja (oficiálne zápisnice / hlasovací systém MsZ Martin) cez
 * skutočný parser. Kým taký parser nie je, tabuľka city_council_votes ostáva prázdna
 * a modul /poslanci zobrazuje čestný prázdny stav ("Zatiaľ žiadne dáta").
 */
async function run() {
  console.log("⏸️  sync_poslanci: NO-OP — reálny parser hlasovaní MsZ nie je implementovaný.");
  console.log("    Do DB sa NIČ nevkladá (žiadne fabrikované mená/hlasovania).");
  console.log("    TODO: implementovať parser oficiálnych zápisníc MsZ Martin a až potom napĺňať city_council_votes.");
}

run();
