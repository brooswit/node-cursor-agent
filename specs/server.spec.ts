import { describe, it, expect, afterAll } from 'bun:test';
import { startServer } from '../src/server';

const servers: Array<ReturnType<typeof startServer>> = [];
afterAll(() => {
  for (const s of servers) {
    try { s.stop(true); } catch {}
  }
});

describe('REST API server', () => {
  it('serves health and version and handles prompt', async () => {
    const server = startServer({ port: 0 });
    servers.push(server);
    const base = `http://${server.hostname}:${server.port}`;

    const health = await fetch(`${base}/health`);
    expect(health.status).toBe(200);
    const healthText = await health.text();
    expect(healthText.trim()).toBe('ok');

    const versionRes = await fetch(`${base}/version`);
    expect(versionRes.ok).toBeTrue();
    const versionJson = await versionRes.json();
    expect(versionJson.version.length).toBeGreaterThan(5);

    const promptRes = await fetch(`${base}/prompt`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: 'Return exactly: PONG' }),
    });
    expect(promptRes.ok).toBeTrue();
    const promptJson = await promptRes.json();
    expect(String(promptJson.output).trim()).toBe('PONG');
  }, 120000);
});


