import Firecrawl from "@mendable/firecrawl-js";
import { NextResponse } from "next/server";

const MAX_EXCERPT_LENGTH = 700;

function toExcerpt(markdown: string): string {
  const normalized = markdown.replace(/\s+/g, " ").trim();

  if (normalized.length <= MAX_EXCERPT_LENGTH) {
    return normalized;
  }

  return `${normalized.slice(0, MAX_EXCERPT_LENGTH).trimEnd()}...`;
}

function isValidHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { url?: unknown };
    const url = typeof body.url === "string" ? body.url.trim() : "";

    if (!url || !isValidHttpUrl(url)) {
      return NextResponse.json({ error: "Please provide a valid http(s) URL." }, { status: 400 });
    }

    const apiKey = process.env.FIRECRAWL_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "Missing FIRECRAWL_API_KEY environment variable." },
        { status: 500 },
      );
    }

    const firecrawl = new Firecrawl({ apiKey });
    const document = await firecrawl.scrape(url, { formats: ["markdown"] });
    const markdown = typeof document.markdown === "string" ? document.markdown : "";

    if (!markdown.trim()) {
      return NextResponse.json(
        { error: "No markdown content was returned for this URL." },
        { status: 422 },
      );
    }

    const title =
      typeof document.metadata?.title === "string" && document.metadata.title.trim().length > 0
        ? document.metadata.title.trim()
        : new URL(url).hostname;

    const sourceURL =
      typeof document.metadata?.sourceURL === "string" && document.metadata.sourceURL.trim().length > 0
        ? document.metadata.sourceURL
        : url;

    return NextResponse.json({
      title,
      sourceURL,
      excerpt: toExcerpt(markdown),
      characters: markdown.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to scrape this website.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
