import type { InferInsertModel, InferSelectModel } from "drizzle-orm"
import type { notes, userUsageMetrics } from "../services/Postgres/schema"

//UsageMetrics
export type NewUserUsageMetrics = InferInsertModel<typeof userUsageMetrics>
export type UserUsageMetrics = InferSelectModel<typeof userUsageMetrics>

export type NewNote = InferInsertModel<typeof notes>;
export type Note = InferSelectModel<typeof notes>;
