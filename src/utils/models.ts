import type { InferInsertModel, InferSelectModel } from "drizzle-orm"
import type { userUsageMetrics } from "../services/Postgres/schema"

//UsageMetrics
export type NewUserUsageMetrics = InferInsertModel<typeof userUsageMetrics>
export type UserUsageMetrics = InferSelectModel<typeof userUsageMetrics>