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
  segments?: unknown;
};

type GroqSegment = {
  text?: unknown;
  avg_logprob?: unknown;
  no_speech_prob?: unknown;
};

const HIGH_NO_SPEECH_PROBABILITY = 0.85;
const VERY_LOW_CONFIDENCE = -1.5;

function getExtension(fileName: string): string {
  const match = fileName.toLowerCase().match(/\.[a-z0-9]+$/);
  return match?.[0] || '';
}

function extensionForMimeType(mimeType: string): string {
  if (mimeType === 'audio/mpeg') return '.mp3';
  if (mimeType === 'audio/mp4') return '.mp4';
  if (mimeType === 'audio/m4a') return '.m4a';
  if (mimeType === 'audio/ogg') return '.ogg';
  if (mimeType === 'audio/wav' || mimeType === 'audio/x-wav') return '.wav';
  if (mimeType === 'audio/flac') return '.flac';
  return '.webm';
}

function containsLikelySpeech(data: GroqTranscription): boolean {
  if (!Array.isArray(data.segments) || data.segments.length === 0) {
    // Keep compatibility with providers that omit segment metadata rather than
    // rejecting a valid multilingual command solely because it is unavailable.
    return true;
  }

  const segments = data.segments as GroqSegment[];
  const textSegments = segments.filter((segment) => (
    typeof segment.text === 'string' && segment.text.trim().length > 0
  ));

  if (textSegments.length === 0) return false;

  // Reject only when every returned segment is strongly classified as
  // non-speech and very low confidence. This deliberately conservative rule
  // avoids discarding quiet speakers, accents, or local languages.
  return !textSegments.every((segment) => (
    typeof segment.no_speech_prob === 'number'
    && segment.no_speech_prob >= HIGH_NO_SPEECH_PROBABILITY
    && typeof segment.avg_logprob === 'number'
    && segment.avg_logprob <= VERY_LOW_CONFIDENCE
  ));
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
    const declaredExtension = getExtension(originalName);
    const hasSupportedMimeType = ALLOWED_MIME_TYPES.has(mimeType);
    // The browser-provided MIME type is more trustworthy than a fixed file
    // name. This keeps Safari MP4 recordings from being re-uploaded as WebM.
    const extension = hasSupportedMimeType
      ? extensionForMimeType(mimeType)
      : declaredExtension || extensionForMimeType(mimeType);

    if (!hasSupportedMimeType && !ALLOWED_EXTENSIONS.has(extension)) {
      return NextResponse.json({ error: 'Unsupported audio format. Please use WebM, WAV, MP3, M4A, OGG, or FLAC.' }, { status: 415 });
    }

    const languageHint = normalizeLanguageHint(formData.get('language'));
    const groqData = new FormData();
    groqData.append('file', audioEntry, `voice${extension}`);
    groqData.append('model', 'whisper-large-v3');
    groqData.append('temperature', '0');
    groqData.append('response_format', 'verbose_json');
    groqData.append('timestamp_granularities[]', 'segment');

    // Auto-detection remains the default. A trusted explicit ISO-639-1 hint
    // improves accuracy, but the browser locale is not sent blindly because a
    // multilingual speaker may be using a device configured in another language.
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

    if (!containsLikelySpeech(data)) {
      return NextResponse.json({
        error: 'I could not hear that clearly. Please hold the mic and speak a little closer, away from background noise.',
      }, { status: 422 });
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
