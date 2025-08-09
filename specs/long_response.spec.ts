import { describe, it, expect, afterAll } from 'bun:test';
import { prompt } from '../src/index';
import { startServer } from '../src/server';

const LARGE_LENGTH = 4000;
const LARGE_TEXT = 'X'.repeat(LARGE_LENGTH);
const MIN_EXPECTED = LARGE_LENGTH - 50; // allow small variance from the agent

const servers: Array<ReturnType<typeof startServer>> = [];
afterAll(() => {
  for (const s of servers) {
    try { s.stop(true); } catch {}
  }
});

describe('handling long responses', () => {
  it('SDK prompt returns full long response', async () => {
    const out = await prompt(`Return exactly: ${LARGE_TEXT}`);
    expect(out.length).toBeGreaterThanOrEqual(MIN_EXPECTED);
    expect(out.includes('X'.repeat(200))).toBeTrue();
  }, 180000);

  it('REST API returns full long response', async () => {
    const server = startServer({ port: 0 });
    servers.push(server);
    const base = `http://${server.hostname}:${server.port}`;

    const res = await fetch(`${base}/prompt`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: `Return exactly: ${LARGE_TEXT}` }),
    });
    expect(res.ok).toBeTrue();
    const json = await res.json();
    const output: string = String(json.output ?? '');
    expect(output.length).toBeGreaterThanOrEqual(MIN_EXPECTED);
    expect(output.includes('X'.repeat(200))).toBeTrue();
  }, 180000);
});


