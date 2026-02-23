import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import { NextResponse } from "next/server";

const DEFAULT_HOST_A = "Arabella";
const DEFAULT_HOST_B = "Grandpa Spuds Oxley";
const DEFAULT_HOST_A_VOICE_ID = "Z3R5wn05IrDiVCyEkUrK";
const DEFAULT_HOST_B_VOICE_ID = "NOpBlnGInO9m6vDvFkFC";
const QUICKSTART_HOST_A_VOICE_ID = "9BWtsMINqrJLrRacOk9x";
const QUICKSTART_HOST_B_VOICE_ID = "IKne3meq5aSn9XLyUdCD";
const MAX_ROUNDS = 20;
const MAX_TEXT_LENGTH = 1_200;

type ConversationRound = {
  host?: unknown;
  text?: unknown;
};

type AudioRequestBody = {
  rounds?: unknown;
};

function cleanApiKey(value: string | undefined): string {
  return (value ?? "").trim().replace(/^['"]|['"]$/g, "");
}

function looksLikeOpenAIKey(value: string): boolean {
  return /^sk-proj-/i.test(value);
}

function toVoiceId(host: string): string {
  const hostAVoice = cleanApiKey(process.env.AIVOICE_HOST_A_VOICE_ID) || DEFAULT_HOST_A_VOICE_ID;
  const hostBVoice = cleanApiKey(process.env.AIVOICE_HOST_B_VOICE_ID) || DEFAULT_HOST_B_VOICE_ID;

  const normalizedHost = host.toLowerCase();

  if (normalizedHost.includes("arabella")) {
    return hostAVoice;
  }

  if (
    normalizedHost.includes("grandpa spuds oxley") ||
    normalizedHost.includes("grandpa") ||
    normalizedHost.includes("spuds")
  ) {
    return hostBVoice;
  }

  return host === DEFAULT_HOST_A ? hostAVoice : hostBVoice;
}

function normalizeRounds(rawRounds: unknown): Array<{ host: string; text: string }> {
  if (!Array.isArray(rawRounds)) {
    return [];
  }

  return rawRounds
    .slice(0, MAX_ROUNDS)
    .map((rawRound, index) => {
      const round = rawRound as ConversationRound;
      const host =
        typeof round.host === "string" && round.host.trim().length > 0
          ? round.host.trim()
          : index % 2 === 0
            ? DEFAULT_HOST_A
            : DEFAULT_HOST_B;
      const text = typeof round.text === "string" ? round.text.replace(/\s+/g, " ").trim() : "";

      if (!text) {
        return null;
      }

      return {
        host,
        text: text.slice(0, MAX_TEXT_LENGTH),
      };
    })
    .filter((round): round is { host: string; text: string } => round !== null);
}

function isPaidPlanRequiredError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : "";
  return /paid_plan_required|payment_required|library voices/i.test(message);
}

function isInvalidApiKeyError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : "";
  return /invalid_api_key|invalid api key|status code:\s*401/i.test(message);
}

function toQuickstartVoiceId(index: number): string {
  return index % 2 === 0 ? QUICKSTART_HOST_A_VOICE_ID : QUICKSTART_HOST_B_VOICE_ID;
}

export async function POST(request: Request) {
  try {
    const apiKey = cleanApiKey(process.env.AIVOICE_API_KEY);
    if (!apiKey) {
      return NextResponse.json(
        { error: "Missing AIVOICE_API_KEY environment variable." },
        { status: 500 },
      );
    }
    if (looksLikeOpenAIKey(apiKey)) {
      return NextResponse.json(
        {
          error:
            "AIVOICE_API_KEY is currently an OpenAI key (sk-proj-...). Use an ElevenLabs API key from https://elevenlabs.io/app/settings/api-keys.",
        },
        { status: 500 },
      );
    }

    const body = (await request.json()) as AudioRequestBody;
    const rounds = normalizeRounds(body.rounds);

    if (rounds.length === 0) {
      return NextResponse.json(
        { error: "No valid conversation rounds provided for audio generation." },
        { status: 400 },
      );
    }

    const elevenlabs = new ElevenLabsClient({ apiKey });
    let audioStream: Awaited<ReturnType<typeof elevenlabs.textToDialogue.convert>>;

    try {
      audioStream = await elevenlabs.textToDialogue.convert({
        // Keep method shape aligned with the ElevenLabs Text-to-Dialogue quickstart.
        inputs: rounds.map((round) => ({
          text: round.text,
          voiceId: toVoiceId(round.host),
        })),
      });
    } catch (error) {
      if (!isPaidPlanRequiredError(error)) {
        throw error;
      }

      // Fallback for free-tier accounts when configured voices are library voices.
      audioStream = await elevenlabs.textToDialogue.convert({
        inputs: rounds.map((round, index) => ({
          text: round.text,
          voiceId: toQuickstartVoiceId(index),
        })),
      });
    }

    return new Response(audioStream, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to generate podcast audio.";
    const invalidApiKeyMessage =
      "Invalid ElevenLabs API key. Set AIVOICE_API_KEY to a valid ElevenLabs key from https://elevenlabs.io/app/settings/api-keys, then restart your dev server.";
    const normalizedMessage = isPaidPlanRequiredError(error)
      ? "Configured voice requires a paid ElevenLabs plan for API use. Add account-owned voice IDs in AIVOICE_HOST_A_VOICE_ID and AIVOICE_HOST_B_VOICE_ID, or upgrade your plan."
      : isInvalidApiKeyError(error)
        ? invalidApiKeyMessage
        : message;
    const status = isPaidPlanRequiredError(error) ? 402 : isInvalidApiKeyError(error) ? 401 : 500;
    return NextResponse.json({ error: normalizedMessage }, { status });
  }
}
