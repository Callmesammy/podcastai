import { Output, streamText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { NextResponse } from "next/server";
import { z } from "zod";

const SOURCE_EXCERPT_LIMIT = 5000;
const HOST_A = "Arabella";
const HOST_B = "Grandpa Spuds Oxley";
const STREAM_HEADERS = {
  "Content-Type": "application/x-ndjson; charset=utf-8",
  "Cache-Control": "no-cache, no-transform",
};

const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const conversationSchema = z.object({
  rounds: z
    .array(
      z.object({
        host: z
          .enum([HOST_A, HOST_B])
          .describe(`Podcast host speaking this round. Use only ${HOST_A} or ${HOST_B}.`),
        text: z
          .string()
          .min(1)
          .describe(
            "One short spoken line for this round. Natural podcast style with optional cues like [giggles] or [sarcastically].",
          ),
      }),
    )
    .length(10)
    .describe(`Exactly 10 rounds, alternating speakers and starting with ${HOST_A}.`),
});

type ConversationRequestBody = {
  title?: unknown;
  sourceURL?: unknown;
  excerpt?: unknown;
};

type ConversationRound = {
  host: string;
  text: string;
};

type ConversationStreamEvent =
  | { type: "notice"; message: string; fallback?: boolean }
  | { type: "partial"; rounds: ConversationRound[]; fallback?: boolean }
  | { type: "complete"; rounds: ConversationRound[]; fallback?: boolean }
  | { type: "error"; error: string };

function isQuotaOrBillingError(message: string): boolean {
  return /exceeded your current quota|billing details|insufficient_quota/i.test(message);
}

function toDomain(sourceURL: string): string {
  try {
    return new URL(sourceURL).hostname;
  } catch {
    return sourceURL;
  }
}

function normalizeRounds(rounds: unknown): ConversationRound[] {
  if (!Array.isArray(rounds)) {
    return [];
  }

  return rounds
    .slice(0, 10)
    .map((round, index) => {
      const candidate = round as { text?: unknown };
      const text = typeof candidate?.text === "string" ? candidate.text.trim() : "";
      if (!text) {
        return null;
      }

      return {
        host: index % 2 === 0 ? HOST_A : HOST_B,
        text,
      };
    })
    .filter((round): round is ConversationRound => round !== null);
}

function buildFallbackRounds({
  title,
  sourceURL,
  excerpt,
}: {
  title: string;
  sourceURL: string;
  excerpt: string;
}): ConversationRound[] {
  const domain = toDomain(sourceURL);
  const points = excerpt
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean)
    .slice(0, 4);

  const [pointA, pointB, pointC, pointD] = points;

  const fallbackTexts = [
    `Quick detour into improv mode: we are unpacking "${title}" from ${domain}, and this preview should still be a fun listen.`,
    `Let's start with the gist: ${pointA ?? "the source introduces a clear main theme and why it matters."}`,
    `I like that it keeps the framing practical instead of getting lost in theory.`,
    `${pointB ?? "It gives enough detail to understand the key points quickly."}`,
    `The practical angle is important because listeners want actionable takeaways.`,
    `${pointC ?? "The content highlights what to focus on first before deeper exploration."}`,
    `Even with limited context, this already feels like a useful foundation for an episode.`,
    `${pointD ?? "There are tradeoffs worth discussing, especially around implementation choices."}`,
    `So the short version is: strong topic signal, decent structure, and enough context to riff on.`,
    `Once billing is active, this same panel will stream the full model-generated 10-round conversation.`,
  ];

  return fallbackTexts.map((text, index) => ({
    host: index % 2 === 0 ? HOST_A : HOST_B,
    text,
  }));
}

function completeRounds(rounds: ConversationRound[], fallbackRounds: ConversationRound[]): ConversationRound[] {
  const merged = [...rounds];
  for (let index = merged.length; index < 10; index += 1) {
    merged.push(fallbackRounds[index]);
  }
  return merged.slice(0, 10);
}

function encodeEvent(encoder: TextEncoder, event: ConversationStreamEvent): Uint8Array {
  return encoder.encode(`${JSON.stringify(event)}\n`);
}

