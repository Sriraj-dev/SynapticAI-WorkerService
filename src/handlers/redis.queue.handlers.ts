import { embeddingModel } from "../services/AI/aiModels";
import type { CreateSemanticsJob, DeleteSemanticsJob, UpdateSemanticsJob } from "../utils/redis/constants";
import {TokenTextSplitter} from "@langchain/textsplitters"
import { NoteStatusLevel, NoteStatusReason, semanticNotes } from "../services/Postgres/schema";
import type { InferInsertModel } from "drizzle-orm";
import { DBHandler } from "../services/Postgres/DbHandler";
import { UserUsageMetricsHandler } from "./usage.metrics.handler";
import { estimateTokens } from "../utils/utility_methods";
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
            await DBHandler.updateNote(NoteStatusLevel.Completed, noteId)

            //5. Update the user usage metrics
            await UserUsageMetricsHandler.updateUsageMetrics(userId, estimateTokens(data));

            console.log("✅ Created note semantics for note: ", noteId)
        }catch(err){
            console.error("Error in creating note semantics", err)
            await DBHandler.updateNote(NoteStatusLevel.FailedToMemorize, noteId)
        }
    },

    async DeleteNoteSemantics(rawJob : string){
        console.log("Deleting note semantics: ", rawJob)
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

    async UpdateNoteSemantics(rawJob : string){
        console.log("Updating note semantics: ", rawJob)
        // const job = JSON.parse(rawJob) as UpdateSemanticsJob
        // const {noteId, userId, data} = job

        // try{
        //     //1. Delete the existing embeddings
        //     await DBHandler.deleteEmbeddings(noteId)

        //     //2. Update the status of the note
        //     await DBHandler.updateNoteStatus(NoteStatusLevel.Memorizing, noteId)

        //     // Update the usage metrics.
        //     await UserUsageMetricsHandler.updateUsageMetrics(userId, -1 * estimateTokens(data));

        //     //3. Insert new embeddings
        //     await RedisQueueHandlers.CreateNoteSemantics(rawJob)
        //     console.log("✅ Updated note semantics for note: ", noteId)
        // }catch(err){
        //     console.error("Error in updating note semantics", err)
        // }

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
        }catch(err){
            console.error("Error in persisting note data", err)
        }
    }
}