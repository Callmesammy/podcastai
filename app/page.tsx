"use client";

import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type ScrapedSource = {
  title: string;
  sourceURL: string;
  excerpt: string;
  characters: number;
};

const conversationRounds = [
  {
    host: "Host Maya",
    text: "Today we are exploring the article's claim that conversational pacing is the biggest factor in listener retention.",
  },
  {
    host: "Host Theo",
    text: "The scraped section points out that shorter turns and clearer transitions make AI podcasts feel less robotic.",
  },
  {
    host: "Host Maya",
    text: "I liked the practical framework: extract key ideas first, then map each idea to one natural exchange between hosts.",
  },
  {
    host: "Host Theo",
    text: "Exactly, and the article warns against dumping all facts in one monologue because people tune out quickly.",
  },
  {
    host: "Host Maya",
    text: "It also suggests adding contrasting opinions so each round has light tension, which keeps the dialogue alive.",
  },
  {
    host: "Host Theo",
    text: "From a production side, I noticed it emphasizes consistent host personalities across episodes for audience trust.",
  },
  {
    host: "Host Maya",
    text: "Another useful point was to summarize every few rounds, so late joiners still understand the context.",
  },
  {
    host: "Host Theo",
    text: "Right, and those mini recaps naturally create cue points where we can add music beds or chapter markers.",
  },
  {
    host: "Host Maya",
    text: "The final section recommends validating factual claims before rendering audio, even in quick-turnaround workflows.",
  },
  {
    host: "Host Theo",
    text: "So our key takeaway is simple: scrape for facts, script for flow, and produce with rhythm in mind.",
  },
];

