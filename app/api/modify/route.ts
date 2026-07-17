import { NextResponse } from 'next/server';
import { askBrain } from '@/lib/brain';

// System Prompt: The Sculptor / Modifier Agent
const SYSTEM_PROMPT = `You are an Expert Frontend React & Tailwind CSS Sculptor for 'TryNext AI'.
Your job is to take an EXISTING HTML code and a USER INSTRUCTION for modification, and apply those exact changes.

STRICT RULES:
1. Do NOT rewrite the entire app from scratch unless requested. Keep the existing structure, logic, and layout intact.
2. Only modify the specific parts requested by the user (e.g., change button color to red, make background dark, add a new text field).
3. Ensure all existing Vanilla JavaScript <script> tags and functionality remain perfectly working.
4. Continue using Tailwind CSS via CDN and Glassmorphism design principles.
5. Return ONLY the complete, raw, modified HTML code. Do NOT wrap it in markdown formatting (like \`\`\`html). Just the code.`;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { existingCode, prompt } = body;

    if (!existingCode || !prompt) {
      return NextResponse.json({ error: "Existing code ba prompt asheni boss!" }, { status: 400 });
    }

    console.log("🎨 Modifier Agent is sculpting the code...");
    const userInstruction = `=== USER INSTRUCTION ===\n${prompt}\n\n=== EXISTING HTML CODE ===\n${existingCode}`;

    // 🧠 MULTI-BRAIN ROUTING (The Master Engine)
    try {
      const response = await askBrain(userInstruction, SYSTEM_PROMPT);
      
      // Clean markdown tags
      let htmlCode = response.text.replace(/```html/gi, '').replace(/```/g, '').trim();
      
      return NextResponse.json({ 
          source: response.modelUsed, 
          code: htmlCode,
          circuitTripped: response.circuitTripped 
      });

    } catch (brainError: any) {
      console.error("⚠️ Modifier Engine Failed:", brainError.message);
      return NextResponse.json({ error: "Sculptor Agent down ache boss! All Brains crashed." }, { status: 500 });
    }

  } catch (error) {
    return NextResponse.json({ error: "Server-e code modify korte giye jhamela hoyeche!" }, { status: 500 });
  }
}