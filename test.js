const cloudscraper = require('cloudscraper');
const cheerio = require('cheerio');
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
cloudscraper.get('https://finstat.sk/53560922').then(html => {
  const $ = cheerio.load(html);
  console.log($('meta[name="description"]').attr('content'));
}).catch(console.error);
