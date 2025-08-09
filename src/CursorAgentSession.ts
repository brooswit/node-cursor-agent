import { EventEmitter } from 'node:events';
import {
  PtyAgentSession,
  startPtyAgentSession,
  startFromLsSelect,
  PtySessionOptions,
} from './ptyAgent';
// Avoid circular import - define getVersion locally

// Version compatibility
const KNOWN_COMPATIBLE_VERSION = '2025.08.08-f57cb59';
let versionWarningShown = false;

async function getVersionLocal(): Promise<string> {
  const { spawn } = await import('node:child_process');
  return new Promise((resolve, reject) => {
    const child = spawn('cursor-agent', ['--version'], { stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk) => (stdout += chunk));
    child.on('close', (code) => {
      if (code === 0) resolve(stdout.trim());
      else reject(new Error(`cursor-agent --version failed with code ${code}`));
    });
    child.on('error', reject);
  });
}

async function checkLoginAndVersion(): Promise<void> {
  if (versionWarningShown) return;
  
  try {
    const { spawn } = await import('node:child_process');
    
    // Check if logged in first
    const statusResult = await new Promise<{stdout: string, stderr: string}>((resolve, reject) => {
      const child = spawn('cursor-agent', ['status'], { stdio: ['pipe', 'pipe', 'pipe'] });
      let stdout = '', stderr = '';
      child.stdout.setEncoding('utf8');
      child.stderr.setEncoding('utf8');
      child.stdout.on('data', (chunk) => (stdout += chunk));
      child.stderr.on('data', (chunk) => (stderr += chunk));
      child.on('close', () => resolve({ stdout, stderr }));
      child.on('error', reject);
    });
    
    const statusOutput = `${statusResult.stdout}\n${statusResult.stderr}`;
    if (!statusOutput.includes('Logged in')) {
      throw new Error('Not logged in to cursor-agent. Please run `cursor-agent login` first.');
    }

    // Then check version compatibility
    const currentVersion = await getVersionLocal();
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

export interface CursorAgentSessionOptions extends PtySessionOptions {}

export class CursorAgentSession extends EventEmitter {
  private readonly inner: PtyAgentSession;

  private constructor(inner: PtyAgentSession) {
    super();
    this.inner = inner;
    this.inner.on('data', (d) => this.emit('data', d));
    this.inner.on('exit', () => this.emit('exit'));
  }

  static async start(options: CursorAgentSessionOptions = {}): Promise<CursorAgentSession> {
    await checkLoginAndVersion();
    const inner = await startPtyAgentSession(options);
    return new CursorAgentSession(inner);
  }

// Removed resumeLatest, resumeById, and selectFromList methods - use start() only

  onData(listener: (chunk: string) => void): () => void {
    this.on('data', listener);
    return () => this.off('data', listener);
  }

  async send(prompt: string): Promise<string> {
    return await this.inner.sendMessageAndWaitForReply(prompt);
  }

  async waitUntilDone(inactivityMs: number = 1500): Promise<void> {
    await this.inner.waitForInactivity(inactivityMs, Number.MAX_SAFE_INTEGER);
  }

  type(text: string): void {
    this.inner.type(text);
  }

  enter(): void {
    this.inner.enter();
  }

  up(n: number = 1): void {
    this.inner.up(n);
  }

  down(n: number = 1): void {
    this.inner.down(n);
  }

  close(): void {
    this.inner.quit();
    this.inner.dispose();
  }

  getPlainBuffer(): string {
    return this.inner.getPlainBuffer();
  }

  getRawBuffer(): string {
    return this.inner.getRawBuffer();
  }
}


