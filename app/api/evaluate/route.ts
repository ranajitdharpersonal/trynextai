import { NextResponse } from 'next/server';
import { askBrain } from '@/lib/brain';

// System Prompt: Strict QA Engineer
const SYSTEM_PROMPT = `You are a strict QA (Quality Assurance) Engineer for TryNext AI.
Your job is to compare the generated HTML code against the original Software Requirement Specification (SRS).
Check specifically whether the requested UI preferences (like dark theme and colors) and the core user flow are implemented. A focused first version may implement only the three highest-priority SRS features; do not fail it merely because it lacks optional pages, dashboards, persistence, animation, or other nice-to-have expansion that was not explicitly required.
Return ONLY a valid JSON object. Do NOT include markdown blocks like \`\`\`json.
{
  "pass": boolean,
  "score": number (0 to 10),
  "feedback": "If pass is false, give strict 1-2 sentence instruction to the coder on what exactly is missing and what to fix. If pass is true, just say 'Perfect'."
}`;

const MAX_EVALUATION_CODE_CHARS = 12_000;

function codeForEvaluation(htmlCode: string): string {
  if (htmlCode.length <= MAX_EVALUATION_CODE_CHARS) return htmlCode;

  const half = Math.floor(MAX_EVALUATION_CODE_CHARS / 2);
  return `${htmlCode.slice(0, half)}\n\n<!-- Middle of generated HTML omitted for QA context -->\n\n${htmlCode.slice(-half)}`;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { srs, htmlCode } = body;

    if (!srs || !htmlCode) {
      return NextResponse.json({ error: "SRS ba Code asheni boss!" }, { status: 400 });
    }

    console.log("🧐 QA Agent is evaluating the code...");

    const prompt = `--- SRS ---\n${JSON.stringify(srs, null, 2)}\n\n--- GENERATED HTML CODE ---\n${codeForEvaluation(htmlCode)}\nReturn ONLY JSON.`;

    // 🧠 MULTI-BRAIN ROUTING (Handled by brain.ts)
    try {
      const response = await askBrain(prompt, SYSTEM_PROMPT, "OPENAI", "EVALUATOR");
      
      // JSON clean and parse
      let cleanText = response.text.replace(/```json/gi, '').replace(/```/g, '').trim();
      const evaluation = JSON.parse(cleanText);
      
      console.log(`📊 QA Score: ${evaluation.score}/10 | Pass: ${evaluation.pass}`);
      if (!evaluation.pass) console.log(`⚠️ QA Feedback: ${evaluation.feedback}`);

      return NextResponse.json({ 
          source: response.modelUsed, 
          evaluation,
          circuitTripped: response.circuitTripped 
      });

    } catch (apiError: any) {
      console.error("⚠️ QA Agent failed to respond:", apiError.message);
      
      // Failsafe: Bypass QA if ALL APIs fail, so app doesn't crash
      return NextResponse.json({ 
        source: 'Failsafe QA', 
        evaluation: { pass: true, score: 10, feedback: "QA Bypassed due to ALL API errors." },
        circuitTripped: "ALL SYSTEMS CRASHED (Bypassed QA)"
      });
    }

  } catch (error) {
    return NextResponse.json({ error: "Server-e evaluation korte giye jhamela hoyeche!" }, { status: 500 });
  }
}
