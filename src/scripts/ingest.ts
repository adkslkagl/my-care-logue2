
import 'dotenv/config';
import fs from 'fs/promises';
import PDFParser from 'pdf2json';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { qdrant, COLLECTION_NAME, initCollection } from '../lib/qdrant';
import { embedText } from '../lib/embedding';

function extractTextFromPdf(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const parser = new PDFParser();
    parser.on('pdfParser_dataReady', (data: any) => {
      const text = data.Pages
        .flatMap((page: any) => page.Texts)
        .map((t: any) => decodeURIComponent(t.R.map((r: any) => r.T).join('')))
        .join(' ');
      resolve(text);
    });
    parser.on('pdfParser_dataError', reject);
    parser.loadPDF(filePath);
  });
}

async function ingest(filePath: string) {
  // 1. 초기화
  await initCollection();

  // 2. PDF 추출
  const text = await extractTextFromPdf(filePath);
  console.log(`추출 완료: ${text.length}자`);

  // 3. 청킹
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 400,
    chunkOverlap: 80,
  });
  const docs = await splitter.createDocuments([text]);
  console.log(`청크 ${docs.length}개 생성`);

  // 4. 임베딩 + Qdrant 저장
  for (let i = 0; i < docs.length; i++) {
    const vector = await embedText(docs[i].pageContent);
    await qdrant.upsert(COLLECTION_NAME, {
      points: [{
        id: Date.now() + i,
        vector,
        payload: {
          content: docs[i].pageContent,
          source: filePath,
        },
      }],
    });
    console.log(`${i + 1}/${docs.length} 저장 완료`);
  }

  console.log('인제스트 완료!');
}

ingest('D:/my-care-logue2/docs/care_guide.pdf');