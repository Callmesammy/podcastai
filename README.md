# PodcastAI

Turn any article URL into a generated two-host podcast audio episode.

The app has 3 core stages:

1. Scrape website content with Firecrawl.
2. Generate a 10-round host conversation with AI SDK + OpenAI (`gpt-5-mini`).
3. Generate dialogue audio with ElevenLabs.

## How The Application Works

### 1) Capture Web Content

- The user enters a URL in the left panel (`app/page.tsx`).
- Frontend calls `POST /api/scrape` (`app/api/scrape/route.ts`).
- The route validates the URL, reads `FIRECRAWL_API_KEY`, scrapes markdown with Firecrawl, and returns:
  - `title`
  - `sourceURL`
  - `excerpt` (trimmed summary preview)
  - `characters` (original markdown length)

If scraping fails, the UI shows a fetch error card.

### 2) Generate Conversation (Streaming)

- After successful scrape, frontend immediately calls `POST /api/conversation` (`app/api/conversation/route.ts`).
- Route uses AI SDK structured output with a strict schema:
  - exactly 10 rounds
  - alternating speakers
  - starts with `Arabella`
- Response is streamed as NDJSON events so UI can render rounds progressively.

Event types:

- `notice`
- `partial`
- `complete`
- `error`

The center panel updates live while rounds stream in.

### 3) Generate Podcast Audio

- Frontend maps conversation rounds to `messages` and calls `POST /api/audio` (`app/api/audio/route.ts`) when user clicks play.
- Route resolves ElevenLabs key from:
  - `AIVOICE_API_KEY` (preferred)
  - `ELEVENLABS_API_KEY` (fallback)
- It attempts `textToDialogue` first.
- If plan/permission/voice restrictions occur, it falls back to:
  - quickstart public voices
  - then per-message `textToSpeech` synthesis and merges audio bytes

The right panel then plays the generated MP3 audio with play/pause/restart controls.

## End-To-End Data Flow

1. User submits URL.
2. `/api/scrape` returns title + excerpt.
3. `/api/conversation` streams 10 rounds.
4. `/api/audio` converts those rounds to audio.
5. Browser audio element plays the result.

## API Contracts

### `POST /api/scrape`

Request:

```json
{
  "url": "https://example.com/article"
}
```

Success response:

```json
{
  "title": "Page title",
  "sourceURL": "https://example.com/article",
  "excerpt": "Trimmed markdown excerpt...",
  "characters": 12345
}
```

### `POST /api/conversation`

Request:

```json
{
  "title": "Page title",
  "sourceURL": "https://example.com/article",
  "excerpt": "Scraped excerpt text..."
}
```

Streaming response (`application/x-ndjson`) emits one JSON object per line:

```json
{"type":"partial","rounds":[{"host":"Arabella","text":"..."}]}
{"type":"complete","rounds":[{"host":"Arabella","text":"..."},{"host":"Grandpa Spuds Oxley","text":"..."}]}
```

### `POST /api/audio`

Request:

```json
{
  "messages": [
    { "speaker": "Arabella", "text": "..." },
    { "speaker": "Grandpa Spuds Oxley", "text": "..." }
  ]
}
```

Success response: raw `audio/mpeg` stream.

## Fallback Behavior

### Conversation fallback

- If `OPENAI_API_KEY` is missing, or generation fails/quota is hit, route streams a generated fallback 10-round preview built from the scraped excerpt.

### Audio fallback

- If configured voices are unavailable to the account, audio route retries with quickstart voices.
- If `textToDialogue` is still blocked by plan/permissions, route synthesizes each line with `textToSpeech` and concatenates audio.

## Environment Variables

Create `.env.local` in project root:

```bash
FIRECRAWL_API_KEY=fc_...
OPENAI_API_KEY=sk-...

# Use either of these for ElevenLabs (AIVOICE_API_KEY is preferred by this app)
AIVOICE_API_KEY=...
# ELEVENLABS_API_KEY=...

# Optional custom voices
# AIVOICE_HOST_A_VOICE_ID=...
# AIVOICE_HOST_B_VOICE_ID=...
```

## Local Development

### Prerequisites

- Node.js 20+
- npm

### Install and run

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

Useful scripts:

- `npm run dev` - start dev server
- `npm run typecheck` - TypeScript check only
- `npm run lint` - ESLint
- `npm run build` - typecheck + production build
- `npm run start` - run production build

## Project Structure

```txt
app/
  api/
    scrape/route.ts         # Firecrawl scraping endpoint
    conversation/route.ts   # OpenAI streaming conversation endpoint
    audio/route.ts          # ElevenLabs audio endpoint
  page.tsx                  # Main UI and pipeline orchestration
components/ui/              # shadcn/ui components
docs/business/overview.md   # Product overview
```

## Current Host Personalities

- `Arabella`: bubbly, excited, optimistic
- `Grandpa Spuds Oxley`: skeptical, sarcastic, witty

These are enforced in conversation generation and preserved through audio synthesis.<img width="3777" height="1756" alt="Screenshot (8)" src="https://github.com/user-attachments/assets/4868414a-77e4-4493-a00f-ee9749bc5d42" />



