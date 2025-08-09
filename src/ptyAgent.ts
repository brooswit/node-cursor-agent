import { EventEmitter } from 'node:events';

// Track running PTY processes for cleanup
const runningPtyProcesses = new Set<any>();

// Cleanup on process exit
function setupPtyCleanup() {
  const cleanup = () => {
    for (const ptyProcess of runningPtyProcesses) {
      try {
        ptyProcess.kill?.();
      } catch {}
    }
    runningPtyProcesses.clear();
  };

  process.on('exit', cleanup);
  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
  process.on('uncaughtException', cleanup);
}

// Setup cleanup once
let ptyCleanupSetup = false;
if (!ptyCleanupSetup) {
  setupPtyCleanup();
  ptyCleanupSetup = true;
}

export interface PtySessionOptions {
  path?: string;
  model?: string;
  resume?: boolean | string;
  startInLs?: boolean;
  lsSelectionIndex?: number;
}

function createAnsiStripper(): (s: string) => string {
  const ansiRegex = /[\u001B\u009B][[\]()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g;
  return (s: string) => s.replace(ansiRegex, '');
}

async function importNodePty() {
  try {
    const pty = await import('node-pty');
    return pty;
  } catch (err) {
    throw new Error(`Failed to load node-pty. Ensure it is installed. Error: ${(err as Error).message}`);
  }
}

export class PtyAgentSession extends EventEmitter {
  private buffer: string = '';
  private closed = false;
  private p: any;
  private readonly stripAnsi = createAnsiStripper();

  static async start(options: PtySessionOptions = {}): Promise<PtyAgentSession> {
    const session = new PtyAgentSession();
    await session.startInternal(options);
    return session;
  }

  private async startInternal(options: PtySessionOptions): Promise<void> {
    const pty = await importNodePty();
    const cols = 120; // Fixed reasonable default
    const rows = 30;  // Fixed reasonable default

    const args: string[] = ['--force'];
    if (options.model) {
      args.push('--model', options.model);
    }
    if (options.resume !== undefined && !options.startInLs) {
      if (typeof options.resume === 'string' && options.resume.length > 0) {
        args.push('--resume', options.resume);
      } else {
        args.push('--resume');
      }
    }

    const shell = 'bash';
    const baseCmd = options.startInLs ? ['cursor-agent', 'ls'] : ['cursor-agent', ...args];
    const cmd = baseCmd.join(' ');
    this.p = pty.spawn(shell, ['-lc', cmd], {
      name: 'xterm-color',
      cols,
      rows,
      cwd: options.path,
      env: {
        ...process.env,
        TERM: 'xterm-256color',
      },
    });

    // Track for cleanup
    runningPtyProcesses.add(this.p);

    this.p.onData((data: string) => {
      this.buffer += data;
      this.emit('data', data);
    });

    this.p.onExit(() => {
      this.closed = true;
      runningPtyProcesses.delete(this.p);
      this.emit('exit');
    });

    // Wait for UI to appear (heuristic)
    await this.waitForAny([/Cursor Agent/i, /navigate .* Enter: select .* q\/ESC: exit/i], 8000).catch(() => undefined);

    if (options.startInLs) {
      const index = Math.max(0, options.lsSelectionIndex ?? 0);
      if (index > 0) this.down(index);
      this.enter();
      await this.waitForAny([/Cursor Agent/i, /model/i, /assistant/i], 8000).catch(() => undefined);
    }
  }

  getRawBuffer(): string {
    return this.buffer;
  }

  getPlainBuffer(): string {
    return this.stripAnsi(this.buffer);
  }

  write(text: string): void {
    if (this.closed) return;
    this.p.write(text);
  }

  type(text: string): void {
    this.write(text);
  }

  enter(): void {
    this.write('\r');
  }

  esc(): void {
    this.write('\x1b');
  }

  up(n: number = 1): void {
    for (let i = 0; i < n; i++) this.write('\x1b[A');
  }

  down(n: number = 1): void {
    for (let i = 0; i < n; i++) this.write('\x1b[B');
  }

  quit(): void {
    // TUI hints say q/ESC exits
    this.write('q');
    this.enter();
  }

  async waitFor(pattern: RegExp | string, timeoutMs: number = 8000): Promise<void> {
    const start = Date.now();
    const textMatcher = typeof pattern === 'string' ? (s: string) => s.includes(pattern) : (s: string) => pattern.test(s);
    return await new Promise((resolve, reject) => {
      const onData = () => {
        const plain = this.getPlainBuffer();
        if (textMatcher(plain)) {
          cleanup();
          resolve();
        } else if (Date.now() - start > timeoutMs) {
          cleanup();
          reject(new Error('waitFor timeout'));
        }
      };
      const timer = setInterval(onData, 50);
      const cleanup = () => {
        clearInterval(timer);
        this.off('data', onData);
      };
      this.on('data', onData);
      onData();
    });
  }

  async waitForAny(patterns: Array<RegExp | string>, timeoutMs: number = 8000): Promise<number> {
    const start = Date.now();
    return await new Promise((resolve, reject) => {
      const onData = () => {
        const plain = this.getPlainBuffer();
        for (let i = 0; i < patterns.length; i++) {
          const p = patterns[i];
          const ok = typeof p === 'string' ? plain.includes(p) : p.test(plain);
          if (ok) {
            cleanup();
            resolve(i);
            return;
          }
        }
        if (Date.now() - start > timeoutMs) {
          cleanup();
          reject(new Error('waitForAny timeout'));
        }
      };
      const timer = setInterval(onData, 50);
      const cleanup = () => {
        clearInterval(timer);
        this.off('data', onData);
      };
      this.on('data', onData);
      onData();
    });
  }

  dispose(): void {
    if (this.closed) return;
    try {
      runningPtyProcesses.delete(this.p);
      this.p?.kill?.();
    } catch {}
    this.closed = true;
  }

  getPlainBufferLength(): number {
    return this.getPlainBuffer().length;
  }

  getPlainBufferSlice(fromIndex: number = 0): string {
    const plain = this.getPlainBuffer();
    return plain.slice(fromIndex);
  }

  async waitForInactivity(inactiveMs: number = 1200, timeoutMs: number = 60000): Promise<void> {
    return await new Promise((resolve, reject) => {
      let last = Date.now();
      const onData = () => { last = Date.now(); };
      const interval = setInterval(() => {
        if (Date.now() - last >= inactiveMs) {
          cleanup();
          resolve();
        }
      }, Math.min(inactiveMs, 250));
      const timer = setTimeout(() => {
        cleanup();
        reject(new Error('waitForInactivity timeout'));
      }, timeoutMs);
      const cleanup = () => {
        clearInterval(interval);
        clearTimeout(timer);
        this.off('data', onData);
      };
      this.on('data', onData);
      onData();
    });
  }

  async sendMessageAndWaitForReply(text: string, options: { inactivityMs?: number; timeoutMs?: number } = {}): Promise<string> {
    const start = this.getPlainBufferLength();
    this.type(text);
    this.enter();
    await this.waitForInactivity(options.inactivityMs ?? 1500, options.timeoutMs ?? 60000);
    return this.getPlainBufferSlice(start).trim();
  }
}

export async function startPtyAgentSession(options: PtySessionOptions = {}): Promise<PtyAgentSession> {
  return await PtyAgentSession.start(options);
}

export async function startFromLsSelect(options: PtySessionOptions & { lsSelectionIndex?: number } = {}): Promise<PtyAgentSession> {
  return await PtyAgentSession.start({ ...options, startInLs: true, lsSelectionIndex: options.lsSelectionIndex ?? 0 });
}

export async function resumeLatest(options: PtySessionOptions = {}): Promise<PtyAgentSession> {
  return await PtyAgentSession.start({ ...options, resume: true });
}

export async function resumeById(chatId: string, options: PtySessionOptions = {}): Promise<PtyAgentSession> {
  return await PtyAgentSession.start({ ...options, resume: chatId });
}


