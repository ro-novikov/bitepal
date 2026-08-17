const API_KEY = process.env.OPENAI_API_KEY;

const ALLOWED_ORIGINS = [
  'https://ro-novikov.github.io',
  'https://bitepal-eight.vercel.app',
  'https://bitepal-q4pksfb2w-ro-5be0.vercel.app',
];

async function transcribeAudio(buffer, mimeType) {
  const ext = mimeType.includes('mp4') ? 'mp4' : mimeType.includes('ogg') ? 'ogg' : 'webm';
  const formData = new FormData();
  formData.append('file', new Blob([buffer], { type: mimeType }), `audio.${ext}`);
  formData.append('model', 'whisper-1');
  formData.append('language', 'en');

  const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${API_KEY}` },
    body: formData,
  });

  if (!res.ok) throw new Error(`Whisper failed: ${await res.text()}`);

  const data = await res.json();
  return (data.text || '').trim();
}

async function analyzeMotivation(transcript) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature: 0.7,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'You are BitePal, a friendly weight-loss app. A user shared their motivation for losing weight. ' +
            'Return JSON with exactly two keys: "quotes" (an array of short 1-sentence paraphrases — one item per distinct reason they mentioned, each wrapped in quotes, first person; if only one reason, return an array with one item) ' +
            'and "response" (2-3 warm sentences acknowledging ALL their reasons and how BitePal will keep them front and center). ' +
            'Keep the tone encouraging, not clinical.',
        },
        {
          role: 'user',
          content: `User's spoken motivation:\n\n${transcript}`,
        },
      ],
    }),
  });

  if (!res.ok) throw new Error(`GPT failed: ${await res.text()}`);

  const data = await res.json();
  const parsed = JSON.parse(data.choices?.[0]?.message?.content || '{}');
  const quotes = Array.isArray(parsed.quotes)
    ? parsed.quotes.filter(Boolean)
    : parsed.quote
      ? [parsed.quote]
      : [`"${transcript}"`];

  return {
    quotes,
    response: parsed.response || 'Thank you for sharing your motivation.',
  };
}

function setCors(req, res) {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

module.exports = async (req, res) => {
  setCors(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    if (!API_KEY) throw new Error('OPENAI_API_KEY is not configured');

    const { audio, mimeType = 'audio/webm' } = req.body || {};
    if (!audio) return res.status(400).json({ error: 'Missing audio' });

    const buffer = Buffer.from(audio, 'base64');
    const transcript = await transcribeAudio(buffer, mimeType);
    if (!transcript) {
      return res.status(400).json({ error: 'Could not transcribe audio. Please try again.' });
    }

    const analysis = await analyzeMotivation(transcript);
    return res.status(200).json({ transcript, ...analysis });
  } catch (err) {
    console.error(err);
    const status = err.message.includes('Missing') || err.message.includes('transcribe') ? 400 : 500;
    return res.status(status).json({ error: err.message || 'Something went wrong' });
  }
};