async function streamFallbackEvents({
  controller,
  encoder,
  fallbackRounds,
  message,
  alreadyStreamedRounds = 0,
}: {
  controller: ReadableStreamDefaultController<Uint8Array>;
  encoder: TextEncoder;
  fallbackRounds: ConversationRound[];
  message: string;
  alreadyStreamedRounds?: number;
}) {
  controller.enqueue(
    encodeEvent(encoder, {
      type: "notice",
      message,
      fallback: true,
    }),
  );

  for (let index = Math.max(1, alreadyStreamedRounds + 1); index <= fallbackRounds.length; index += 1) {
    controller.enqueue(
      encodeEvent(encoder, {
        type: "partial",
        rounds: fallbackRounds.slice(0, index),
        fallback: true,
      }),
    );
  }

  controller.enqueue(
    encodeEvent(encoder, {
      type: "complete",
      rounds: fallbackRounds,
      fallback: true,
    }),
  );
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ConversationRequestBody;

    const title = typeof body.title === "string" ? body.title.trim() : "";
    const sourceURL = typeof body.sourceURL === "string" ? body.sourceURL.trim() : "";
    const excerpt = typeof body.excerpt === "string" ? body.excerpt.trim() : "";

    if (!title || !sourceURL || !excerpt) {
      return NextResponse.json(
        { error: "Missing required fields. title, sourceURL, and excerpt are required." },
        { status: 400 },
      );
    }

    const fallbackRounds = buildFallbackRounds({ title, sourceURL, excerpt });
    const encoder = new TextEncoder();

    if (!process.env.OPENAI_API_KEY) {
      const fallbackStream = new ReadableStream<Uint8Array>({
        async start(controller) {
          await streamFallbackEvents({
            controller,
            encoder,
            fallbackRounds,
            message: "OpenAI API key is missing. Streaming fallback conversation preview.",
          });
          controller.close();
        },
      });

      return new Response(fallbackStream, { headers: STREAM_HEADERS });
    }

    const result = streamText({
      model: openai("gpt-5-mini"),
      maxRetries: 0,
      system: `You are a podcast script writer.
Generate a back-and-forth podcast conversation between two hosts.

Rules:
- Return exactly 10 rounds.
- Alternate hosts every round, starting with ${HOST_A}.
- ${HOST_A} is bubbly, excited, and optimistic.
- ${HOST_B} is skeptical, sarcastic, and witty.
- Keep each round concise (1-3 sentences).
- Ground the dialogue in the provided source content.
- You can include voice-style cues in square brackets when natural, such as [sarcastically], [giggles], [whispers], [laughs].
- Do not add intro/outro metadata, only dialogue content.`,
      output: Output.object({
        name: "PodcastConversation",
        description: "A 10-round structured podcast dialogue between two distinct hosts.",
        schema: conversationSchema,
      }),
      prompt: `Source title: ${title}
Source URL: ${sourceURL}
Source excerpt:
${excerpt.slice(0, SOURCE_EXCERPT_LIMIT)}`,
    });

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        let latestRounds: ConversationRound[] = [];

        try {
          for await (const partialOutput of result.partialOutputStream) {
            const partialRounds = normalizeRounds(partialOutput?.rounds);

            if (partialRounds.length === 0) {
              continue;
            }

            latestRounds = partialRounds;
            controller.enqueue(
              encodeEvent(encoder, {
                type: "partial",
                rounds: partialRounds,
              }),
            );
          }

          const output = await result.output;
          const parsedFinalRounds = normalizeRounds(output.rounds);
          const finalRounds = completeRounds(parsedFinalRounds, fallbackRounds);

          controller.enqueue(
            encodeEvent(encoder, {
              type: "complete",
              rounds: finalRounds,
            }),
          );
        } catch (error) {
          const message = error instanceof Error ? error.message : "Unable to generate conversation.";

          const fallbackMessage = isQuotaOrBillingError(message)
            ? "OpenAI quota/billing issue detected. Streaming fallback conversation preview."
            : `Conversation generation failed (${message}). Streaming fallback conversation preview.`;

          await streamFallbackEvents({
            controller,
            encoder,
            fallbackRounds,
            message: fallbackMessage,
            alreadyStreamedRounds: latestRounds.length,
          });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, { headers: STREAM_HEADERS });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to generate conversation.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
