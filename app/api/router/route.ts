import { NextResponse } from 'next/server';
import { askBrain } from '@/lib/brain';

const SYSTEM_PROMPT = `Analyze this user voice command for 'TryNext AI'.
Task 1: Detect the language of the user's command. Provide the standard BCP-47 language code (e.g., "bn-IN" for Bengali, "es-ES" for Spanish, "hi-IN" for Hindi, "en-US" for English).
Task 2: Translate this exact success message into the DETECTED LANGUAGE: 
"Your project is ready! Do you want to make any modifications or publish it?"
Task 3: Categorize the intent into EXACTLY ONE of these actions:
1. "CLONE": User explicitly wants to copy, clone, or mimic a famous website.
2. "MODIFY": User wants to change, update, or fix the CURRENT app. (ONLY valid if hasExistingCode is true).
3. "CREATE": User wants to build a new app/website from scratch.

Return ONLY a JSON object in this format:
{
  "action": "CLONE" | "MODIFY" | "CREATE",
  "target": "Name of the website to clone (ONLY if action is CLONE, otherwise null)",
  "languageCode": "BCP-47 code",
  "successMessage": "The translated success message"
}`;

export async function POST(req: Request) {
  try {
    const { transcript, hasExistingCode } = await req.json();
    
    const prompt = `User Command: "${transcript}"\nDoes the user currently have a project open in the editor? ${hasExistingCode}`;

    // 🧠 BRAIN ENGINE CALL
    const response = await askBrain(prompt, SYSTEM_PROMPT);
    
    // JSON parse korar aage Markdown clean korchi (Jodi Qwen ba Llama boka-r moto ```json bosiye dey)
    let cleanText = response.text.replace(/```json/gi, '').replace(/```/g, '').trim();
    const decision = JSON.parse(cleanText);
    
    console.log("🚦 Manager Agent routed to:", decision.action, "| Language Detected:", decision.languageCode);
    
    // UI-te circuit tripped status pathano hocche
    return NextResponse.json({
        ...decision,
        source: response.modelUsed,
        circuitTripped: response.circuitTripped
    });

  } catch (error) {
    console.error("⚠️ Router Failed, Using Failsafe:", error);
    // Failsafe routing
    return NextResponse.json({ 
      action: "CREATE", 
      target: null, 
      languageCode: "en-US", 
      successMessage: "Your project is ready! Do you want to modify or publish?",
      source: "Static Failsafe",
      circuitTripped: "ALL SYSTEMS CRASHED"
    });
  }
}