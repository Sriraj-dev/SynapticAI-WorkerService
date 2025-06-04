import { ScraperService } from "../controllers/scraperService.controller";
import { Hono } from "hono";

export const ScraperServiceRouter = new Hono();

ScraperServiceRouter.get('/crawl-website', async (c) => {
    const url = c.req.query('url');
    if (!url || !url.startsWith('http')) {
      return c.json({ error: 'Invalid URL' }, 400);
    }

    console.log(`Scraping website: ${url}`)
    console.log(process.memoryUsage())

    try {
      const content = await ScraperService.getWebsiteContent(url);
      return c.json({ url, content });
    } catch (err) {
      console.error(err);
      return c.json({ error: 'Failed to scrape content' }, 500);
    }
});