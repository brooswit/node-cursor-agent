## node-cursor-agent

TypeScript SDK wrapper for the `cursor-agent` CLI with two modes:

1. **Non-interactive mode**: Simple text-based prompts via `--print`
2. **Interactive session mode**: Full PTY sessions supporting resume, conversation history, and real-time interaction

### Install

```bash
bun install node-cursor-agent
```

### Prerequisites

You must be logged in to cursor-agent:

```bash
cursor-agent login
```

### Usage

**Simple non-interactive prompts:**

```ts
import { prompt, getVersion } from 'node-cursor-agent';

const response = await prompt('Return exactly: PONG');
console.log(response); // "PONG"

const version = await getVersion();
```

**Interactive sessions:**

```ts
import { CursorAgentSession } from 'node-cursor-agent';

// Start new session
const session = await CursorAgentSession.start();
session.on('data', (chunk) => process.stdout.write(chunk));

const reply = await session.send('Return exactly: PONG');
console.log('Reply:', reply);

session.close();
```

### API

**Non-interactive:**
- `prompt(text, options?)` - Send prompt and get text response
- `getVersion()` - Get cursor-agent version

**Interactive sessions:**
- `CursorAgentSession.start(options?)` - Start new session

**Session methods:**
- `.send(prompt)` - Send message and wait for response
- `.waitUntilDone(inactivityMs?)` - Wait for current generation to finish
- `.on('data', callback)` - Stream raw TUI output
- `.close()` - Exit session and clean up resources

### Options

- `model?: string` - AI model to use (e.g., 'gpt-5', 'sonnet-4')
- `path?: string` - Directory to run in

### Tests

Tests are under `specs/` and use `bun test`.

```bash
bun test
```

### REST API server (Bun)

You can run a minimal REST API to expose `cursor-agent` via HTTP.

Endpoints:

- `GET /health` → `ok`
- `GET /version` → `{ version }`
- `POST /prompt` → `{ output }` with JSON body `{ "text": string, "model?": string, "path?": string }`

Run in dev:

```bash
bun run ./src/server.ts
```

Build and start:

```bash
bun run build
bun run start:server
```

Example request:

```bash
curl -s http://localhost:3000/health
curl -s http://localhost:3000/version
curl -s -X POST http://localhost:3000/prompt \
  -H 'content-type: application/json' \
  -d '{"text":"Return exactly: PONG"}'
```

### Notes

- Requires `cursor-agent` installed and available on PATH.
- This SDK intentionally avoids interactive features (e.g., `--fullscreen`, `resume`, TUI). Use `--print` non-interactive modes only.
  - Exception: optional PTY-based `ls` wrappers which simulate a TTY and parse visible text. Enable TUI tests with `RUN_TUI_TESTS=1`.

### License

MIT