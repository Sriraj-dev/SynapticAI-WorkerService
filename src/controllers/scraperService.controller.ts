import { logMemory } from "../utils/utility_methods";
import * as cheerio from "cheerio";


export const ScraperService = {
  async getWebsiteContent(url : string){
      let content = ''

      //TODO: Removing the playwright implementation as it is causing memory issues & just using Cheerio for now.
      //NOTE: This endpoint is not being used currently, so we can safely remove it.
      console.log('📥 Adding to request queue:', url)

      try {
        const res = await fetch(url);
        const html = await res.text();
        const $ = cheerio.load(html);
        $('script, style, nav, header, footer, iframe, noscript').remove();
        content = $('body').text().replace(/\s+/g, ' ').trim();
        console.log("Cheerio content fetched successfully", content);
  
        return content;
      } catch (err) {
        console.error('Cheerio also failed:', err);
        return '';
      }

      // 🧠 Check memory before Playwright
    //   const heapUsedMB = process.memoryUsage().heapUsed / 1024 / 1024
    //   if (heapUsedMB > 210) {
    //     console.warn('⚠️ Memory too high for Playwright, using Cheerio fallback')
    //     return await fallbackToCheerio(requestQueue)
    //   }
    
    //   try {
    //     console.log('🚀 Launching PlaywrightCrawler')
    //     logMemory('Before PlaywrightCrawler Init')

    //     const playwrightCrawler = new PlaywrightCrawler({
    //       requestQueue,
    //       maxRequestsPerCrawl: 1,
    //       launchContext: {
    //         launchOptions: {
    //           headless: true,
    //           args: ['--no-sandbox', '--disable-setuid-sandbox'],
    //         },
    //       },
    //       async requestHandler({ page }) {
    //         console.log('🔍 Scraping with Playwright:', page.url())
    //         await page.waitForLoadState('networkidle')
    //         content = await page.evaluate(() => {
    //           document.querySelectorAll('script, style, nav, header, footer, iframe, noscript').forEach(el => el.remove())
    //           return document.body.innerText.replace(/\s+/g, ' ').trim()
    //         })
    //       },
    //       requestHandlerTimeoutSecs: 15,
    //     })

    //     logMemory('After PlaywrightCrawler Init')

    //     await playwrightCrawler.run();
    //     requestQueue.drop()

    //     return content;
    //   } catch (error) {
    //     console.warn('Playwright failed, falling back to Cheerio (SSR):', error);
    //   }
    // }
  }

}
