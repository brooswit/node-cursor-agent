import { describe, it, expect } from 'bun:test';
import { getVersion, prompt } from '../src/index';

describe('cursor-agent SDK wrapper', () => {
  it('gets version', async () => {
    const version = await getVersion();
    expect(version.length).toBeGreaterThan(5);
  }, 30000);

  it('sends prompt', async () => {
    const result = await prompt('Return exactly: PONG');
    expect(result.trim()).toBe('PONG');
  }, 60000);

  it('accepts path parameter', async () => {
    // Just verify the parameter is accepted without error
    const result = await prompt('Return exactly: PONG', { path: '.' });
    expect(result.trim()).toBe('PONG');
  }, 30000);
});


