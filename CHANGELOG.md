## 0.4.1

**Changed:**
- Update known compatible `cursor-agent` version to `2025.08.08-f57cb59` and silence warning for this version.

## 0.4.0

**Added:**
- Bun REST API server in `src/server.ts` with endpoints: `GET /health`, `GET /version`, `POST /prompt`
- Tests for server in `specs/server.spec.ts`
- Build and run scripts: `start:server`, `dev:server`

## 0.3.0

**BREAKING CHANGES:**
- Removed `CursorAgentSession.resumeLatest()`, `CursorAgentSession.resumeById()`, and `CursorAgentSession.selectFromList()` methods
- Simplified to just `CursorAgentSession.start()` - maximum simplicity
- Renamed `dispose()` → `close()` for better semantics

**Added:**
- Version compatibility warnings - warns if cursor-agent CLI version differs from tested version
- Compatibility checks run automatically on first API usage

## 0.2.0

**BREAKING CHANGES:**
- Removed `apiKey` option - rely on `cursor-agent login` CLI state instead
- Removed `getAuthStatus()` and `logout()` - use `cursor-agent` CLI directly
- Removed `runJson()` and `runStreamJson()` - simplified to `runText()` only
- Removed `outputFormat` option - uses cursor-agent defaults
- Force option now defaults to `true`

**Added:**
- High-level `CursorAgentSession` class for interactive PTY sessions
- Methods: `start()`, `resumeLatest()`, `resumeById()`, `selectFromList()`
- Session methods: `.send()`, `.waitUntilDone()`, `.on('data')`, `.quit()`, `.dispose()`

**Simplified API:**
- Focused on two clear modes: simple text prompts and full interactive sessions
- Cleaner documentation focusing on core use cases

## 0.1.1

- **BREAKING**: Renamed `cwd` option to `workingDirectory` for better clarity
- Updated documentation to reflect the working directory parameter
- Added test coverage for working directory functionality

## 0.1.0

- Initial release: TypeScript SDK wrapping `cursor-agent` non-interactive modes (`--print` with `text`, `json`, `stream-json`).
- Added helpers: `runText`, `runJson`, `runStreamJson`, `getVersion`, `getAuthStatus`, `logout`.
- Added Bun tests in `specs/`.

