const express = require('express');
const { chromium } = require('playwright');

const app = express();
app.use(express.json());

const KEYWORDS = ['privacy', 'dpa', 'legal', 'trust', 'terms'];

async function scrapeUrl(browser, url) {
  try {
    const page = await browser.newPage();
    await page.setExtraHTTPHeaders({
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    });
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
    const text = await page.evaluate(() => document.body.innerText);
    await page.close();
    return text.slice(0, 15000);
  } catch (e) {
    return null;
  }
}

async function findLinks(browser, url) {
  try {
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
    const links = await page.evaluate((keywords) => {
      const anchors = Array.from(document.querySelectorAll('a'));
      const found = {};
      anchors.forEach(a => {
        const href = a.href;
        const text = a.innerText.toLowerCase();
        keywords.forEach(kw => {
          if (!found[kw] && (href.includes(kw) || text.includes(kw))) {
            found[kw] = href;
          }
        });
      });
      return found;
    }, KEYWORDS);
    await page.close();
    return links;
  } catch (e) {
    return {};
  }
}

app.post('/scrape', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'URL is required' });

  const browser = await chromium.launch();
  try {
    const homepage = await scrapeUrl(browser, url);
    const links = await findLinks(browser, url);

    const results = { homepage, found_urls: links };

    for (const [key, link] of Object.entries(links)) {
      results[key] = await scrapeUrl(browser, link);
    }

    res.json(results);
  } catch (e) {
    res.status(500).json({ error: e.message });
  } finally {
    await browser.close();
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Scraper running on port ${PORT}`));
