"use client";

import { useEffect, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FcReading } from "react-icons/fc";

type ScrapedSource = {
  title: string;
  sourceURL: string;
  excerpt: string;
  characters: number;
};

type ConversationRound = {
  host: string;
  text: string;
};

type AudioConversationMessage = {
  speaker: string;
  text: string;
};

type ConversationStreamEvent = {
  type?: unknown;
  rounds?: unknown;
  message?: unknown;
  error?: unknown;
  fallback?: unknown;
};

const EXPECTED_ROUNDS = 10;

function parseConversationRounds(rounds: unknown): ConversationRound[] {
  if (!Array.isArray(rounds)) {
    return [];
  }

  // Normalize streamed model output and enforce safe host defaults per turn.
  return rounds
    .slice(0, EXPECTED_ROUNDS)
    .map((round, index) => {
      const candidate = round as { host?: unknown; text?: unknown };
      const host =
        typeof candidate.host === "string" && candidate.host.trim().length > 0
          ? candidate.host.trim()
          : index % 2 === 0
            ? "Arabella"
            : "Grandpa Spuds Oxley";
      const text = typeof candidate.text === "string" ? candidate.text.trim() : "";

      if (!text) {
        return null;
      }

      return { host, text };
    })
    .filter((round): round is ConversationRound => round !== null);
}

function formatClock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return "0:00";
  }

  const wholeSeconds = Math.floor(seconds);
  const minutes = Math.floor(wholeSeconds / 60);
  const remainder = wholeSeconds % 60;
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}

