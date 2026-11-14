import 'dotenv/config';
import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  handleAnalyzeLanguage,
  handleGeneratePractice,
  handleHealth,
  handleScanObjects,
  handleTts,
  sendJson,
} from './server/handlers';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '15mb' }));

  // Handle malformed JSON request bodies with JSON error rather than HTML
  app.use((err: unknown, _req: Request, res: Response, next: NextFunction) => {
    if (err instanceof SyntaxError && 'body' in err) {
      return sendJson(res, 400, {
        error: 'Format JSON yang dikirim ke server tidak valid.',
        code: 'INVALID_JSON_BODY',
      });
    }
    return next(err);
  });

  app.get('/api/health', (req: Request, res: Response) => {
    void handleHealth(req, res);
  });

  app.post('/api/ai/scan-objects', (req: Request, res: Response) => {
    void handleScanObjects(req, res);
  });

  app.post('/api/ai/analyze-language', (req: Request, res: Response) => {
    void handleAnalyzeLanguage(req, res);
  });

  app.post('/api/ai/generate-practice', (req: Request, res: Response) => {
    void handleGeneratePractice(req, res);
  });

  app.post('/api/ai/tts', (req: Request, res: Response) => {
    void handleTts(req, res);
  });

  // Never let unknown /api/* requests fall through to SPA HTML
  app.all('/api/*', (req: Request, res: Response) => {
    return sendJson(res, 404, {
      error: `Endpoint API (${req.path}) tidak ditemukan di server.`,
      code: 'API_NOT_FOUND',
    });
  });

  const httpServer = http.createServer(app);

  // Vite middleware in dev, static serving in prod
  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const hmrDisabled =
      process.env.DISABLE_HMR === 'true' || Boolean(process.env.APP_URL) || Boolean(process.env.K_SERVICE);

    if (hmrDisabled) {
      app.get('/@vite/client', (_req: Request, res: Response) => {
        res.type('application/javascript').send(`
const sheetsMap = new Map();
const linkSheetsMap = new Map();
if (typeof document !== 'undefined') {
  document.querySelectorAll('style[data-vite-dev-id]').forEach((el) => {
    sheetsMap.set(el.getAttribute('data-vite-dev-id'), el);
  });
  document.querySelectorAll('link[rel="stylesheet"][data-vite-dev-id]').forEach((el) => {
    linkSheetsMap.set(el.getAttribute('data-vite-dev-id'), el);
  });
}
export function updateStyle(id, content) {
  if (linkSheetsMap.has(id)) return;
  let style = sheetsMap.get(id);
  if (!style) {
    style = document.createElement('style');
    style.setAttribute('type', 'text/css');
    style.setAttribute('data-vite-dev-id', id);
    style.textContent = content;
    document.head.appendChild(style);
    sheetsMap.set(id, style);
  } else if (style.textContent !== content) {
    style.textContent = content;
  }
}
export function removeStyle(id) {
  if (linkSheetsMap.has(id)) {
    document.querySelectorAll('link[rel="stylesheet"][data-vite-dev-id]').forEach((el) => {
      if (el.getAttribute('data-vite-dev-id') === id) el.remove();
    });
    linkSheetsMap.delete(id);
  }
  const style = sheetsMap.get(id);
  if (style) {
    style.remove();
    sheetsMap.delete(id);
  }
}
export function createHotContext() {
  return {
    data: {},
    accept() {},
    acceptExports() {},
    dispose() {},
    prune() {},
    invalidate() {},
    decline() {},
    on() {},
    off() {},
    send() {},
  };
}
export function injectQuery(url, queryToInject) {
  if (url[0] !== '.' && url[0] !== '/') return url;
  const pathname = url.replace(/[?#].*$/, '');
  const { search, hash } = new URL(url, 'http://vite.dev');
  return pathname + '?' + queryToInject + (search ? '&' + search.slice(1) : '') + (hash || '');
}
export class ErrorOverlay extends HTMLElement {}
`);
      });
    }

    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: hmrDisabled ? false : { server: httpServer },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (_req: Request, res: Response) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`PINDAMAI server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start PINDAMAI server:', err);
  process.exit(1);
});
