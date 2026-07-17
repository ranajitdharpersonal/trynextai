import { NextResponse } from 'next/server';
import { askBrain } from '@/lib/brain';

// System Prompt: Ekdom strict instruction (JSON output er jonno)
const SYSTEM_PROMPT = `You are an expert Software Architect for 'TryNext AI'. 
Your job is to translate user's raw, regional language (Bengali/Hindi/English) voice intent into a clean, structured English Software Requirement Specification (SRS).
Extract the core functionality, UI components mentioned, and the main goal.
Return ONLY a valid JSON object with the following structure. Do NOT include markdown blocks like \`\`\`json.
{
  "title": "Short App Name",
  "description": "1 sentence description of the app",
  "features": ["feature 1", "feature 2"],
  "ui_preferences": ["ui detail 1"]
}`;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { transcript } = body;

    if (!transcript) {
      return NextResponse.json({ error: "Kono text asheni boss!" }, { status: 400 });
    }

    console.log("🚀 Incoming Intent:", transcript);

    const prompt = `User Intent: "${transcript}"\nReturn ONLY JSON.`;

    // 🧠 MULTI-BRAIN ROUTING (Handled by brain.ts)
    const response = await askBrain(prompt, SYSTEM_PROMPT);
    
    // Clean JSON formatting
    let rawText = response.text.replace(/```json/gi, '').replace(/```/g, '').trim();
    const srsResult = JSON.parse(rawText);

    return NextResponse.json({ 
        source: response.modelUsed, 
        srs: srsResult,
        circuitTripped: response.circuitTripped 
    });

  } catch (error) {
    console.log("🛑 ALL AI BRAINS FAILED! Using Static Failsafe...");
    const mockSRS = {
      title: "Emergency Basic App",
      description: "Generated statically because all AI models failed.",
      features: ["Basic Input Form", "Data List"],
      ui_preferences: ["Standard clean layout"]
    };
    return NextResponse.json({ 
        source: 'Static-Failsafe', 
        srs: mockSRS,
        circuitTripped: "ALL SYSTEMS CRASHED"
    });
  }
}