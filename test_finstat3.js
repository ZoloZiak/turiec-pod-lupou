const cloudscraper = require('cloudscraper');
const cheerio = require('cheerio');
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
(async () => {
  const html = await cloudscraper.get('https://finstat.sk/53560922');
  const $ = cheerio.load(html);
  console.log('Title:', $('title').text());
  console.log('H1:', $('h1').text());
  console.log('Description:', $('meta[name="description"]').attr('content'));
  // Let's also find where the year is stated
  console.log('Text containing rok:', $('*:contains("v roku 2025")').length > 0 ? "Has 2025" : "No 2025");
  console.log('Text containing rok:', $('*:contains("v roku 2024")').length > 0 ? "Has 2024" : "No 2024");
})();
