import { prompt, getVersion } from './index';

type StartOptions = {
  port?: number;
  hostname?: string;
  // Default working directory for cursor-agent
  cwd?: string;
  // Default model to use if not provided per-request
  model?: string;
  // Allow all CORS by default
  cors?: boolean;
};

function jsonResponse(data: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(data), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      ...(init.headers ?? {}),
    },
    status: init.status,
    statusText: init.statusText,
  });
}

function buildCorsHeaders(): HeadersInit {
  return {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET,POST,OPTIONS',
    'access-control-allow-headers': 'content-type',
  };
}

export function createHandler(options: StartOptions = {}) {
  const defaultCors = options.cors !== false;
  return async function handler(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const pathname = url.pathname;

    // Preflight
    if (req.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: defaultCors ? buildCorsHeaders() : undefined,
      });
    }

    try {
      if (req.method === 'GET' && pathname === '/health') {
        return new Response('ok', {
          status: 200,
          headers: {
            'content-type': 'text/plain; charset=utf-8',
            ...(defaultCors ? buildCorsHeaders() : {}),
          },
        });
      }

      if (req.method === 'GET' && pathname === '/version') {
        const version = await getVersion();
        return jsonResponse({ version }, {
          headers: defaultCors ? buildCorsHeaders() : undefined,
        });
      }

      if (req.method === 'POST' && pathname === '/prompt') {
        const body = await req.json().catch(() => ({}));
        const text = (body?.text ?? body?.prompt ?? '').toString();
        const model = (body?.model ?? options.model) as string | undefined;
        const path = (body?.path ?? options.cwd) as string | undefined;

        if (!text || typeof text !== 'string') {
          return jsonResponse({ error: 'Missing required field: text' }, {
            status: 400,
            headers: defaultCors ? buildCorsHeaders() : undefined,
          });
        }

        const output = await prompt(text, { model, path });
        return jsonResponse({ output }, {
          headers: defaultCors ? buildCorsHeaders() : undefined,
        });
      }

      return jsonResponse({ error: 'Not found' }, {
        status: 404,
        headers: defaultCors ? buildCorsHeaders() : undefined,
      });
    } catch (err) {
      const message = (err as Error)?.message ?? 'Unknown error';
      return jsonResponse({ error: message }, {
        status: 500,
        headers: defaultCors ? buildCorsHeaders() : undefined,
      });
    }
  };
}

export function startServer(options: StartOptions = {}) {
  const handler = createHandler(options);
  const server = Bun.serve({
    port: options.port ?? 3000,
    hostname: options.hostname ?? '0.0.0.0',
    fetch: handler,
  });
  const url = `http://${server.hostname}:${server.port}`;
  // eslint-disable-next-line no-console
  console.log(`cursor-agent API server running at ${url}`);
  return server;
}

if (import.meta.main) {
  // Start with defaults when invoked directly
  startServer({});
}


