

// export type JobQueue = "create-note-semantics" | "update-note-semantics" | "delete-note-semantics"

export enum BullMqJobQueue {
    SEMANTICS_QUEUE = "semantics-queue",
    PERSIST_DATA_QUEUE = "persist-data-queue"
}

export enum JobTypes {
    CREATE_SEMANTICS = "create-note-semantics",
    UPDATE_SEMANTICS = "update-note-semantics",
    DELETE_SEMANTICS = "delete-note-semantics",
    PERSIST_NOTE_DATA = "persist-note-data"
}

export interface CreateSemanticsJob{
    noteId : string,
    userId : string, //Denotes whose knowledge base it belongs to
    data: string // Title + content of the note
}

export interface UpdateSemanticsJob{
    noteId : string,
    userId : string, //Might not be required
    data: string 
}

export interface DeleteSemanticsJob{
    noteId : string,
}