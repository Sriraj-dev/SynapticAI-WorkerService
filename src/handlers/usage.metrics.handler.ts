import { DBHandler } from "../services/Postgres/DbHandler";
import { SubscriptionTier } from "../services/Postgres/schema";


export const UserUsageMetricsHandler = {

    async checkKnowledgeBaseUsageLimit(userId : string) : Promise<boolean>{
        try{
            let userMetrics = await DBHandler.getUserUsageMetrics(userId);
            
            if(!userMetrics) {
                console.warn("No usage metrics found for user: ", userId);
                userMetrics = await DBHandler.createUserUsageMetrics(userId, SubscriptionTier.Basic);
            }

            if(userMetrics && userMetrics.total_embedded_tokens >= userMetrics.embedded_tokens_limit) {
                console.warn("User has reached the limit for knowledge base usage");
                return false
            }

            return true
        }catch(err){
            console.error("❌ Error in checking knowledge base usage", err)
            return false;
        }
    },

    async updateUsageMetrics(usereId: string, embedded_tokens_used : number){
        try{
            await DBHandler.incrementUserUsageMetrics(usereId, embedded_tokens_used);
            console.log("✅ Usage metrics updated successfully");
        }catch(err){
            console.error("❌ Error in updating usage metrics", err);
        }
    }

}