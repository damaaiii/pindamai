import { handleTts, sendJson, type ApiRequest, type ApiResponse } from '../../server/handlers';

export default async function handler(req: ApiRequest, res: ApiResponse) {
  try {
    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      res.end();
      return;
    }
    if (req.method !== 'POST') {
      return sendJson(res, 405, {
        error: 'Gunakan metode POST untuk /api/ai/tts.',
        code: 'METHOD_NOT_ALLOWED',
      });
    }
    return await handleTts(req, res);
  } catch (error) {
    console.error('[Vercel /api/ai/tts Error]', error);
    return sendJson(res, 500, {
      error: 'Gagal memproses permintaan audio TTS di server.',
      code: 'INTERNAL_SERVER_ERROR',
    });
  }
}
