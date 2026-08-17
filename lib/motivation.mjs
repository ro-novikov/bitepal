const API_KEY = process.env.OPENAI_API_KEY;

export async function transcribeAudio(buffer, mimeType) {
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

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Whisper failed: ${err}`);
  }

  const data = await res.json();
  return (data.text || '').trim();
}

export async function analyzeMotivation(transcript) {
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

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`GPT failed: ${err}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content || '{}';
  const parsed = JSON.parse(content);
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

export async function processMotivationRequest({ audio, mimeType = 'audio/webm' }) {
  if (!API_KEY) {
    throw new Error('OPENAI_API_KEY is not configured');
  }
  if (!audio) {
    throw new Error('Missing audio');
  }

  const buffer = Buffer.from(audio, 'base64');
  const transcript = await transcribeAudio(buffer, mimeType);

  if (!transcript) {
    throw new Error('Could not transcribe audio. Please try again.');
  }

  const analysis = await analyzeMotivation(transcript);
  return { transcript, ...analysis };
}
