> ## Documentation Index
> Fetch the complete documentation index at: https://docs.firecrawl.dev/llms.txt
> Use this file to discover all available pages before exploring further.

# Quickstart

> Firecrawl allows you to turn entire websites into LLM-ready markdown

## Scrape your first website

Turn any website into clean, LLM-ready data with a single API call.

<CardGroup cols={2}>
  <Card title="Get your API key" icon="key" href="https://www.firecrawl.dev/app/api-keys">
    Sign up and get your API key to start scraping
  </Card>

  <Card title="Try it in the Playground" icon="play" href="https://www.firecrawl.dev/playground">
    Test the API instantly without writing any code
  </Card>
</CardGroup>

### Use Firecrawl with AI agents (recommended)

The Firecrawl skill is the fastest way for agents to discover and use Firecrawl. Without it, your agent will not know Firecrawl is available.

```bash  theme={null}
npx -y firecrawl-cli@latest init --all --browser
```

<Note>
  Restart your agent after installing the skill. See [Skill + CLI](/sdks/cli) for the full setup.
</Note>

Or use the [MCP Server](/mcp-server) to connect Firecrawl directly to Claude, Cursor, Windsurf, VS Code, and other AI tools.

### Make your first request

Copy the code below, replace `fc-YOUR-API-KEY` with your API key, and run it:

<CodeGroup>
  ```bash cURL theme={null}
  curl -X POST 'https://api.firecrawl.dev/v2/scrape' \
    -H 'Authorization: Bearer fc-YOUR-API-KEY' \
    -H 'Content-Type: application/json' \
    -d '{"url": "https://example.com"}'
  ```

  ```python Python theme={null}
  # pip install firecrawl-py
  from firecrawl import Firecrawl

  app = Firecrawl(api_key="fc-YOUR-API-KEY")
  result = app.scrape("https://example.com")
  print(result)
  ```

  ```javascript Node theme={null}
  // npm install @mendable/firecrawl-js
  import Firecrawl from '@mendable/firecrawl-js';

  const app = new Firecrawl({ apiKey: "fc-YOUR-API-KEY" });
  const result = await app.scrape("https://example.com");
  console.log(result);
  ```

  ```bash CLI theme={null}
  firecrawl https://example.com
  ```
</CodeGroup>

<Accordion title="Example response">
  ```json  theme={null}
  {
    "success": true,
    "data": {
      "markdown": "# Example Domain\n\nThis domain is for use in illustrative examples...",
      "metadata": {
        "title": "Example Domain",
        "sourceURL": "https://example.com"
      }
    }
  }
  ```
</Accordion>

***

## What can Firecrawl do?

<CardGroup cols={4}>
  <Card title="Scrape" icon="file-lines" href="#scraping">
    Extract content from any URL in markdown, HTML, or structured JSON
  </Card>

  <Card title="Search" icon="magnifying-glass" href="#search">
    Search the web and get full page content from results
  </Card>

  <Card title="Agent" icon="robot" href="#agent">
    Autonomous web data gathering powered by AI
  </Card>

  <Card title="Browser" icon="browser" href="/features/browser">
    Secure, sandboxed browser sessions for interactive web workflows
  </Card>
</CardGroup>

### Why Firecrawl?

* **LLM-ready output**: Get clean markdown, structured JSON, screenshots, and more
* **Handles the hard stuff**: Proxies, anti-bot, JavaScript rendering, and dynamic content
* **Reliable**: Built for production with high uptime and consistent results
* **Fast**: Get results in seconds, optimized for high-throughput
* **Browser Sandbox**: Fully managed browser environments for agents, zero config, scales to any size
* **MCP Server**: Connect Firecrawl to any AI tool via the [Model Context Protocol](/mcp-server)

***

## Scraping

Scrape any URL and get its content in markdown, HTML, or other formats. See the [Scrape feature docs](/features/scrape) for all options.

