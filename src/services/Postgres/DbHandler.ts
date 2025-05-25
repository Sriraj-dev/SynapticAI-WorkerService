import { eq, InferInsertModel, sql } from "drizzle-orm"
import { db } from "./connectToPG"
import { notes, NoteStatusLevel, semanticNotes } from "./schema"

export const DBHandler = {

    async insertEmbeddings(records : InferInsertModel<typeof semanticNotes>[]){
        if(records.length === 0) {
            console.warn("No chunk Embeddings found to insert")
            return
        }

        try{
            const inserted = await db.insert(semanticNotes).values(records).returning()

            console.log(`✅ Inserted ${inserted.length} chunk embeddings for note ${records[0].noteId}`)
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

    async updateNoteStatus(status : NoteStatusLevel, noteId: string){
        try{
            await db.update(notes).set({status}).where(eq(notes.uid, noteId))

            console.log(`✅ Updated note status for note ${noteId} to ${status}`)
        }catch(err){
            console.error("❌ Error in updating note status", err)
            throw err
        }
    }
}