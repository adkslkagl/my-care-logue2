import { QdrantClient } from '@qdrant/js-client-rest';

export const qdrant = new QdrantClient({
  url: process.env.QDRANT_URL ?? 'http://localhost:6333',
});

export const COLLECTION_NAME = 'care_docs';

export async function initCollection() {
  const result = await qdrant.collectionExists(COLLECTION_NAME);
  if (!result.exists) {
    await qdrant.createCollection(COLLECTION_NAME, {
      vectors: { size: 3072, distance: 'Cosine' },
    });
    console.log('컬렉션 생성 완료');
  }
}