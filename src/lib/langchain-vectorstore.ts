import { QdrantVectorStore } from "@langchain/qdrant";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { QdrantClient } from "@qdrant/js-client-rest";
import { computeSparseVector } from "./sparse-embedding";

const qdrantClient = new QdrantClient({
  url: process.env.QDRANT_URL || "http://localhost:6333",
});

const embeddings = new GoogleGenerativeAIEmbeddings({
  apiKey: process.env.GEMINI_API_KEY,
  model: "gemini-embedding-001",  // 기존과 동일하게!
});

export async function getVectorStore(collectionName: string) {
  return await QdrantVectorStore.fromExistingCollection(
    embeddings,
    {
      client: qdrantClient,
      collectionName,
    }
  );
}

export { embeddings, qdrantClient };

export async function hybridSearch(
  collectionName: string,
  query: string,
  k = 3,
) {
  const [denseVector, sparseVector] = await Promise.all([
    embeddings.embedQuery(query),
    Promise.resolve(computeSparseVector(query)),
  ]);

  const result = await qdrantClient.query(collectionName, {
    prefetch: [
      { query: sparseVector, using: 'sparse', limit: 20 },
      { query: denseVector, using: 'dense', limit: 20 },
    ],
    query: { fusion: 'rrf' },
    limit: k,
    with_payload: true,
  });

  return result.points.map(point => ({
    pageContent: (point.payload as Record<string, unknown>)?.content as string ?? '',
    metadata: point.payload ?? {},
  }));
}