const cloudscraper = require('cloudscraper');
const cheerio = require('cheerio');
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
(async () => {
  const html = await cloudscraper.get('https://finstat.sk/53560922');
  const $ = cheerio.load(html);
  const text = $('body').text().replace(/\s+/g, ' ');
  const match = text.match(/v roku (20\d\d)/i);
  console.log('Year match:', match ? match[1] : 'Not found');
})();
