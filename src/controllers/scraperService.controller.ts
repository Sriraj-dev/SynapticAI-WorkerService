import { CheerioCrawler, PlaywrightCrawler, RequestQueue } from "crawlee";



function logMemory(label: string) {
  const mem = process.memoryUsage()
  const mb = (bytes: number) => (bytes / 1024 / 1024).toFixed(2) + 'MB'
  console.log(`[${label}] Memory - RSS: ${mb(mem.rss)}, HeapUsed: ${mb(mem.heapUsed)}, HeapTotal: ${mb(mem.heapTotal)}`)
}

async function fallbackToCheerio(requestQueue: RequestQueue){
  let content = '';
  const cheerioCrawler = new CheerioCrawler({
    requestQueue,
    async requestHandler({ $ }) {
      $('script, style, nav, header, footer, iframe, noscript').remove();
      const rawText = $('body').text();
      content = rawText.replace(/\s+/g, " ").trim();
    },
  });
  logMemory('After Cherio Initialisation')
  
  try{
    await cheerioCrawler.run();
    logMemory('After Cheerio Execution')
    requestQueue.drop()
    return content;
  }catch(err){
    console.error(err)
    requestQueue.drop()
    return ''
  }
}

export const ScraperService = {
  async getWebsiteContent(url : string){
      let content = ''

      console.log('📥 Adding to request queue:', url)
      logMemory('Before Queue Init')

      const requestQueue = await RequestQueue.open(`queue-${crypto.randomUUID()}`)

      await requestQueue.addRequest({ url })
      logMemory('After Queue Add')

      // 🧠 Check memory before Playwright
      const heapUsedMB = process.memoryUsage().heapUsed / 1024 / 1024
      if (heapUsedMB > 210) {
        console.warn('⚠️ Memory too high for Playwright, using Cheerio fallback')
        return await fallbackToCheerio(requestQueue)
      }
    
      try {
        console.log('🚀 Launching PlaywrightCrawler')
        logMemory('Before PlaywrightCrawler Init')

        const playwrightCrawler = new PlaywrightCrawler({
          requestQueue,
          maxRequestsPerCrawl: 1,
          launchContext: {
            launchOptions: {
              headless: true,
              args: ['--no-sandbox', '--disable-setuid-sandbox'],
            },
          },
          async requestHandler({ page }) {
            console.log('🔍 Scraping with Playwright:', page.url())
            await page.waitForLoadState('networkidle')
            content = await page.evaluate(() => {
              document.querySelectorAll('script, style, nav, header, footer, iframe, noscript').forEach(el => el.remove())
              return document.body.innerText.replace(/\s+/g, ' ').trim()
            })
          },
          requestHandlerTimeoutSecs: 15,
        })

        logMemory('After PlaywrightCrawler Init')

        await playwrightCrawler.run();
        requestQueue.drop()

        return content;
      } catch (error) {
        console.warn('Playwright failed, falling back to Cheerio (SSR):', error);
        return fallbackToCheerio(requestQueue)
      }
    }
}
