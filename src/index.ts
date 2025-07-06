import './config/env'
import { logMemory } from './utils/utility_methods';
import {Worker} from 'bullmq';
import { BullMqJobQueue, JobTypes } from './utils/redis/constants';
import redis from './services/redis/redis';
import { PersistDataHandler, SemanticsHandler } from './handlers/redis.queue.handlers';



logMemory("StartApp")

const semanticsQueueWorker = new Worker(
    BullMqJobQueue.SEMANTICS_QUEUE,
    async (job)=> {
        try{
            switch(job.name){
                case JobTypes.UPDATE_SEMANTICS:
                    console.log("✅ Debounce finished, Updating the Note Semantics");
                    await SemanticsHandler.UpdateNoteSemantics(job.data)
                    break;
                
                case JobTypes.CREATE_SEMANTICS:
                    await SemanticsHandler.CreateNoteSemantics(job.data)
                    break;
    
                case JobTypes.DELETE_SEMANTICS:
                    await SemanticsHandler.DeleteNoteSemantics(job.data)
                    break;
                
                default : 
                    console.error(`❌ Job ${job.name} is not implemented in BullMq worker`);
            }
        }catch(err){
            console.error(`❌ Error in BullMQ worker for job ${job.name}`, err);
        }
    }, 
    {connection: redis}
)

const persistDataQueueWorker = new Worker(
    BullMqJobQueue.PERSIST_DATA_QUEUE,
    async (job) => {
        try{
            switch(job.name){
                case JobTypes.PERSIST_NOTE_DATA:
                    console.log("✅ Persisting Note Data");
                    await PersistDataHandler.PersistNoteData(job.data)
                    break;
                
                default:
                    console.error(`❌ Job ${job.name} is not implemented in BullMq worker`);
            }
        }catch(err){
            console.error(`❌ Error in BullMQ worker for job ${job.name}`, err);
        }

    },
    {connection: redis}
)


semanticsQueueWorker.on("ready", () => {
    console.log("🚀 BullMQ Semantics Queue worker is ready and listening!");
});
persistDataQueueWorker.on("ready", () => {
    console.log("🚀 BullMQ Persist Data Queue worker is ready and listening!");
});

semanticsQueueWorker.on("failed", (job, err) => {
    console.error(`❌ BullMQ semantics worker failed`, err);
});
persistDataQueueWorker.on("failed", (job, err) => {
    console.error(`❌ BullMQ persist data worker failed`, err);
});


// const app = new Hono();

// ✅ Setup secure CORS policy
// app.use(
//     '*',
//     cors({
//         origin: (origin) => {
//             if (!origin) return '' // block curl or server-to-server requests
        
//             const devAllowedOrigins = [
//                 'http://localhost:*',
//                 'http://localhost:3000',
//                 'https://backend.dev.synapticai.app',
//             ]
//             const prodAllowedOrigin = 'https://backend.prod.synapticai.app'
        
//             if (process.env.ENVIRONMENT === 'PROD') {
//                 return origin === prodAllowedOrigin ? origin : ''
//             } else {
//                 return devAllowedOrigins.includes(origin) ? origin : ''
//             }
//         },
//         credentials: true,
//     })
// )
      
// app.onError((err, c) => {
// 	if (err instanceof AppError) { 
// 		return c.json({ message: err.message }, err.statusCode )
// 	}

//     if(err instanceof SyntaxError) {
//         return c.json({ message: 'Invalid JSON body in the request' }, StatusCodes.BAD_REQUEST)
//     }

// 	console.error('[Sever ERROR]:', err)
// 	return c.json({ message: 'Internal Server Error' , detail: `Name: ${err.name},Message : ${err.message}, Stack: ${err.stack}, Cause: ${err.cause}`}, 500)
// })


// app.get('/', (c) => c.text('SynapticAI WorkerService can only be access from SynapticAI Server'))
// app.route('/crawler', ScraperServiceRouter)

// Bun.serve(
//     {
//         fetch: app.fetch,
//         port: process.env.WORKER_SERVICE_PORT? parseInt(process.env.WORKER_SERVICE_PORT) : 5001,
//         hostname: '::'
//     }
// )

// console.log(`✅ SynapticAI Worker Service is running at ${process.env.WORKER_SERVICE_PORT} in ${process.env.ENVIRONMENT} environment`)
