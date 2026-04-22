# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
npm run dev          # Next.js dev server (frontend + API)
npm run build        # Production build
npm run ingest       # Ingest PDF docs into Qdrant (ts-node --project tsconfig.scripts.json)
npx prisma migrate dev --name <name>  # DB migration
npx prisma studio    # DB GUI
```

`tsconfig.scripts.json` exists specifically for `ts-node` — it overrides `module: commonjs` and `moduleResolution: node` because the main tsconfig uses `bundler` resolution incompatible with ts-node.

## Architecture

**요양보호사(care worker) AI counseling platform.** Backend-only Next.js (API routes) — the frontend is a separate mobile project.

### Request Flow

```
POST /api/chat
  → verifyToken() [JWT from Authorization header]
  → regex keyword check (혈압, 번아웃, 욕창 ...)
  → hybridSearch() [Qdrant: dense RRF sparse → top 10]
  → rerankDocs()   [Cohere rerank-v3.5 → top 3]
  → Redis          [last 6 messages as conversation context]
  → LangChain RunnableSequence → Gemini 2.5-flash-lite
  → SSE stream (data: { text } chunks, ends with data: [DONE])
```

### Layer Responsibilities

- **`src/app/api/`** — Route handlers only. Auth, input parsing, response formatting.
- **`src/services/`** — Business logic (`AuthService`, `ChatService`, `EmailService`, `OAuthService`, `UserService`, `EmotionService`).
- **`src/lib/`** — Singleton clients and utilities. Never instantiate Prisma/Redis outside here.

### Key lib files

| File | What it exports |
|---|---|
| `qdrant.ts` | `qdrant` client, `COLLECTION_NAME` (`care_docs`), `initCollection()` |
| `langchain-vectorstore.ts` | `hybridSearch(collection, query, k=10)`, `rerankDocs(query, docs, topN=3)` |
| `sparse-embedding.ts` | `computeSparseVector(text)` — BM25-style, vocab size 30k, hash-based |
| `langchain-llm.ts` | `geminiLLM` — streaming, temp 0.7 |
| `auth.ts` | `verifyToken(request)` — reads `Authorization: Bearer` header |
| `oauth.ts` | `getGoogleOAuthURL(clientRedirectUri?)`, `isAllowedRedirect(uri)` |

### Qdrant Collection Schema

`care_docs` collection uses **named vectors**:
```
vectors: { dense: { size: 3072, distance: Cosine } }
sparse_vectors: { sparse: {} }
```
Points store `{ content, source }` in payload. No userId — documents are shared across all users.

### Auth

- **Access token**: 15m JWT `{ userId, email }`, verified via `JWT_ACCESS_SECRET`
- **Refresh token**: 14d, stored in Redis at `refresh_token:{userId}`
- **Google OAuth**: client sends `redirect_uri` param → encoded in `state` → decoded in success route → redirected to `exp://...` or `my-care-app://` deeplink

### Chat History

Currently stored in server-side `Map<userId, ChatMessage[]>` in `route.ts`. Resets on server restart. Max 20 messages kept (last 10 rounds). `ChatService` in `src/services/` has Redis-based history methods but the route doesn't use them yet.

### RAG Ingest

`src/scripts/ingest.ts` — hardcoded to `D:/my-care-logue2/docs/care_guide.pdf`. If collection schema changes (e.g., adding sparse vectors), delete the collection in Qdrant dashboard and re-run `npm run ingest`.

### Emotion Check Feature

`POST /api/emotion/check` — 감정 텍스트 입력 → Gemini가 JSON `{ stressScore, level, aiResponse }` 반환 → DB 저장.
`GET /api/emotion/history` — 날것 리스트 (`?limit=30`) 또는 집계 (`?groupBy=day|week|month`).

레벨: `NORMAL`(0-40) / `CAUTION`(41-70) / `DANGER`(71-100). `EmotionService.getAggregated()`는 `$queryRaw`로 MySQL `DATE_FORMAT` 집계 사용.

LLM 응답이 JSON이 아닐 경우(```` ```json ``` ```` 마크다운 포함) `replace(/```json\n?|\n?```/g, '')` 로 파싱.

### Database (Prisma / MySQL)

Four models: `User`, `Account` (OAuth provider links), `EmailVerification` (1h TTL tokens), `EmotionLog` (stressScore, level, aiResponse, userId FK). OAuth users have `password: null`.

**Prisma 클라이언트 재생성 주의**: 스키마 변경 후 dev 서버가 DLL을 점유해 `prisma generate`가 실패할 수 있음. dev 서버 종료 → `npx prisma generate` → 재시작 순서 필수. 이후 VSCode에서 `TypeScript: Restart TS Server` 실행.

### Environment Variables

`DATABASE_URL`, `REDIS_URL`, `QDRANT_URL`, `GEMINI_API_KEY`, `COHERE_API_KEY`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `NEXT_PUBLIC_APP_URL` (ngrok or production URL — used in OAuth redirects and email links), `SMTP_*`.
