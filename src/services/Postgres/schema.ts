import { relations, sql } from "drizzle-orm";
import { bigint, primaryKey, vector } from "drizzle-orm/pg-core";
import { uuid } from "drizzle-orm/pg-core";
import { integer } from "drizzle-orm/pg-core";
import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export enum SubscriptionTier {
    Basic = 'Basic',
    Advanced = 'Advanced',
    Elite = 'Elite'
}

export enum AccessLevel{
    Owner = 'Owner',
    View = 'View',
    Edit = 'Edit',
    Denied = 'Denied'
}

export enum AccessStatus{
    Granted = 'Granted',
    Pending = 'Pending',
    Denied = 'Denied'
}

export enum TaskStatusLevel{
    Backlog = 'Backlog',
    Next = 'Next',
    Blocked = 'Blocked',
    InProgress = 'InProgress',
    Completed = 'Completed',
}

export enum NoteStatusLevel{
    Creating = 'Creating',
    Memorizing = 'Memorizing',
    Updating = 'Updating',
    Completed = 'Completed',
    FailedToMemorize = 'Failed To Memorize',
    FailedToCreate = 'Failed To Create',
}

// Users Table
export const users = pgTable("users", {
  uid : text().primaryKey(),
  username: text().notNull().unique(),
  email: text(),
  name: text(),
  phone: text(),
  memories: text(),
  subscription_tier : text().notNull().default(SubscriptionTier.Basic),
  amount_paid : bigint("amount_paid", { mode: "number" }).default(0),
  subscription_start_date : timestamp().notNull().defaultNow(),
  subscription_end_date : timestamp(),
  createdAt: timestamp().defaultNow(),
  updatedAt: timestamp().defaultNow(),
});

//notes table
export const notes = pgTable("notes", {
  uid: uuid().defaultRandom().primaryKey(),
  owner_id: text().references(() => users.uid, {onDelete: "cascade"}).notNull(),
  folder: text().default("All"),
  title: text(),
  content: text().notNull(), //HTML, JSON or Plain Text
  status: text().notNull().default(NoteStatusLevel.Creating),
  createdAt: timestamp().defaultNow(),
  updatedAt: timestamp().defaultNow(),
})

//embeddings table

export const semanticNotes = pgTable(
    "semantic_notes",
    {
      userId: text("user_id")
        .notNull()
        .references(() => users.uid, { onDelete: "cascade" }),
  
      noteId: uuid("note_id")
        .notNull()
        .references(() => notes.uid, { onDelete: "cascade" }),
  
      content: text("content"),
  
      totalChunks: integer("total_chunks"),
  
      chunkIndex: integer("chunk_index"),
  
      embedding: vector("embedding", { dimensions: 768 }),
  
      embeddingV2: vector("embedding_v2", { dimensions: 1536 }),
    },
    (table) => ([
        primaryKey({ columns: [table.userId, table.noteId, table.chunkIndex] }),
    ])
);


//noteAccess Table
export const noteAccess = pgTable("note_access",{
    uid: uuid("id").defaultRandom().primaryKey(),
    note_id: uuid().references(() => notes.uid, {onDelete: "cascade"}).notNull(),
    owner_id: text().references(() => users.uid, {onDelete: "cascade"}).notNull(),
    user_id: text().references(() => users.uid, {onDelete: "cascade"}),
    access_level: text().notNull(),
    status: text().notNull().default(AccessStatus.Pending),
    createdAt: timestamp().defaultNow(),
    updatedAt: timestamp().defaultNow(),
})

//Tasks Table
export const tasks = pgTable("tasks", {
  uid: uuid().defaultRandom().primaryKey(),
  owner_id: text().references(() => users.uid, {onDelete: "cascade"}).notNull(),
  title: text().notNull(),
  content: text(),
  status: text().notNull().default(TaskStatusLevel.Next),
  time_logged: integer().default(0),
  createdAt: timestamp().defaultNow(),
  updatedAt: timestamp().defaultNow(),
})

//Table Relations
export const usersRelations = relations(users, ({ many }) => ({
    notes: many(notes),
    tasks: many(tasks),
    noteAccess: many(noteAccess),
}))

export const notesRelations = relations(notes, ({ one, many }) => ({
    owner: one(users, {
        fields: [notes.owner_id],
        references: [users.uid],
    }),
    noteAccess: many(noteAccess),
}))

export const tasksRelations = relations(tasks, ({ one }) => ({
    owner: one(users, {
        fields: [tasks.owner_id],
        references: [users.uid],
    }),
}))
