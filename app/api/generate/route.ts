import { NextResponse } from 'next/server';
import { askBrain } from '@/lib/brain';

const SYSTEM_PROMPT = `You are the Master Coder & Senior Frontend Engineer for 'TryNext AI'. 
Your job is to take a Software Requirement Specification (SRS) in JSON format and generate a visually stunning, premium, fully working single-file HTML web app.

ULTIMATE RULES (CRITICAL FOR HACKATHON WIN):
1. 🎨 THE ASSET CREATOR: NEVER use empty placeholders for images. ALWAYS use high-quality dynamic image URLs (e.g., 'https://picsum.photos/seed/{random_word}/1200/800') relevant to the context. Include modern icons via CDN (like FontAwesome or Phosphor Icons).
2. 🗄️ THE DATA WIZARD: The app MUST be fully functional. You MUST write Vanilla JavaScript inside <script> tags to save, retrieve, and manage data using browser 'localStorage'. Forms, to-do lists, and interactive elements must actually work and persist state.
3. 🌐 THE WEB-WEAVER: If the SRS implies multiple pages (e.g., Home, About, Contact), build a Single Page Application (SPA). Use different <section> tags and JavaScript navigation logic to hide/show pages dynamically without reloading.
4. 💎 PREMIUM UI/UX & THEMING: Use Tailwind CSS via CDN. The UI MUST look like a premium, 2026 SaaS application. Match the 'ui_preferences' EXACTLY. If it's a dark theme, use rich dark backgrounds (e.g., bg-gray-900) and dark components. Use Glassmorphism heavily (e.g., bg-white/10 backdrop-blur-lg border border-white/20 shadow-xl).
5. ✨ MICRO-INTERACTIONS: All buttons must have smooth hover effects (transition-all duration-300 hover:scale-105), modern rounded corners (rounded-xl or rounded-full). Inputs/Textareas must have soft focus rings (focus:ring-2) and generous padding. Modern sans-serif typography is a must.
6. FORMAT: Return ONLY the raw HTML code. Do NOT wrap it in markdown formatting (like \`\`\`html). Just the code.
7. 🚫 ANTI-OVERKILL RULE: NEVER create automatic image sliders, carousels, or changing backgrounds UNLESS the user explicitly asks for a "slider" or "carousel". For hero backgrounds, use EXACTLY ONE highly relevant, stunning, static image. Understand the nuance of regional languages: if the user asks for a "real estate background", fetch ONE beautiful, high-quality image of a modern house or mansion, NEVER generic empty landscapes or roads. Keep it simple, focused, and premium.`;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { srs, previousCode, qaFeedback } = body;

    if (!srs) {
      return NextResponse.json({ error: "SRS data asheni boss!" }, { status: 400 });
    }

    let prompt = `Here is the SRS to build:\n${JSON.stringify(srs, null, 2)}`;
    
    // 🚨 SELF-HEALING TRIGGER
    if (previousCode && qaFeedback) {
      console.log("🛠️ Coder Agent is fixing the code based on QA Feedback!");
      prompt += `\n\n🚨 [URGENT QA FEEDBACK]: Your previous code failed the Quality Assurance check.
      Feedback from QA: "${qaFeedback}"
      
      Here is your PREVIOUS BROKEN CODE:
      ${previousCode}
      
      Please FIX the code strictly following the QA feedback and the SRS. Return the complete updated HTML.`;
    } else {
      console.log("🛠️ Coder Agent building app for:", srs.title);
    }

    // 🧠 MULTI-BRAIN ROUTING (Handled by brain.ts)
    try {
      const response = await askBrain(prompt, SYSTEM_PROMPT);
      
      let htmlCode = response.text.replace(/```html/gi, '').replace(/```/g, '').trim();
      
      return NextResponse.json({ 
        source: response.modelUsed, 
        code: htmlCode,
        circuitTripped: response.circuitTripped 
      });

    } catch (brainError: any) {
      console.error("⚠️ All Brains Failed:", brainError.message);
      
      // Failsafe HTML
      const fallbackHTML = `
        <!DOCTYPE html><html><head><title>Emergency App</title><script src="https://cdn.tailwindcss.com"></script></head>
        <body class="bg-gray-900 text-white flex items-center justify-center min-h-screen">
            <div class="text-center"><h1 class="text-3xl font-bold text-red-500 mb-4">🚨 Servers Overloaded</h1><p>AI Engine ekhon down ache. Ektu por abar try korun.</p></div>
        </body></html>
      `;
      return NextResponse.json({ 
          source: 'Static Failsafe', 
          code: fallbackHTML,
          circuitTripped: "ALL SYSTEMS CRASHED" 
      });
    }

  } catch (error) {
    return NextResponse.json({ error: "Server-e code generate korte giye jhamela hoyeche!" }, { status: 500 });
  }
}