const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const mappings = {
    "Dopravný podnik mesta Martin, s.r.o.": "53733052",
    "Sociálny podnik mesta Martin, s.r.o., r.s.p.": "53127594",
    "Brantner Fatra s.r.o.": "31578861",
    "VODAKAN, s.r.o.": "36737526",
    "STAVAJ-SK,s.r.o.": "47493540",
    "Energie2, a.s.": "46113177",
    "POH, s.r.o. \"registrovaný sociálny podnik\"": "53736507",
    "BD Pltníky, s.r.o.,": "50417931",
    "COREX SERVIS, s.r.o.": "47063626",
    "PMR STAVBY s.r.o.": "52126292",
    "HAKOM, s.r.o.": "36391484",
    "STAVBY MV, s.r.o.": "50499695",
    "Truck Service PU s.r.o.": "44673621",
    "EEI s.r.o.": "46830500",
    "ÚEOS - Komercia, a.s.": "31329209",
    "MIPE Invest, s.r.o.": "46376518",
    "MARTSTAV, s.r.o.": "36412155",
    "MARO, s.r.o.": "31637779",
    "DE BAARS SK, s.r.o.": "44342373",
    "JG-STAVING PLUS s.r.o.": "46244450",
    "DOXX-Stravné lístky, spol. s r.o.": "36391000",
    "ERPOS, spol. s r.o.": "31592651",
    "Aricoma Systems s.r.o.": "35692715",
    "PRIEMSTAV STAVEBNÁ, a.s.": "31596771",
    "TransData s.r.o.": "35878487",
    "fpoho, s.r.o.": "46059954",
    "DAQE Slovakia s.r.o.": "47528351",
    "NARKO s.r.o.": "47021672",
    "K&K TECHNOLOGY a.s.": "25211929",
    "SEZAKO Trnava, s.r.o.": "36247341",
    "Luan, s.r.o.": "50392947",
    "Up Déjeuner, s. r. o.": "31396674",
    "KOOPERATIVA poisťovňa, a.s. Vienna Insurance Group": "00585441",
    "Blue Butterfly Desing international, s.r.o": "44331452",
    "ATA Green, s.r.o.": "53181815",
    "RIKOSTAV CONTAINER, s. r. o.": "47019805",
    "Orange Slovensko. a.s.": "35697270",
    "ARTSPECT spol. s r.o.,": "36413283",
    "Tichý, s.r.o.": "46832201",
    "MONASTER, s.r.o.": "47069152"
};

(async () => {
    for (const [name, ico] of Object.entries(mappings)) {
        console.log(`Updating ${name} -> ${ico}`);
        const { error } = await supabase.from('entities').update({ ico: ico }).eq('name', name);
        if (error) console.error(error);
    }
    console.log("Done!");
})();
