const https = require('https');

function search(query) {
  const q = encodeURIComponent(query);
  const options = {
    hostname: 'html.duckduckgo.com',
    port: 443,
    path: `/html/?q=${q}`,
    method: 'GET',
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
    rejectUnauthorized: false
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const links = [];
        const regex = /<a class="result__url" href="([^"]+)">/g;
        let match;
        while ((match = regex.exec(data)) !== null) {
          const rawUrl = match[1];
          let cleanUrl = rawUrl;
          if (rawUrl.startsWith('//duckduckgo.com/l/?uddg=')) {
            cleanUrl = decodeURIComponent(rawUrl.split('uddg=')[1].split('&')[0]);
          }
          links.push(cleanUrl);
        }
        resolve(links);
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function run() {
  const results = await search('site:martin.sk filetype:pdf Program hospodárskeho a sociálneho rozvoja');
  console.log("PHSR:", results[0]);
  
  const results2 = await search('site:martin.sk filetype:pdf statickej dopravy');
  console.log("Parkovanie:", results2[0]);
  
  const results3 = await search('site:martin.sk filetype:pdf rozpocet mesta');
  console.log("Dlh:", results3[0]);
}
run();
