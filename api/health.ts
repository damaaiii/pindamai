import { handleHealth, sendError, type ApiRequest, type ApiResponse } from '../server/handlers';

export default async function handler(req: ApiRequest, res: ApiResponse) {
  try {
    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      res.end();
      return;
    }
    if (req.method && req.method !== 'GET') {
      return sendError(
        res,
        405,
        'METHOD_NOT_ALLOWED',
        'Metode HTTP tidak diizinkan untuk /api/health.'
      );
    }
    return await handleHealth(req, res);
  } catch (error) {
    console.error('[Vercel /api/health Error]', error);
    return sendError(
      res,
      500,
      'INTERNAL_SERVER_ERROR',
      'Koneksi ke server kesehatan API bermasalah.'
    );
  }
}
