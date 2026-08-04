const cloudscraper = require('cloudscraper');
const cheerio = require('cheerio');
(async () => {
  try {
    const html = await cloudscraper.get('https://finstat.sk/53560922'); // Dopravny podnik
    const $ = cheerio.load(html);
    const metaDesc = $('meta[name="description"]').attr('content');
    console.log(metaDesc);
  } catch (err) {
    console.error('Error:', err.message);
  }
})();
