import { embeddingModel } from "../services/AI/aiModels";
import redis from "../services/redis";
import { AppError } from "../utils/ErrorHandling/errors";
import { StatusCodes } from "../utils/ErrorHandling/statusCodes";
import type { CreateSemanticsJob, DeleteSemanticsJob, UpdateSemanticsJob } from "../utils/redis/constants";
import { JobQueue } from "../utils/redis/constants";
import {TokenTextSplitter} from "@langchain/textsplitters"
import { NoteStatusLevel, NoteStatusReason, semanticNotes } from "../services/Postgres/schema";
import type { InferInsertModel } from "drizzle-orm";
import { DBHandler } from "../services/Postgres/DbHandler";
import { UserUsageMetricsHandler } from "./usage.metrics.handler";
import { estimateTokens } from "../utils/utility_methods";

const RedisQueueHandlers = {

    async CreateNoteSemantics(rawJob : string){
        console.log("Creating note semantics: ", rawJob)
        const job = JSON.parse(rawJob) as CreateSemanticsJob
        const {noteId, userId, data} = job

        try{
            // Check usage limits before proceeding
            const canUseKnowledgeBase = await UserUsageMetricsHandler.checkKnowledgeBaseUsageLimit(userId);

            if(!canUseKnowledgeBase) {
                console.warn("User has reached the limit for knowledge base usage, skipping note semantics creation")
                await DBHandler.updateNoteStatus(NoteStatusLevel.FailedToMemorize, noteId, NoteStatusReason.TokenLimitReached)
                return
            }

            //1. Convert the notes into proper chunks
            const splitter = new TokenTextSplitter({
                chunkSize: 150,
                chunkOverlap: 25,
            });

            const chunks = await splitter.splitText(data);

            //2. Create Embeddings for each chunk
            const embeddings = await embeddingModel.getTextEmbeddings(chunks)

            //3. Push the embeddings into pg table
            var records = embeddings.map((embedding, index) => {
                return {
                    userId,
                    noteId,
                    content: chunks[index],
                    totalChunks: chunks.length,
                    chunkIndex: index,
                    embedding: null,
                    embeddingV2: embedding
                } as InferInsertModel<typeof semanticNotes>
            })

            await DBHandler.insertEmbeddings(records)

            //4. Mark the status as completed in notes table
            await DBHandler.updateNoteStatus(NoteStatusLevel.Completed, noteId)

            //5. Update the user usage metrics
            await UserUsageMetricsHandler.updateUsageMetrics(userId, estimateTokens(data));

            console.log("✅ Created note semantics for note: ", noteId)
        }catch(err){
            console.error("Error in creating note semantics", err)
            await DBHandler.updateNoteStatus(NoteStatusLevel.FailedToMemorize, noteId)
        }
    },

    async DeleteNoteSemantics(rawJob : string){
        console.log("Deleting note semantics: ", rawJob)
        const job = JSON.parse(rawJob) as DeleteSemanticsJob
        const {noteId} = job

        try{
            await DBHandler.deleteEmbeddings(noteId)

            await DBHandler.updateNoteStatus(NoteStatusLevel.FailedToMemorize, noteId, NoteStatusReason.UserCancelled)

            console.log("✅ Deleted note semantics for note: ", noteId)
        }catch(err){
            console.error("❌ Error in deleting note semantics", err)
            throw err
        }
    },

    async UpdateNoteSemantics(rawJob : string){
        console.log("Updating note semantics: ", rawJob)
        const job = JSON.parse(rawJob) as UpdateSemanticsJob
        const {noteId, userId, data} = job

        try{
            //1. Delete the existing embeddings
            await DBHandler.deleteEmbeddings(noteId)

            //2. Update the status of the note
            await DBHandler.updateNoteStatus(NoteStatusLevel.Memorizing, noteId)

            // Update the usage metrics.
            await UserUsageMetricsHandler.updateUsageMetrics(userId, -1 * estimateTokens(data));

            //3. Insert new embeddings
            await RedisQueueHandlers.CreateNoteSemantics(rawJob)
            console.log("✅ Updated note semantics for note: ", noteId)
        }catch(err){
            console.error("Error in updating note semantics", err)
        }

    }
}


export async function InvokeRedisQueueHandlers(){

    // All the messages to sent to 3 queues are executed one by one, 
    // TODO: Figure out if we can efficiently handle tasks paralelly per queue atleast.
    // Tasks in a single queue can be executed one by one , no issues with that.
    console.log("🔄 Starting Redis Queue Handlers...")
    while (true){
        try{
            const res = await redis.blpop([JobQueue.UPDATE_SEMANTICS, JobQueue.CREATE_SEMANTICS, JobQueue.DELETE_SEMANTICS], 0)

            if(!res) {
                console.log("No job found in queue")
                continue
            };
            const [queue, job] = res

            switch(queue){
                case JobQueue.CREATE_SEMANTICS:
                    await RedisQueueHandlers.CreateNoteSemantics(job)
                    break
                case JobQueue.UPDATE_SEMANTICS:
                    await RedisQueueHandlers.UpdateNoteSemantics(job)
                    break
                case JobQueue.DELETE_SEMANTICS:
                    await RedisQueueHandlers.DeleteNoteSemantics(job)
                    break
                default:
                    throw new AppError("Invalid Job Type", StatusCodes.NOT_FOUND)
            }

        }catch(err){
            console.log("❌ Error in Redis Queue Handlers:", err)
        }
    }
}
