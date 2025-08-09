## SDK Spec: node-cursor-agent

Scope: Wrap non-interactive `cursor-agent` CLI behavior using `--print` with these formats:

- text: `--output-format text`
- json: `--output-format json` (single JSON object)
- stream-json: `--output-format stream-json` (NDJSON event stream)

Out of scope: Interactive TUI, `--fullscreen`, `resume`, `ls`.

### Public API

- `runText(prompt: string, options?): Promise<string>`
- `runJson<T = unknown>(prompt: string, options?): Promise<JsonResult<T>>`
- `runStreamJson(prompt: string, options?): AsyncGenerator<StreamJsonEvent>`
- `getVersion(): Promise<string>`
- `getAuthStatus(): Promise<'logged-in' | 'not-logged-in'>`
- `logout(): Promise<void>`

Options:

- `apiKey?: string` (falls back to login session)
- `model?: string`
- `force?: boolean`
- `cwd?: string`
- `env?: Record<string, string>`
- `timeoutMs?: number`

### Behavior

- Always pass `--print` to avoid interactive mode.
- Strip ANSI sequences from outputs before returning/parsing.
- For JSON mode, accept buffered output and parse the last valid JSON object if extra lines are present.
- For stream-json mode, parse each line as JSON and yield events.

### Errors

- Non-zero exit code throws with stderr/stdout included.
- Invalid JSON throws with raw output included (ANSI-stripped).