<CodeGroup>
  ```python Python theme={null}
  from firecrawl import Firecrawl

  firecrawl = Firecrawl(api_key="fc-YOUR-API-KEY")

  # Scrape a website:
  doc = firecrawl.scrape("https://firecrawl.dev", formats=["markdown", "html"])
  print(doc)
  ```

  ```js Node theme={null}
  import Firecrawl from '@mendable/firecrawl-js';

  const firecrawl = new Firecrawl({ apiKey: "fc-YOUR-API-KEY" });

  // Scrape a website:
  const doc = await firecrawl.scrape('https://firecrawl.dev', { formats: ['markdown', 'html'] });
  console.log(doc);
  ```

  ```bash cURL theme={null}
  curl -s -X POST "https://api.firecrawl.dev/v2/scrape" \
    -H "Authorization: Bearer $FIRECRAWL_API_KEY" \
    -H "Content-Type: application/json" \
    -d '{
      "url": "https://firecrawl.dev",
      "formats": ["markdown", "html"]
    }'
  ```

  ```bash CLI theme={null}
  # Scrape a URL and get markdown
  firecrawl https://firecrawl.dev

  # With multiple formats (returns JSON)
  firecrawl https://firecrawl.dev --format markdown,html,links --pretty
  ```
</CodeGroup>

<Accordion title="Response">
  SDKs will return the data object directly. cURL will return the payload exactly as shown below.

  ```json  theme={null}
  {
    "success": true,
    "data" : {
      "markdown": "Launch Week I is here! [See our Day 2 Release 🚀](https://www.firecrawl.dev/blog/launch-week-i-day-2-doubled-rate-limits)[💥 Get 2 months free...",
      "html": "<!DOCTYPE html><html lang=\"en\" class=\"light\" style=\"color-scheme: light;\"><body class=\"__variable_36bd41 __variable_d7dc5d font-inter ...",
      "metadata": {
        "title": "Home - Firecrawl",
        "description": "Firecrawl crawls and converts any website into clean markdown.",
        "language": "en",
        "keywords": "Firecrawl,Markdown,Data,Mendable,Langchain",
        "robots": "follow, index",
        "ogTitle": "Firecrawl",
        "ogDescription": "Turn any website into LLM-ready data.",
        "ogUrl": "https://www.firecrawl.dev/",
        "ogImage": "https://www.firecrawl.dev/og.png?123",
        "ogLocaleAlternate": [],
        "ogSiteName": "Firecrawl",
        "sourceURL": "https://firecrawl.dev",
        "statusCode": 200
      }
    }
  }
  ```
</Accordion>

## Search

Firecrawl's search API allows you to perform web searches and optionally scrape the search results in one operation.

* Choose specific output formats (markdown, HTML, links, screenshots)
* Choose specific sources (web, news, images)
* Search the web with customizable parameters (location, etc.)

For details, see the [Search Endpoint API Reference](/api-reference/endpoint/search).

<CodeGroup>
  ```python Python theme={null}
  from firecrawl import Firecrawl

  firecrawl = Firecrawl(api_key="fc-YOUR-API-KEY")

  results = firecrawl.search(
      query="firecrawl",
      limit=3,
  )
  print(results)
  ```

  ```js Node theme={null}
  import Firecrawl from '@mendable/firecrawl-js';

  const firecrawl = new Firecrawl({ apiKey: "fc-YOUR-API-KEY" });

  const results = await firecrawl.search('firecrawl', {
    limit: 3,
    scrapeOptions: { formats: ['markdown'] }
  });
  console.log(results);
  ```

  ```bash  theme={null}
  curl -s -X POST "https://api.firecrawl.dev/v2/search" \
    -H "Authorization: Bearer $FIRECRAWL_API_KEY" \
    -H "Content-Type: application/json" \
    -d '{
      "query": "firecrawl",
      "limit": 3
    }'
  ```

  ```bash CLI theme={null}
  # Search the web
  firecrawl search "firecrawl web scraping" --limit 5 --pretty
  ```
