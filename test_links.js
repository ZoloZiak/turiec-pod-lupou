const https = require('https');

const checkUrl = (url) => {
  return new Promise((resolve) => {
    https.get(url, (res) => {
      resolve({ url, status: res.statusCode });
    }).on('error', () => resolve({ url, status: 'ERROR' }));
  });
};

async function run() {
  const urls = [
    'https://myturiec.sme.sk/c/23048995/jan-danko-sluboval-v-kampani-aj-novu-nemocnicu.html', // My old hospital URL
    'https://myturiec.sme.sk/t/7943/jan-danko', // Tag for Janko Danko
    'https://www.martin.sk/lanovka-na-martinske-hole/d-71861', // Possible lanovka url
    'https://myturiec.sme.sk/c/22646270/v-martine-sa-pripravuje-nova-parkovacia-politika.html', // Parking url
    'https://myturiec.sme.sk/c/22998822/komunalne-volby-2022-jan-danko-bude-opat-kandidovat-na-post-primatora-martina.html', // Election 2022
    'https://www.martin.sk/hospodarenie-mesta/os-1025' // Hospodarenie
  ];
  for (const url of urls) {
    const res = await checkUrl(url);
    console.log(res.url, res.status);
  }
}
run();