export default function Home() {
  const [url, setUrl] = useState("https://example.com/conversational-podcasting");
  const [isPlaying, setIsPlaying] = useState(false);
  const [isFetchingSource, setIsFetchingSource] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [scrapedSource, setScrapedSource] = useState<ScrapedSource | null>(null);
  const [lastFetchedUrl, setLastFetchedUrl] = useState<string | null>(null);

  const isPlayable = conversationRounds.length > 0;

  const handleFetchSource = async () => {
    const normalizedUrl = url.trim();

    if (!normalizedUrl) {
      setFetchError("Please provide a website URL.");
      setScrapedSource(null);
      return;
    }

    setIsFetchingSource(true);
    setFetchError(null);

    try {
      const response = await fetch("/api/scrape", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url: normalizedUrl }),
      });

      const payload = (await response.json()) as Partial<ScrapedSource> & { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to scrape the provided URL.");
      }

      if (!payload.title || !payload.sourceURL || !payload.excerpt || typeof payload.characters !== "number") {
        throw new Error("Received an invalid scrape response.");
      }

      setScrapedSource({
        title: payload.title,
        sourceURL: payload.sourceURL,
        excerpt: payload.excerpt,
        characters: payload.characters,
      });
      setLastFetchedUrl(payload.sourceURL);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to scrape the provided URL.";
      setFetchError(message);
      setScrapedSource(null);
    } finally {
      setIsFetchingSource(false);
    }
  };

  return (
    <div className="min-h-screen bg-background px-4 py-5 text-foreground sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-4">
        <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card/90 px-4 py-3 shadow-sm backdrop-blur sm:px-5">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-content-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
              PA
            </div>
            <div>
              <p className="text-sm text-muted-foreground">AI Podcast Workspace - Prototype UI</p>
              <h1 className="text-xl font-semibold tracking-tight">Untitled episode</h1>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button className="rounded-full">+ Create episode</Button>
            <Button variant="outline" className="rounded-full">
              Share
            </Button>
            <Button variant="outline" className="rounded-full">
              Settings
            </Button>
          </div>
        </header>

        <main className="grid gap-4 lg:grid-cols-12">
          <Card className="rounded-2xl lg:col-span-3">
            <CardHeader className="flex-row items-center justify-between border-b border-border">
              <CardTitle className="text-2xl font-medium">Capture Web Content</CardTitle>
              <Badge variant="secondary">Firecrawl</Badge>
            </CardHeader>

            <CardContent className="space-y-4 p-4">
              <Card className="bg-muted/40">
                <CardContent className="p-3">
                  <label className="mb-2 block text-sm font-medium text-muted-foreground">Website URL</label>
                  <Input
                    type="url"
                    value={url}
                    onChange={(event) => setUrl(event.target.value)}
                    placeholder="https://example.com/article"
                  />
                  <Button className="mt-3 w-full" onClick={handleFetchSource} disabled={isFetchingSource}>
                    {isFetchingSource ? "Fetching..." : "Fetch"}
                  </Button>
                </CardContent>
              </Card>

              <p className="rounded-lg border border-border bg-card px-3 py-2 text-xs text-muted-foreground">
                {lastFetchedUrl ? `Last fetched URL: ${lastFetchedUrl}` : "No source fetched yet."}
              </p>

              {isFetchingSource ? (
                <Card className="border-border bg-muted/40">
                  <CardContent className="p-3">
                    <p className="text-sm font-medium">Fetching source content...</p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Firecrawl is scraping the page and preparing markdown output.
                    </p>
                  </CardContent>
                </Card>
              ) : null}

              {!isFetchingSource && fetchError ? (
                <Card className="border-destructive/30 bg-destructive/5">
                  <CardContent className="p-3">
                    <p className="text-sm font-medium text-destructive">Fetch failed</p>
                    <p className="mt-2 text-xs text-muted-foreground">{fetchError}</p>
                  </CardContent>
                </Card>
              ) : null}

              {!isFetchingSource && !fetchError && scrapedSource ? (
                <Card className="transition-colors hover:bg-muted/40">
                  <CardContent className="space-y-3 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium">{scrapedSource.title}</p>
                      <Badge variant="secondary">Scraped</Badge>
                    </div>
                    <p className="text-xs leading-relaxed text-muted-foreground">{scrapedSource.excerpt}</p>
                    <p className="text-xs text-muted-foreground">{scrapedSource.characters} markdown characters</p>
                  </CardContent>
                </Card>
              ) : null}

              {!isFetchingSource && !fetchError && !scrapedSource ? (
                <Card className="bg-muted/40">
                  <CardContent className="p-3">
                    <p className="text-sm font-medium">Scraped excerpt</p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Press Fetch to scrape a URL and show an excerpt here.
                    </p>
                  </CardContent>
                </Card>
              ) : null}
            </CardContent>
          </Card>

          <Card className="rounded-2xl lg:col-span-6">
            <CardHeader className="flex-row items-center justify-between border-b border-border">
              <CardTitle className="text-2xl font-medium">Conversation</CardTitle>
              <Badge variant="secondary">10 rounds</Badge>
            </CardHeader>

            <CardContent className="space-y-4 p-4">
              <Card className="bg-muted/40">
                <CardHeader className="p-4">
                  <CardDescription>Scraped content discussion</CardDescription>
                  <CardTitle className="text-3xl font-semibold tracking-tight">Two-host dialogue preview</CardTitle>
                </CardHeader>
              </Card>

              <div className="max-h-[68vh] space-y-3 overflow-y-auto pr-1">
                {conversationRounds.map((round, index) => (
                  <Card key={`${round.host}-${index}`}>
                    <CardContent className="p-4">
                      <p className="text-sm font-semibold text-foreground">{round.host}</p>
                      <p className="mt-2 text-base leading-relaxed text-muted-foreground">{round.text}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl lg:col-span-3">
            <CardHeader className="flex-row items-center justify-between border-b border-border">
              <CardTitle className="text-2xl font-medium">Audio</CardTitle>
              <Badge variant="secondary">{isPlaying ? "Playing" : "Paused"}</Badge>
            </CardHeader>

            <CardContent className="space-y-4 p-4">
              <Card className="bg-muted/40">
                <CardContent className="p-3">
                  <p className="text-sm font-medium text-muted-foreground">Transport Controls</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Pause is available only when audio is playable and currently playing.
                  </p>
                </CardContent>
              </Card>

              <div className="space-y-2">
                <Button disabled={!isPlayable || isPlaying} onClick={() => setIsPlaying(true)} className="w-full">
                  Play
                </Button>
                <Button
                  disabled={!isPlayable || !isPlaying}
                  variant="outline"
                  onClick={() => setIsPlaying(false)}
                  className="w-full"
                >
                  Pause
                </Button>
                <Button
                  disabled={!isPlayable}
                  variant="secondary"
                  onClick={() => setIsPlaying(false)}
                  className="w-full"
                >
                  Restate audio
                </Button>
              </div>

              <Card>
                <CardContent className="p-3">
                  <p className="text-sm font-medium text-muted-foreground">Wave Preview</p>
                  <div className="mt-3 flex h-16 items-end gap-1 rounded-lg bg-muted/40 px-2 py-2">
                    {Array.from({ length: 28 }).map((_, i) => (
                      <span
                        key={i}
                        className={`w-1 rounded-full ${isPlaying ? "bg-emerald-400" : "bg-muted-foreground/40"}`}
                        style={{ height: `${18 + ((i * 13) % 38)}px` }}
                      />
                    ))}
                  </div>
                </CardContent>
              </Card>

              <p className="text-center text-xs text-muted-foreground">
                Conversation and audio data are still mock for UI testing.
              </p>
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  );
}
