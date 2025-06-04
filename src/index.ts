import './config/env'
import { Hono } from "hono";
import {cors} from "hono/cors"
// import { serve } from '@hono/node-server'
// import { ScraperServiceRouter } from "./routes/scraper_service";
import { StatusCodes } from './utils/ErrorHandling/statusCodes';
import { AppError } from './utils/ErrorHandling/errors';
import { InvokeRedisQueueHandlers } from './handlers/redis.queue.handlers';
import { logMemory } from './utils/utility_methods';


const app = new Hono();

// ✅ Setup secure CORS policy
app.use(
    '*',
    cors({
        origin: (origin) => {
            if (!origin) return '' // block curl or server-to-server requests
        
            const devAllowedOrigins = [
                'http://localhost:*',
                'http://localhost:3000',
                'https://backend.dev.synapticai.app',
            ]
            const prodAllowedOrigin = 'https://backend.prod.synapticai.app'
        
            if (process.env.ENVIRONMENT === 'PROD') {
                return origin === prodAllowedOrigin ? origin : ''
            } else {
                return devAllowedOrigins.includes(origin) ? origin : ''
            }
        },
        credentials: true,
    })
)
      
app.onError((err, c) => {
	if (err instanceof AppError) { 
		return c.json({ message: err.message }, err.statusCode )
	}

    if(err instanceof SyntaxError) {
        return c.json({ message: 'Invalid JSON body in the request' }, StatusCodes.BAD_REQUEST)
    }

	console.error('[Sever ERROR]:', err)
	return c.json({ message: 'Internal Server Error' , detail: `Name: ${err.name},Message : ${err.message}, Stack: ${err.stack}, Cause: ${err.cause}`}, 500)
})


logMemory("StartApp")
app.get('/', (c) => c.text('SynapticAI WorkerService can only be access from SynapticAI Server'))
// app.route('/crawler', ScraperServiceRouter)

Bun.serve(
    {
        fetch: app.fetch,
        port: process.env.WORKER_SERVICE_PORT? parseInt(process.env.WORKER_SERVICE_PORT) : 5001,
        hostname: '::'
    }
)

console.log(`✅ SynapticAI Worker Service is running at ${process.env.WORKER_SERVICE_PORT} in ${process.env.ENVIRONMENT} environment`)

InvokeRedisQueueHandlers()

