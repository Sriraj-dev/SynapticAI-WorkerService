import { embeddingModel } from "../services/AI/aiModels";
import type { CreateSemanticsJob, DeleteSemanticsJob, UpdateSemanticsJob } from "../utils/redis/constants";
import { NoteStatusLevel, NoteStatusReason, semanticNotes } from "../services/Postgres/schema";
import type { InferInsertModel } from "drizzle-orm";
import { DBHandler } from "../services/Postgres/DbHandler";
import { UserUsageMetricsHandler } from "./usage.metrics.handler";
import { estimateTokens, hashChunk, splitMarkdownIntoRagChunks } from "../utils/utility_methods";
import { RedisStorage } from "../services/redis/storage";

export const SemanticsHandler = {

    async CreateNoteSemantics(rawJob : string){
        console.log("Creating note semantics: ", rawJob)
        const job = JSON.parse(rawJob) as CreateSemanticsJob
        const {noteId, userId, data} = job

        try{
            // Check usage limits before proceeding
            const canUseKnowledgeBase = await UserUsageMetricsHandler.checkKnowledgeBaseUsageLimit(userId);

            if(!canUseKnowledgeBase) {
                console.warn("User has reached the limit for knowledge base usage, skipping note semantics creation")
                await DBHandler.updateNote(NoteStatusLevel.FailedToMemorize, noteId, NoteStatusReason.TokenLimitReached)
                return
            }

            //1. Convert the markdown notes into proper chunks
            const chunks = await splitMarkdownIntoRagChunks(data)

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
                    hash: hashChunk(chunks[index]),
                    embedding: null,
                    embeddingV2: embedding
                } as InferInsertModel<typeof semanticNotes>
            })

            await DBHandler.insertEmbeddings(records)

            //4. Mark the status as completed in notes table
            await DBHandler.updateNote(NoteStatusLevel.Completed, noteId)

            //5. Update the user usage metrics
            await UserUsageMetricsHandler.updateUsageMetrics(userId, estimateTokens(chunks.join(" ")));

            console.log("✅ Created note semantics for note: ", noteId)
        }catch(err){
            console.error("Error in creating note semantics", err)
            await DBHandler.updateNote(NoteStatusLevel.FailedToMemorize, noteId)
        }
    },

    async DeleteNoteSemantics(rawJob : string){
        const job = JSON.parse(rawJob) as DeleteSemanticsJob
        const {noteId} = job

        try{
            await DBHandler.deleteEmbeddings(noteId)

            await DBHandler.updateNote(NoteStatusLevel.FailedToMemorize, noteId, NoteStatusReason.UserCancelled)

            console.log("✅ Deleted note semantics for note: ", noteId)
        }catch(err){
            console.error("❌ Error in deleting note semantics", err)
            throw err
        }
    },

    //This job is usually triggered after 10m of inactivity on the note.
    async UpdateNoteSemantics(rawJob : string){
        const job = JSON.parse(rawJob) as UpdateSemanticsJob
        const {noteId, userId, data} = job

        try{
            //1. Convert the markdown into chunks
            const chunks = await splitMarkdownIntoRagChunks(data)
            const currentHashSet: Set<string> = new Set(chunks.map(c => hashChunk(c)));

            //2. Get the existing chunks of the note.
            const existingChunks = await DBHandler.getSemanticChunks(noteId)
            const existingHashSet = new Set(existingChunks.map(c => c.hash))

            //3. Get the new chunk records that need to be inserted.
            const newChunkRecords = chunks.filter(c => !existingHashSet.has(hashChunk(c)));

            //4. Get the chunk records that needs to be deleted.
            const chunksToDelete = existingChunks.filter(c => !currentHashSet.has(c.hash!))
            const hashesToDelete = chunksToDelete.map(c => c.hash!)

            //5. Delete the chunks that are no longer needed.
            await DBHandler.deleteSemanticChunksByHashes(noteId, hashesToDelete)
            console.log(`✅ Deleted ${hashesToDelete.length} chunks for note: ${noteId}`)

            //6. Update the user usage metrics accordingly.
            await UserUsageMetricsHandler.updateUsageMetrics(userId, -1 * estimateTokens(chunksToDelete.map(c=>c.content).join(" ")));

            //7. Check if we can proceed with inserting new chunks as per user limits.
            const canUseKnowledgeBase = await UserUsageMetricsHandler.checkKnowledgeBaseUsageLimit(userId);
            if(!canUseKnowledgeBase) {
                console.warn("User has reached the limit for knowledge base usage, skipping note semantics update")
                await DBHandler.updateNote(NoteStatusLevel.FailedToMemorize, noteId, NoteStatusReason.TokenLimitReached)
                return
            }

            //8. Insert the new chunks into the database.
            const embeddings = await embeddingModel.getTextEmbeddings(newChunkRecords)
            var records = embeddings.map((embedding, index) => {
                return {
                    userId,
                    noteId,
                    content: newChunkRecords[index],
                    totalChunks: chunks.length,
                    chunkIndex: index,
                    hash: hashChunk(newChunkRecords[index]),
                    embedding: null,
                    embeddingV2: embedding
                } as InferInsertModel<typeof semanticNotes>
            })
            await DBHandler.insertEmbeddings(records)

            //9. Mark the note status as completed in postgres & redis.
            await DBHandler.updateNote(NoteStatusLevel.Completed, noteId)

            //10. Update the User Usage Metrics Accordingly
            await UserUsageMetricsHandler.updateUsageMetrics(userId, estimateTokens(newChunkRecords.join(" ")));

            console.log("✅ Updated note semantics for note: ", noteId)

        }catch(err){
            console.error("Error in updating note semantics", err)
            await DBHandler.updateNote(NoteStatusLevel.FailedToMemorize, noteId)
        }
    }
}

export const PersistDataHandler = {
    async PersistNoteData(rawJob: string){
        console.log("Persisting note data: ", rawJob)
        const job = JSON.parse(rawJob)

        const {noteId} = job
        try{
            const rawNoteData = await RedisStorage.getItem(`Note:${noteId}`)
            if(!rawNoteData){
                console.log("No data found for note: ", noteId)
                return
            }
            const noteData = JSON.parse(rawNoteData)
            const {content, status} : {content: string, status: NoteStatusLevel} = noteData
            
            await DBHandler.updateNote(status, noteId, undefined, content)
            await RedisStorage.removeItem(`Note:${noteId}`) 
        }catch(err){
            console.error("Error in persisting note data", err)
        }
    }
}
