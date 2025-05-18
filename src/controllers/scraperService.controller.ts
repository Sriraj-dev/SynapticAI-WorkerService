import { CheerioCrawler, PlaywrightCrawler, RequestQueue } from "crawlee";


export const ScraperService = {
  async getWebsiteContent(url : string){
      let content = '';
      console.log("Adding to request queue: ", url)
      logMemory()

      const requestQueue = await RequestQueue.open(undefined);
    
      await requestQueue.addRequest({ url: url });

      console.log("Added to request queue: ", url)
      
      logMemory()
    
      try {
        logMemory()
        console.log("Launching Playwright crawler")

        const playwrightCrawler = new PlaywrightCrawler({
          requestQueue,
          async requestHandler({ page }) {
            console.log("Scraping : ", page.url())
            await page.waitForLoadState('networkidle'); // Wait for dynamic content
            content = await page.evaluate(() => {
              document.querySelectorAll("script, style, nav, header, footer, iframe, noscript").forEach(el => el.remove());
              return document.body.innerText.replace(/\s+/g, " ").trim();
            });
          },
          requestHandlerTimeoutSecs: 15,
        });

        logMemory()
        console.log("Launching Playwright crawler - 2")
        await playwrightCrawler.run();
        return content;
      } catch (error) {
        console.warn('Playwright failed, falling back to Cheerio (SSR):', error);
      }
    
      if(requestQueue.getTotalCount() == 0){
        requestQueue.addRequest({ url: url });
      }
    
      const cheerioCrawler = new CheerioCrawler({
        requestQueue,
        async requestHandler({ $ }) {
          $('script, style, nav, header, footer, iframe, noscript').remove();
          const rawText = $('body').text();
          content = rawText.replace(/\s+/g, " ").trim();
        },
      });
      
      try{
        await cheerioCrawler.run();
        return content;
      }catch(err){
        console.error(err)
        return ''
      }
    }
}

function logMemory() {
  const { heapUsed, heapTotal, rss } = process.memoryUsage();
  console.log(`Memory: RSS=${(rss / 1024 / 1024).toFixed(2)}MB, HeapUsed=${(heapUsed / 1024 / 1024).toFixed(2)}MB, HeapTotal=${(heapTotal / 1024 / 1024).toFixed(2)}MB`);
}