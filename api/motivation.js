import { processMotivationRequest } from '../lib/motivation.mjs';

const ALLOWED_ORIGINS = [
  'https://ro-novikov.github.io',
  'https://bitepal.vercel.app',
];

export default async function handler(req, res) {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

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
