import { spawn, ChildProcess } from 'node:child_process';
import { Readable } from 'node:stream';

// Version compatibility
const KNOWN_COMPATIBLE_VERSION = '2025.08.08-f57cb59';
let versionWarningShown = false;

// Track running processes for cleanup
const runningProcesses = new Set<ChildProcess>();

// Cleanup on process exit
function setupProcessCleanup() {
  const cleanup = () => {
    for (const child of runningProcesses) {
      try {
        child.kill('SIGTERM');
      } catch {}
    }
    runningProcesses.clear();
  };

  process.on('exit', cleanup);
  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
  process.on('uncaughtException', cleanup);
}

// Setup cleanup once
let cleanupSetup = false;
if (!cleanupSetup) {
  setupProcessCleanup();
  cleanupSetup = true;
}

async function checkLoginAndVersion(): Promise<void> {
  if (versionWarningShown) return;
  
  try {
    // Check if logged in first
    const statusResult = await execCursorAgent(['status']);
    const statusOutput = `${statusResult.stdout}\n${statusResult.stderr}`;
    if (!statusOutput.includes('Logged in')) {
      throw new Error('Not logged in to cursor-agent. Please run `cursor-agent login` first.');
    }

    // Then check version compatibility
    const currentVersion = await getVersion();
    if (currentVersion !== KNOWN_COMPATIBLE_VERSION) {
      console.warn(`⚠️  Warning: This SDK was tested with cursor-agent version ${KNOWN_COMPATIBLE_VERSION.slice(0, 8)}...`);
      console.warn(`   Current version: ${currentVersion.slice(0, 8)}...`);
      console.warn(`   The SDK may not work correctly with this version.`);
    }
    versionWarningShown = true;
  } catch (error) {
    throw new Error(`cursor-agent setup error: ${(error as Error).message}`);
  }
}

export interface RunOptions {
  input?: string | Buffer | Readable;
  model?: string;
  path?: string;
}

// Removed JsonResult and StreamJsonEvent interfaces - simplified to text output only

export interface RunResult {
  exitCode: number | null;
  stdout: string;
  stderr: string;
}


function stripAnsi(input: string): string {
  // Basic ANSI escape sequence remover (CSI + OSC + single ESC)
  const ansiRegex = /[\u001B\u009B][[\]()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g;
  return input.replace(ansiRegex, '');
}

function tryParseJsonObjectFromText<T = unknown>(text: string): T {
  const cleaned = stripAnsi(text).trim();
  // Fast path
  try {
    if (cleaned.startsWith('{')) {
      return JSON.parse(cleaned) as T;
    }
  } catch {}
  // Fallback: parse last line that looks like JSON
  const lines = cleaned.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i];
    if (line.startsWith('{') && line.endsWith('}')) {
      try {
        return JSON.parse(line) as T;
      } catch {
        continue;
      }
    }
  }
  throw new Error(`No JSON object found in output: ${cleaned}`);
}

function buildArgs(options: RunOptions): string[] {
  const args: string[] = ['--print', '--force'];
  if (options.model) {
    args.push('--model', options.model);
  }
  return args;
}

function execCursorAgent(args: string[], options: RunOptions = {}): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    const child = spawn('cursor-agent', args, {
      cwd: options.path,
      env: process.env,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    // Track for cleanup
    runningProcesses.add(child);

    let stdout = '';
    let stderr = '';

    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => (stdout += chunk));
    child.stderr.on('data', (chunk) => (stderr += chunk));

    // No timeout - let cursor-agent handle timing

    child.on('error', (error) => {
      runningProcesses.delete(child);
      reject(error);
    });

    child.on('close', (code) => {
      runningProcesses.delete(child);
      resolve({ exitCode: code, stdout, stderr });
    });

    if (options.input instanceof Readable) {
      options.input.pipe(child.stdin);
    } else if (typeof options.input === 'string' || Buffer.isBuffer(options.input)) {
      child.stdin.end(options.input);
    } else {
      child.stdin.end();
    }
  });
}

export async function prompt(text: string, options: RunOptions = {}): Promise<string> {
  await checkLoginAndVersion();
  const args = buildArgs(options);
  const { exitCode, stdout, stderr } = await execCursorAgent(args, { ...options, input: text });
  if (exitCode !== 0) {
    throw new Error(`cursor-agent exited with code ${exitCode}: ${stderr || stdout}`);
  }
  const cleaned = stripAnsi(stdout).trim();
  try {
    const obj = tryParseJsonObjectFromText<any>(cleaned);
    if (obj && typeof obj === 'object') {
      if (typeof obj.result === 'string') {
        return obj.result.trim();
      }
      // Fallback to concatenating assistant message text, if present
      const message = (obj as any).message;
      const content = Array.isArray(message?.content) ? message.content : [];
      const textParts = content
        .filter((c: any) => c && typeof c === 'object' && c.type === 'text' && typeof c.text === 'string')
        .map((c: any) => c.text)
        .join('');
      if (textParts) {
        return textParts.trim();
      }
    }
  } catch {}
  return cleaned;
}

// Removed runJson and runStreamJson - use runText with cursor-agent defaults

export async function getVersion(): Promise<string> {
  const { stdout } = await execCursorAgent(['--version']);
  return stripAnsi(stdout).trim();
}

// Removed getAuthStatus and logout - rely on cursor-agent login/logout CLI directly

export { execCursorAgent };
export * from './ptyAgent';
export * from './CursorAgentSession';

// (Removed) PTY-based ls listing helpers in favor of high-level CursorAgentSession flows