</CodeGroup>

<Accordion title="Response">
  SDKs will return the data object directly. cURL will return the complete payload.

  ```json JSON theme={null}
  {
    "success": true,
    "data": {
      "web": [
        {
          "url": "https://www.firecrawl.dev/",
          "title": "Firecrawl - The Web Data API for AI",
          "description": "The web crawling, scraping, and search API for AI. Built for scale. Firecrawl delivers the entire internet to AI agents and builders.",
          "position": 1
        },
        {
          "url": "https://github.com/firecrawl/firecrawl",
          "title": "mendableai/firecrawl: Turn entire websites into LLM-ready ... - GitHub",
          "description": "Firecrawl is an API service that takes a URL, crawls it, and converts it into clean markdown or structured data.",
          "position": 2
        },
        ...
      ],
      "images": [
        {
          "title": "Quickstart | Firecrawl",
          "imageUrl": "https://mintlify.s3.us-west-1.amazonaws.com/firecrawl/logo/logo.png",
          "imageWidth": 5814,
          "imageHeight": 1200,
          "url": "https://docs.firecrawl.dev/",
          "position": 1
        },
        ...
      ],
      "news": [
        {
          "title": "Y Combinator startup Firecrawl is ready to pay $1M to hire three AI agents as employees",
          "url": "https://techcrunch.com/2025/05/17/y-combinator-startup-firecrawl-is-ready-to-pay-1m-to-hire-three-ai-agents-as-employees/",
          "snippet": "It's now placed three new ads on YC's job board for “AI agents only” and has set aside a $1 million budget total to make it happen.",
          "date": "3 months ago",
          "position": 1
        },
        ...
      ]
    }
  }
  ```
</Accordion>

## Agent

Firecrawl's Agent is an autonomous web data gathering tool. Just describe what data you need, and it will search, navigate, and extract it from anywhere on the web. See the [Agent feature docs](/features/agent) for all options.

<CodeGroup>
  ```bash cURL theme={null}
  curl -X POST 'https://api.firecrawl.dev/v2/agent' \
    -H 'Authorization: Bearer fc-YOUR-API-KEY' \
    -H 'Content-Type: application/json' \
    -d '{
      "prompt": "Find the pricing plans for Notion"
    }'
  ```

  ```python Python theme={null}
  from firecrawl import Firecrawl

  app = Firecrawl(api_key="fc-YOUR-API-KEY")
  result = app.agent("Find the pricing plans for Notion")
  print(result)
  ```

  ```javascript Node theme={null}
  import Firecrawl from '@mendable/firecrawl-js';

  const app = new Firecrawl({ apiKey: "fc-YOUR-API-KEY" });
  const result = await app.agent("Find the pricing plans for Notion");
  console.log(result);
  ```
</CodeGroup>

<Accordion title="Example response">
  ```json  theme={null}
  {
    "success": true,
    "data": {
      "result": "Notion offers the following pricing plans:\n\n1. **Free** - $0/month - For individuals...\n2. **Plus** - $10/seat/month - For small teams...\n3. **Business** - $18/seat/month - For companies...\n4. **Enterprise** - Custom pricing - For large organizations...",
      "sources": [
        "https://www.notion.so/pricing"
      ]
    }
  }
  ```
</Accordion>

***

## Resources

<CardGroup cols={2}>
  <Card title="API Reference" icon="code" href="/api-reference/v2-introduction">
    Complete API documentation with interactive examples
  </Card>

  <Card title="SDKs" icon="boxes-stacked" href="/sdks/overview">
    Python, Node.js, CLI, and community SDKs
  </Card>

  <Card title="Open Source" icon="github" href="/contributing/open-source-or-cloud">
    Self-host Firecrawl or contribute to the project
  </Card>

  <Card title="Integrations" icon="puzzle-piece" href="/developer-guides/llm-sdks-and-frameworks/openai">
    LangChain, LlamaIndex, OpenAI, and more
  </Card>
</CardGroup>
