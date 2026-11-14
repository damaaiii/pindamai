import { handleAnalyzeLanguage, sendError, type ApiRequest, type ApiResponse } from '../../server/handlers';

export default async function handler(req: ApiRequest, res: ApiResponse) {
  try {
    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      res.end();
      return;
    }
    if (req.method !== 'POST') {
      return sendError(
        res,
        405,
        'METHOD_NOT_ALLOWED',
        'Gunakan metode POST untuk /api/ai/analyze-language.'
      );
    }
    return await handleAnalyzeLanguage(req, res);
  } catch (error) {
    console.error('[Vercel /api/ai/analyze-language Error]', error);
    return sendError(
      res,
      500,
      'INTERNAL_SERVER_ERROR',
      'Gagal memproses permintaan analisis bahasa di server.'
    );
  }
}
