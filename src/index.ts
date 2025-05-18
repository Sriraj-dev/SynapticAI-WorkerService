import './config/env'
import { Hono } from "hono";
import { serve } from '@hono/node-server'
import { ScraperServiceRouter } from "./routes/scraper_service";


const app = new Hono();

//TODO: Add CORS Policy
//TODO: Add Error Handling

app.get('/', (c) => c.text('SynapticAI WorkerService can only be access from SynapticAI Server'))
app.route('/crawler', ScraperServiceRouter)

serve({fetch: app.fetch, port: process.env.WORKER_SERVICE_PORT? parseInt(process.env.WORKER_SERVICE_PORT) : 5001})

console.log(`✅ SynapticAI Worker Service is running at ${process.env.WORKER_SERVICE_PORT} in ${process.env.ENVIRONMENT} environment`)

