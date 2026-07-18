import { NextResponse } from 'next/server';

const MAX_AUDIO_BYTES = 25 * 1024 * 1024;
const TRANSCRIPTION_TIMEOUT_MS = 45_000;

const ALLOWED_MIME_TYPES = new Set([
  'audio/flac',
  'audio/m4a',
  'audio/mp4',
  'audio/mpeg',
  'audio/ogg',
  'audio/wav',
  'audio/webm',
  'audio/x-wav',
]);

const ALLOWED_EXTENSIONS = new Set(['.flac', '.m4a', '.mp3', '.mp4', '.mpeg', '.ogg', '.wav', '.webm']);

type GroqTranscription = {
  text?: unknown;
  language?: unknown;
  duration?: unknown;
};

function getExtension(fileName: string): string {
  const match = fileName.toLowerCase().match(/\.[a-z0-9]+$/);
  return match?.[0] || '';
}

function extensionForMimeType(mimeType: string): string {
  if (mimeType === 'audio/mpeg') return '.mp3';
  if (mimeType === 'audio/mp4' || mimeType === 'audio/m4a') return '.m4a';
  if (mimeType === 'audio/ogg') return '.ogg';
  if (mimeType === 'audio/wav' || mimeType === 'audio/x-wav') return '.wav';
  if (mimeType === 'audio/flac') return '.flac';
  return '.webm';
}

function normalizeLanguageHint(value: FormDataEntryValue | null): string | null {
  if (typeof value !== 'string') return null;

  const language = value.trim().toLowerCase().split('-')[0];
  return /^[a-z]{2}$/.test(language) ? language : null;
}

async function readGroqResponse(response: Response): Promise<GroqTranscription> {
  const rawBody = await response.text();
  let data: GroqTranscription & { error?: { message?: string } } = {};

  try {
    data = JSON.parse(rawBody) as typeof data;
  } catch {
    throw new Error(response.ok ? 'Groq returned an invalid transcription response.' : `Groq request failed (${response.status}).`);
  }

  if (!response.ok) {
    throw new Error(data.error?.message || `Groq transcription failed (${response.status}).`);
  }

  return data;
}

export async function POST(req: Request) {
  try {
    const groqKey = process.env.GROQ_API_KEY;
    if (!groqKey) {
      return NextResponse.json({ error: 'GROQ_API_KEY is not configured.' }, { status: 503 });
    }

    const formData = await req.formData();
    const audioEntry = formData.get('file');

    if (!(audioEntry instanceof Blob)) {
      return NextResponse.json({ error: 'No supported audio file was provided.' }, { status: 400 });
    }

    if (audioEntry.size === 0) {
      return NextResponse.json({ error: 'The audio file is empty.' }, { status: 400 });
    }

    if (audioEntry.size > MAX_AUDIO_BYTES) {
      return NextResponse.json({ error: 'Audio file is larger than the 25 MB transcription limit.' }, { status: 413 });
    }

    const mimeType = audioEntry.type.toLowerCase().split(';')[0];
    const originalName = 'name' in audioEntry && typeof (audioEntry as File).name === 'string'
      ? (audioEntry as File).name
      : '';
    const extension = getExtension(originalName) || extensionForMimeType(mimeType);

    if (!ALLOWED_MIME_TYPES.has(mimeType) && !ALLOWED_EXTENSIONS.has(extension)) {
      return NextResponse.json({ error: 'Unsupported audio format. Please use WebM, WAV, MP3, M4A, OGG, or FLAC.' }, { status: 415 });
    }

    const languageHint = normalizeLanguageHint(formData.get('language'));
    const groqData = new FormData();
    groqData.append('file', audioEntry, `voice${extension}`);
    groqData.append('model', 'whisper-large-v3');
    groqData.append('temperature', '0');
    groqData.append('response_format', 'verbose_json');
    groqData.append(
      'prompt',
      'TryNext AI. App, website, UI, dashboard, create, modify, clone. Preserve the speaker\'s language and wording exactly.',
    );

    // Auto-detection remains the default. A trusted ISO-639-1 hint improves accuracy when the client knows it.
    if (languageHint) groqData.append('language', languageHint);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TRANSCRIPTION_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${groqKey}` },
        body: groqData,
        signal: controller.signal,
        cache: 'no-store',
      });
    } finally {
      clearTimeout(timeout);
    }

    const data = await readGroqResponse(response);
    const text = typeof data.text === 'string' ? data.text.trim() : '';

    if (!text) {
      return NextResponse.json({ error: 'No speech was detected in the audio.' }, { status: 422 });
    }

    return NextResponse.json({
      text,
      language: typeof data.language === 'string' ? data.language : null,
      duration: typeof data.duration === 'number' ? data.duration : null,
      languageHint,
    });
  } catch (error) {
    const isTimeout = error instanceof Error && error.name === 'AbortError';
    const message = isTimeout
      ? 'Transcription timed out. Please try a shorter voice command.'
      : error instanceof Error
        ? error.message
        : 'Audio transcription failed.';

    console.error('Audio transcription failed:', message);
    return NextResponse.json({ error: message }, { status: isTimeout ? 504 : 502 });
  }
}
