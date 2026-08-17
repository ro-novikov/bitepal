import { processMotivationRequest } from '../lib/motivation.mjs';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { audio, mimeType } = req.body || {};
    const result = await processMotivationRequest({ audio, mimeType });
    return res.status(200).json(result);
  } catch (err) {
    console.error(err);
    const status = err.message.includes('Missing') || err.message.includes('transcribe') ? 400 : 500;
    return res.status(status).json({ error: err.message || 'Something went wrong' });
  }
}
