import { AnyColumn, eq, type InferInsertModel, sql } from "drizzle-orm"
import { db } from "./connectToPG"
import { notes, NoteStatusLevel, NoteStatusReason, semanticNotes, SubscriptionTier, userUsageMetrics } from "./schema"
import type { NewUserUsageMetrics, UserUsageMetrics } from "../../utils/models"

export const DBHandler = {

    async insertEmbeddings(records : InferInsertModel<typeof semanticNotes>[]){
        if(records.length === 0) {
            console.warn("No chunk Embeddings found to insert")
            return
        }

        try{
            const inserted = await db.insert(semanticNotes).values(records).returning()

            console.log(`✅ Inserted ${inserted.length} chunk embeddings for note ${records[0]?.noteId}`)
        }catch(err){
            console.error("❌ Error in inserting chunk embeddings", err)
            throw err;
        }
    },

    async deleteEmbeddings(noteId : string){
        try{
            await db.delete(semanticNotes).where(eq(semanticNotes.noteId, noteId))

            console.log(`✅ Deleted chunk embeddings for note ${noteId}`)
        }catch(err){
            console.error("❌ Error in deleting chunk embeddings", err)
            throw err;
        }
    },

    async updateNoteStatus(status : NoteStatusLevel,noteId: string,reason? : NoteStatusReason){
        try{
            const note = await db.select().from(notes).where(eq(notes.uid, noteId)).limit(1);

            if (note.length === 0) {
                console.warn(`⚠️ Note with ID ${noteId} not found. Skipping update.`);
                return;
            }

            await db.update(notes).set({status: status, reason: reason}).where(eq(notes.uid, noteId))

            console.log(`✅ Updated note status for note ${noteId} to ${status}`)
        }catch(err){
            console.error("❌ Error in updating note status", err)
            throw err
        }
    },

    async getUserUsageMetrics(userId: string) : Promise<UserUsageMetrics | null> {
        try{
           const userMetrics = await db.select().from(userUsageMetrics).where(eq(userUsageMetrics.userId, userId))

           return userMetrics.length > 0 ? userMetrics[0] : null;
           
        }catch(err){
            console.log("Unable to get the user usage metrics from neon database : ", err)
            return null
        }
    },

    async createUserUsageMetrics(userId: string, subscription_tier : SubscriptionTier) : Promise<UserUsageMetrics> {
        try{
            const newMetrics: NewUserUsageMetrics = {
                userId: userId,
                //TODO: Set the limit values based on the subcription tier.
            };

            const metrics = await db.insert(userUsageMetrics).values(newMetrics).returning();
            return metrics[0];
        }catch(err){
            console.log("Unable to create user usage metrics in neon database : ", err);
            throw err;
        }
    }, 

    async incrementUserUsageMetrics(userId : string, embedded_tokens_used : number = 0) : Promise<UserUsageMetrics> {
        try{
            const increment = (column: AnyColumn, value = 1) => {
                return sql`${column} + ${value}`;
            };

            const userMetrics = await db.update(userUsageMetrics).set({
                total_embedded_tokens: increment(userUsageMetrics.total_embedded_tokens, embedded_tokens_used),
                updatedAt: new Date(),
            })
            .where(eq(userUsageMetrics.userId, userId)).returning()
            
            return userMetrics[0];
        }catch(err){
            console.log("Unable to increment user usage metrics in neon database : ", err);
            throw err;
        }
    }
}