export default function Home() {
  const [url, setUrl] = useState("https://example.com/conversational-podcasting");
  const [isPlaying, setIsPlaying] = useState(false);
  const [isFetchingSource, setIsFetchingSource] = useState(false);
  const [isGeneratingConversation, setIsGeneratingConversation] = useState(false);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [conversationError, setConversationError] = useState<string | null>(null);
  const [conversationNotice, setConversationNotice] = useState<string | null>(null);
  const [isFallbackConversation, setIsFallbackConversation] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioCurrentTime, setAudioCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [scrapedSource, setScrapedSource] = useState<ScrapedSource | null>(null);
  const [conversationRounds, setConversationRounds] = useState<ConversationRound[]>([]);
  const [lastFetchedUrl, setLastFetchedUrl] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);

  const conversationMessages: AudioConversationMessage[] = conversationRounds.map((round) => ({
    speaker: round.host,
    text: round.text,
  }));

  const isPlayable = conversationMessages.length > 0;
  const hasAudioReady = Boolean(audioUrl);
  const progressPercent = audioDuration > 0 ? Math.min((audioCurrentTime / audioDuration) * 100, 100) : 0;

  const clearAudio = () => {
    // Fully reset the hidden player and release any previously created object URL.
    const player = audioRef.current;
    if (player) {
      player.pause();
      player.removeAttribute("src");
      player.load();
    }

    setIsPlaying(false);
    setAudioCurrentTime(0);
    setAudioDuration(0);
    setAudioUrl((previousUrl) => {
      if (previousUrl) {
        URL.revokeObjectURL(previousUrl);
      }
      audioUrlRef.current = null;
      return null;
    });
  };

  useEffect(() => {
    audioUrlRef.current = audioUrl;
  }, [audioUrl]);

  useEffect(() => {
    // Ensure browser memory is released if the component unmounts while audio is loaded.
    return () => {
      if (audioUrlRef.current) {
        URL.revokeObjectURL(audioUrlRef.current);
      }
    };
  }, []);

  const generateAudio = async () => {
    if (conversationMessages.length === 0) {
      throw new Error("No conversation messages available for audio generation.");
    }

    setIsGeneratingAudio(true);
    setAudioError(null);

    try {
      const response = await fetch("/api/audio", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ messages: conversationMessages }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: unknown };
        const message =
          typeof payload.error === "string" && payload.error.trim()
            ? payload.error.trim()
            : "Unable to generate audio.";
        throw new Error(message);
      }

      const audioBlob = await response.blob();
      if (audioBlob.size === 0) {
        throw new Error("Generated audio was empty.");
      }

      const nextAudioUrl = URL.createObjectURL(audioBlob);

      const player = audioRef.current;
      if (player) {
        player.pause();
        player.src = nextAudioUrl;
        player.currentTime = 0;
        player.load();
      }

      setAudioCurrentTime(0);
      setAudioDuration(0);
      setAudioUrl((previousUrl) => {
        if (previousUrl) {
          URL.revokeObjectURL(previousUrl);
        }
        return nextAudioUrl;
      });
      return nextAudioUrl;
    } finally {
      setIsGeneratingAudio(false);
    }
  };

  const playAudio = async ({ restart = false }: { restart?: boolean } = {}) => {
    try {
      setAudioError(null);

      let resolvedAudioUrl = audioUrl;
      if (!resolvedAudioUrl) {
        resolvedAudioUrl = await generateAudio();
      }

      const player = audioRef.current;
      if (!player || !resolvedAudioUrl) {
        throw new Error("Audio player is not available.");
      }

      if (player.src !== resolvedAudioUrl) {
        player.src = resolvedAudioUrl;
      }

      if (restart) {
        player.currentTime = 0;
        setAudioCurrentTime(0);
      }

      await player.play();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to play generated audio.";
      setAudioError(message);
      setIsPlaying(false);
    }
  };

  const pauseAudio = () => {
    const player = audioRef.current;
    if (!player) {
      return;
    }

    player.pause();
  };

  const restartAudio = async () => {
    await playAudio({ restart: true });
  };

  const handleFetchSource = async () => {
    const normalizedUrl = url.trim();

    if (!normalizedUrl) {
      setFetchError("Please provide a website URL.");
      setScrapedSource(null);
      return;
    }

    setIsFetchingSource(true);
    setFetchError(null);
    setConversationError(null);
    setConversationNotice(null);
    setIsFallbackConversation(false);
    setConversationRounds([]);
    setAudioError(null);
    clearAudio();

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

      setIsGeneratingConversation(true);

      try {
        const conversationResponse = await fetch("/api/conversation", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            title: payload.title,
            sourceURL: payload.sourceURL,
            excerpt: payload.excerpt,
          }),
        });

        if (!conversationResponse.ok) {
          const failedPayload = (await conversationResponse.json()) as { error?: string };
          throw new Error(failedPayload.error ?? "Unable to generate conversation.");
        }

        if (!conversationResponse.body) {
          throw new Error("Conversation stream was not available.");
        }

        const reader = conversationResponse.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let didComplete = false;
        let latestRounds: ConversationRound[] = [];

        const processLine = (line: string) => {
          // The conversation route streams NDJSON; each non-empty line is a standalone event.
          if (!line.trim()) {
            return;
          }

          const parsed = JSON.parse(line) as ConversationStreamEvent;
          const eventType = typeof parsed.type === "string" ? parsed.type : "";

          if (eventType === "notice" && typeof parsed.message === "string" && parsed.message.trim()) {
            setConversationNotice(parsed.message.trim());
            if (parsed.fallback === true) {
              setIsFallbackConversation(true);
            }
            return;
          }

          if (eventType === "partial" || eventType === "complete") {
            const rounds = parseConversationRounds(parsed.rounds);
            if (rounds.length > 0) {
              latestRounds = rounds;
              setConversationRounds(rounds);
            }

            if (parsed.fallback === true) {
              setIsFallbackConversation(true);
            }

            if (eventType === "complete") {
              didComplete = true;
            }
            return;
          }

          if (eventType === "error") {
            const message =
              typeof parsed.error === "string" && parsed.error.trim()
                ? parsed.error.trim()
                : "Unable to generate conversation.";
            throw new Error(message);
          }
        };

        while (true) {
          const { done, value } = await reader.read();
          // A chunk can end mid-line, so keep buffering until a newline boundary exists.
          buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });

          let newlineIndex = buffer.indexOf("\n");
          while (newlineIndex >= 0) {
            const line = buffer.slice(0, newlineIndex);
            buffer = buffer.slice(newlineIndex + 1);
            processLine(line);
            newlineIndex = buffer.indexOf("\n");
          }

          if (done) {
            break;
          }
        }

        if (buffer.trim()) {
          processLine(buffer);
        }

        if (!didComplete && latestRounds.length === 0) {
          throw new Error("Conversation stream ended before returning rounds.");
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to generate conversation.";
        setConversationError(message);
        setConversationNotice(null);
        setIsFallbackConversation(false);
        setConversationRounds([]);
      } finally {
        setIsGeneratingConversation(false);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to scrape the provided URL.";
      setFetchError(message);
      setScrapedSource(null);
      setConversationRounds([]);
      setConversationError(null);
      setConversationNotice(null);
      setIsFallbackConversation(false);
      setAudioError(null);
      clearAudio();
      setIsGeneratingConversation(false);
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
            <FcReading className="size-10" />  
            </div>
            <div>
              <p className="text-sm text-muted-foreground">AI Podcast Workspace - Prototype UI</p>
              <h1 className="text-xl font-semibold tracking-tight">Read, Listen, and Enjoy</h1>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
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
              <Badge variant="secondary">
                {isGeneratingConversation
                  ? `Streaming... ${Math.min(conversationRounds.length, EXPECTED_ROUNDS)}/${EXPECTED_ROUNDS}`
                  : `${conversationRounds.length} rounds`}
              </Badge>
            </CardHeader>

            <CardContent className="space-y-4 p-4">
              <Card className="bg-muted/40">
                <CardHeader className="p-4">
                  <CardDescription>Scraped content discussion</CardDescription>
                  <CardTitle className="text-3xl font-semibold tracking-tight">Two-host dialogue preview</CardTitle>
                </CardHeader>
              </Card>

              {isGeneratingConversation ? (
                <Card className="border-border bg-muted/40">
                  <CardContent className="p-3">
                    <p className="text-sm font-medium">Streaming conversation...</p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Structured rounds will appear below as they are generated.
                    </p>
                  </CardContent>
                </Card>
              ) : null}

              {conversationNotice ? (
                <Card className="border-border bg-muted/40">
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium">Conversation notice</p>
                      {isFallbackConversation ? <Badge variant="outline">Fallback</Badge> : null}
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">{conversationNotice}</p>
                  </CardContent>
                </Card>
              ) : null}

              {!isGeneratingConversation && conversationError ? (
                <Card className="border-destructive/30 bg-destructive/5">
                  <CardContent className="p-3">
                    <p className="text-sm font-medium text-destructive">Conversation generation failed</p>
                    <p className="mt-2 text-xs text-muted-foreground">{conversationError}</p>
                  </CardContent>
                </Card>
              ) : null}

              {!isGeneratingConversation && !conversationError && conversationRounds.length === 0 ? (
                <Card className="bg-muted/40">
                  <CardContent className="p-3">
                    <p className="text-sm font-medium">No conversation yet</p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Fetch a source URL to stream a structured 10-turn conversation.
                    </p>
                  </CardContent>
                </Card>
              ) : null}

              {conversationRounds.length > 0 ? (
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
              ) : null}
            </CardContent>
          </Card>

          <Card className="rounded-2xl lg:col-span-3">
            <CardHeader className="flex-row items-center justify-between border-b border-border">
              <CardTitle className="text-2xl font-medium">Audio</CardTitle>
              <Badge variant="secondary">
                {isGeneratingAudio ? "Generating..." : isPlaying ? "Playing" : hasAudioReady ? "Ready" : "Idle"}
              </Badge>
            </CardHeader>

            <CardContent className="space-y-4 p-4">
              <Card className="bg-muted/40">
                <CardContent className="p-3">
                  <p className="text-sm font-medium text-muted-foreground">ElevenLabs Text to Dialogue</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Sends the generated conversation messages from the middle panel to the ElevenLabs SDK.
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Messages ready: {conversationMessages.length}
                  </p>
                </CardContent>
              </Card>

              <div className="space-y-2">
                <Button
                  disabled={!isPlayable || isGeneratingAudio}
                  onClick={() => void playAudio()}
                  className="w-full"
                >
                  {isGeneratingAudio ? "Generating..." : hasAudioReady ? "Play" : "Generate + Play"}
                </Button>
                <Button
                  disabled={!hasAudioReady || !isPlaying}
                  variant="outline"
                  onClick={pauseAudio}
                  className="w-full"
                >
                  Pause
                </Button>
                <Button
                  disabled={!isPlayable || isGeneratingAudio}
                  variant="secondary"
                  onClick={() => void restartAudio()}
                  className="w-full"
                >
                  Restart
                </Button>
              </div>

              {audioError ? (
                <Card className="border-destructive/30 bg-destructive/5">
                  <CardContent className="p-3">
                    <p className="text-sm font-medium text-destructive">Audio generation failed</p>
                    <p className="mt-2 text-xs text-muted-foreground">{audioError}</p>
                  </CardContent>
                </Card>
              ) : null}

              <Card>
                <CardContent className="p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-muted-foreground">Playback</p>
                    <p className="text-xs text-muted-foreground">
                      {formatClock(audioCurrentTime)} / {formatClock(audioDuration)}
                    </p>
                  </div>
                  <div className="mt-3 h-2 rounded-full bg-muted/70">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                </CardContent>
              </Card>

              <audio
                ref={audioRef}
                preload="auto"
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onTimeUpdate={(event) => setAudioCurrentTime(event.currentTarget.currentTime)}
                onLoadedMetadata={(event) => setAudioDuration(event.currentTarget.duration || 0)}
                onEnded={(event) => {
                  setIsPlaying(false);
                  const finalTime = event.currentTarget.duration || event.currentTarget.currentTime;
                  setAudioCurrentTime(Number.isFinite(finalTime) ? finalTime : 0);
                }}
                className="hidden"
              />

              <p className="text-center text-xs text-muted-foreground">
                {conversationMessages.length > 0
                  ? "Play generates a real podcast dialogue audio from the current conversation."
                  : "Generate a conversation first to enable audio generation."}
              </p>
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  );
}
