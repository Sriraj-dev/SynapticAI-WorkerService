import { CheerioCrawler, PlaywrightCrawler, RequestQueue } from "crawlee";


export const ScraperService = {
  async getWebsiteContent(url : string){
      let content = '';
      const requestQueue = await RequestQueue.open();
    
      await requestQueue.addRequest({ url: url });
      
      const playwrightCrawler = new PlaywrightCrawler({
        requestQueue,
        launchContext: {
          launchOptions: {
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
          },
        },
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
    
      try {
        console.log("Launching Playwright crawler")
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