import { generateText, Output } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { NextResponse } from "next/server";
import { z } from "zod";

const SOURCE_EXCERPT_LIMIT = 5000;
const HOST_A = "Host Maya";
const HOST_B = "Host Theo";
const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_SECRETE_KEY ?? process.env.OPENAI_API_KEY,
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

    if (!process.env.OPENAI_API_SECRETE_KEY && !process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "Missing OPENAI_API_SECRETE_KEY (or OPENAI_API_KEY) environment variable." },
        { status: 500 },
      );
    }

    const { output } = await generateText({
      model: openai("gpt-5-mini"),
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

    const rounds = output.rounds.map((round, index) => ({
      host: index % 2 === 0 ? HOST_A : HOST_B,
      text: round.text.trim(),
    }));

    return NextResponse.json({ rounds });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to generate conversation.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
