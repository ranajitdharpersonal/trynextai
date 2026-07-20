import { NextResponse } from 'next/server';
import { askBrain } from '@/lib/brain';

const MAX_PREVIOUS_CODE_CHARS = 12_000;

const SYSTEM_PROMPT = `You are the Coder for TryNext AI. Generate one complete, working, single-file HTML app from the supplied SRS.

Build a focused first version, not a large product demo:
1. Implement the title and at most the three highest-priority requested features. Do not invent dashboards, pages, modules, or flows that the SRS does not require.
2. Use Tailwind CSS via CDN for a polished, responsive interface with one consistent visual style. Do not use images, carousels, or animations unless the SRS explicitly asks for them.
3. Build one screen by default. Do not create an SPA, multi-page navigation, or a complex settings system unless explicitly requested.
4. Add only essential Vanilla JavaScript interactions. Use localStorage only when the requested feature needs saved browser state.
5. Keep markup and JavaScript concise. The entire response must stay under 8,000 characters.
6. Return only raw HTML beginning with <!doctype html>; do not use markdown fences or explain your work.`;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { srs, previousCode, qaFeedback } = body;

    if (!srs) {
      return NextResponse.json({ error: 'SRS data asheni boss!' }, { status: 400 });
    }

    let prompt = `Here is the SRS to build:\n${JSON.stringify(srs, null, 2)}`;

    if (previousCode && qaFeedback) {
      console.log('Coder Agent is applying focused QA repairs for:', srs.title);
      const repairSource = previousCode.slice(0, MAX_PREVIOUS_CODE_CHARS);
      prompt += `\n\nQA feedback: "${qaFeedback}"\n\nPrevious HTML:\n${repairSource}\n\nReturn one compact corrected HTML file. Preserve working behavior and change only what is necessary to address the feedback.`;
    } else {
      console.log('Coder Agent building a compact app for:', srs.title);
    }

    try {
      const response = await askBrain(prompt, SYSTEM_PROMPT, 'OPENAI', 'CODER');
      const htmlCode = response.text.replace(/```html/gi, '').replace(/```/g, '').trim();

      // A completion cut off at its output limit often looks like usable HTML
      // until QA tries to repair it. Reject it here so a partial provider
      // response cannot trigger another full paid generation pass.
      if (!/^<!doctype html/i.test(htmlCode) || !/<\/html>\s*$/i.test(htmlCode)) {
        return NextResponse.json({
          error: 'The Coder response was incomplete, so it was not sent to QA or deployed. Please retry the compact request.',
          source: response.modelUsed,
          circuitTripped: response.circuitTripped,
          retryable: true,
        }, { status: 502 });
      }

      return NextResponse.json({
        source: response.modelUsed,
        code: htmlCode,
        circuitTripped: response.circuitTripped,
      });
    } catch (brainError: unknown) {
      const circuitTripped = brainError instanceof Error
        ? brainError.message
        : 'ALL SYSTEMS CRASHED';

      console.error('All code-generation providers failed:', circuitTripped);

      // Never return emergency-page HTML as generated code. Doing that caused
      // the browser to run QA and a second paid repair attempt against an
      // error page rather than stopping with a retryable failure.
      return NextResponse.json({
        error: 'No AI provider finished generating this app. Nothing was sent to QA or deployed; please retry once the providers are available.',
        source: 'All providers failed',
        circuitTripped,
        retryable: true,
      }, { status: 503 });
    }
  } catch (error) {
    console.error('Code-generation request failed:', error);
    return NextResponse.json({ error: 'Server-e code generate korte giye jhamela hoyeche!' }, { status: 500 });
  }
}
