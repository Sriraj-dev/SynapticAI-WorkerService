import { OpenAIEmbedding } from "@llamaindex/openai";

//TODO: Can we  use huggingface opensource embeddings models for this purpose?
export const embeddingModel = new OpenAIEmbedding({
    model:'text-embedding-3-small',
    apiKey: process.env.OPENAI_API_KEY,
})