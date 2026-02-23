import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import { NextResponse } from "next/server";

const DEFAULT_HOST_A = "Arabella";
const DEFAULT_HOST_B = "Grandpa Spuds Oxley";
const DEFAULT_HOST_A_VOICE_ID = "9BWtsMINqrJLrRacOk9x";
const DEFAULT_HOST_B_VOICE_ID = "NOpBlnGInO9m6vDvFkFC";
const QUICKSTART_HOST_A_VOICE_ID = "9BWtsMINqrJLrRacOk9x";
const QUICKSTART_HOST_B_VOICE_ID = "IKne3meq5aSn9XLyUdCD";
const MAX_ROUNDS = 20;
const MAX_TEXT_LENGTH = 1_200;
const ELEVENLABS_API_KEY_ENV_NAMES = ["AIVOICE_API_KEY", "ELEVENLABS_API_KEY"] as const;

type ConversationMessage = {
  host?: unknown;
  speaker?: unknown;
  text?: unknown;
  content?: unknown;
};

type AudioRequestBody = {
  rounds?: unknown;
  messages?: unknown;
};

function cleanApiKey(value: string | undefined): string {
  return (value ?? "").trim().replace(/^['"]|['"]$/g, "");
}

function looksLikeOpenAIKey(value: string): boolean {
  return /^sk-proj-/i.test(value);
}

function readElevenLabsApiKey(): { apiKey: string; sourceEnvName: string } | null {
  for (const envName of ELEVENLABS_API_KEY_ENV_NAMES) {
    const apiKey = cleanApiKey(process.env[envName]);
    if (apiKey) {
      return { apiKey, sourceEnvName: envName };
    }
  }

  return null;
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

function normalizeDialogueMessages(rawMessages: unknown): Array<{ host: string; text: string }> {
  if (!Array.isArray(rawMessages)) {
    return [];
  }

  return rawMessages
    .slice(0, MAX_ROUNDS)
    .map((rawMessage, index) => {
      const message = rawMessage as ConversationMessage;
      const hostCandidate =
        typeof message.speaker === "string" && message.speaker.trim().length > 0
          ? message.speaker.trim()
          : typeof message.host === "string" && message.host.trim().length > 0
            ? message.host.trim()
            : "";
      const host =
        hostCandidate || (index % 2 === 0 ? DEFAULT_HOST_A : DEFAULT_HOST_B);
      const rawText =
        typeof message.text === "string"
          ? message.text
          : typeof message.content === "string"
            ? message.content
            : "";
      const text = rawText.replace(/\s+/g, " ").trim();

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

function getErrorStatusCode(error: unknown): number | null {
  if (!error || typeof error !== "object") {
    return null;
  }

  const candidate = error as { statusCode?: unknown };
  return typeof candidate.statusCode === "number" ? candidate.statusCode : null;
}

function getErrorBodyText(error: unknown): string {
  if (!error || typeof error !== "object") {
    return "";
  }

  const candidate = error as { body?: unknown };
  if (typeof candidate.body === "string") {
    return candidate.body;
  }

  if (candidate.body && typeof candidate.body === "object") {
    return JSON.stringify(candidate.body);
  }

  return "";
}

function isInvalidApiKeyError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : "";
  const bodyText = getErrorBodyText(error);
  const combined = `${message}\n${bodyText}`;

  if (/invalid_api_key|invalid api key/i.test(combined)) {
    return true;
  }

  const statusCode = getErrorStatusCode(error);
  return (
    statusCode === 401 &&
    /(api key|xi-api-key|authorization)/i.test(combined) &&
    !/permission|forbidden|plan|tier|subscription/i.test(combined)
  );
}

function isPermissionError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : "";
  const bodyText = getErrorBodyText(error);
  const combined = `${message}\n${bodyText}`;
  const statusCode = getErrorStatusCode(error);

  return (
    (statusCode === 401 || statusCode === 403) &&
    /permission|forbidden|plan|tier|subscription|not authorized|not allowed|insufficient/i.test(combined)
  );
}

function shouldFallbackToTextToSpeech(error: unknown): boolean {
  return isPaidPlanRequiredError(error) || isPermissionError(error);
}

function toQuickstartVoiceId(index: number): string {
  return index % 2 === 0 ? QUICKSTART_HOST_A_VOICE_ID : QUICKSTART_HOST_B_VOICE_ID;
}

async function streamToBytes(stream: ReadableStream<Uint8Array>): Promise<Uint8Array> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let totalLength = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    if (!value || value.length === 0) {
      continue;
    }

    chunks.push(value);
    totalLength += value.length;
  }

  const output = new Uint8Array(totalLength);
  let offset = 0;

  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.length;
  }

  return output;
}

async function synthesizeSpeechBytes(
  elevenlabs: ElevenLabsClient,
  voiceId: string,
  text: string,
): Promise<Uint8Array> {
  const stream = await elevenlabs.textToSpeech.convert(voiceId, { text });
  return streamToBytes(stream);
}

async function synthesizeDialogueWithTextToSpeech(
  elevenlabs: ElevenLabsClient,
  messages: Array<{ host: string; text: string }>,
): Promise<Uint8Array> {
  const audioChunks: Uint8Array[] = [];

  for (const [index, message] of messages.entries()) {
    const preferredVoiceId = toVoiceId(message.host);
    try {
      audioChunks.push(await synthesizeSpeechBytes(elevenlabs, preferredVoiceId, message.text));
      continue;
    } catch (error) {
      if (!shouldFallbackToTextToSpeech(error)) {
        throw error;
      }
    }

    // If a configured voice is unavailable to this account, fall back to known public quickstart voices.
    const quickstartVoiceId = toQuickstartVoiceId(index);
    audioChunks.push(await synthesizeSpeechBytes(elevenlabs, quickstartVoiceId, message.text));
  }

  const totalLength = audioChunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const merged = new Uint8Array(totalLength);
  let offset = 0;

  for (const chunk of audioChunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }

  return merged;
}

export async function POST(request: Request) {
  try {
    const apiKeyConfig = readElevenLabsApiKey();
    if (!apiKeyConfig) {
      return NextResponse.json(
        {
          error:
            "Missing ElevenLabs API key. Set AIVOICE_API_KEY or ELEVENLABS_API_KEY, then restart your dev server.",
        },
        { status: 500 },
      );
    }
    const { apiKey, sourceEnvName } = apiKeyConfig;

    if (looksLikeOpenAIKey(apiKey)) {
      return NextResponse.json(
        {
          error:
            `${sourceEnvName} is currently an OpenAI key (sk-proj-...). Use an ElevenLabs API key from https://elevenlabs.io/app/settings/api-keys.`,
        },
        { status: 500 },
      );
    }

    const body = (await request.json()) as AudioRequestBody;
    const preferredMessages = normalizeDialogueMessages(body.messages);
    const compatibilityRounds = normalizeDialogueMessages(body.rounds);
    const dialogueMessages = preferredMessages.length > 0 ? preferredMessages : compatibilityRounds;

    if (dialogueMessages.length === 0) {
      return NextResponse.json(
        { error: "No valid conversation messages provided for audio generation." },
        { status: 400 },
      );
    }

    const elevenlabs = new ElevenLabsClient({ apiKey });
    let audioStream: Awaited<ReturnType<typeof elevenlabs.textToDialogue.convert>>;

    try {
      audioStream = await elevenlabs.textToDialogue.convert({
        // Keep method shape aligned with the ElevenLabs Text-to-Dialogue quickstart.
        inputs: dialogueMessages.map((message) => ({
          text: message.text,
          voiceId: toVoiceId(message.host),
        })),
      });
    } catch (error) {
      if (!shouldFallbackToTextToSpeech(error)) {
        throw error;
      }

      try {
        audioStream = await elevenlabs.textToDialogue.convert({
          inputs: dialogueMessages.map((message, index) => ({
            text: message.text,
            voiceId: toQuickstartVoiceId(index),
          })),
        });

        return new Response(audioStream, {
          headers: {
            "Content-Type": "audio/mpeg",
            "Cache-Control": "no-store",
          },
        });
      } catch (quickstartError) {
        if (!shouldFallbackToTextToSpeech(quickstartError)) {
          throw quickstartError;
        }
      }

      const fallbackAudioBytes = await synthesizeDialogueWithTextToSpeech(elevenlabs, dialogueMessages);
      const normalizedFallbackAudioBytes = Uint8Array.from(fallbackAudioBytes);
      const fallbackAudioBlob = new Blob([normalizedFallbackAudioBytes], { type: "audio/mpeg" });
      return new Response(fallbackAudioBlob, {
        headers: {
          "Content-Type": "audio/mpeg",
          "Cache-Control": "no-store",
        },
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
      "Invalid ElevenLabs API key. Set AIVOICE_API_KEY or ELEVENLABS_API_KEY to a valid ElevenLabs key from https://elevenlabs.io/app/settings/api-keys, then restart your dev server.";
    const permissionMessage =
      "Your ElevenLabs account can authenticate, but this request is not permitted for your current plan or permissions. Try account-owned voice IDs in AIVOICE_HOST_A_VOICE_ID and AIVOICE_HOST_B_VOICE_ID, or use a plan that supports this endpoint.";
    const normalizedMessage = isPaidPlanRequiredError(error)
      ? "Configured voice requires a paid ElevenLabs plan for API use. Add account-owned voice IDs in AIVOICE_HOST_A_VOICE_ID and AIVOICE_HOST_B_VOICE_ID, or upgrade your plan."
      : isPermissionError(error)
        ? permissionMessage
      : isInvalidApiKeyError(error)
        ? invalidApiKeyMessage
        : message;
    const status = isPaidPlanRequiredError(error)
      ? 402
      : isPermissionError(error)
        ? 403
        : isInvalidApiKeyError(error)
          ? 401
          : 500;
    return NextResponse.json({ error: normalizedMessage }, { status });
  }
}
