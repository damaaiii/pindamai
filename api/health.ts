import { handleHealth, sendJson, type ApiRequest, type ApiResponse } from '../server/handlers';

export default async function handler(req: ApiRequest, res: ApiResponse) {
  try {
    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      res.end();
      return;
    }
    if (req.method && req.method !== 'GET') {
      return sendJson(res, 405, {
        error: 'Metode HTTP tidak diizinkan untuk /api/health.',
        code: 'METHOD_NOT_ALLOWED',
      });
    }
    return await handleHealth(req, res);
  } catch (error) {
    console.error('[Vercel /api/health Error]', error);
    return sendJson(res, 500, {
      error: 'Koneksi ke server kesehatan API bermasalah.',
      code: 'INTERNAL_SERVER_ERROR',
    });
  }
}
