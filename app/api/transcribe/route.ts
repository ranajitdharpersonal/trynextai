import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const audioFile = formData.get('file') as Blob;

    if (!audioFile) {
      return NextResponse.json({ error: "Kono audio asheni boss!" }, { status: 400 });
    }

    console.log("🎙️ Sending audio to Groq Whisper AI...");

    // Groq API expect kore ekta proper form-data
    const groqData = new FormData();
    groqData.append('file', audioFile, 'voice.webm');
    groqData.append('model', 'whisper-large-v3');
    
    // 🚀 THE FIX: Temperature 0 korle AI hallucinate korbe na (100% strict thakbe)
    groqData.append('temperature', '0.0'); 
    
    // 🚀 THE FIX 2: Expanded Universal Tech & "Next Billion Users" Vocabulary
    // Ete judges-ra jekono real-world use case try korle Whisper easily catch korbe.
    groqData.append('prompt', 'Website, application, UI, layout, dark theme, light theme, button, dashboard, color, background, create, modify, startup, art and craft, e-commerce, shop, store, portfolio, blog, clinic, hospital, school, education, restaurant, food menu, shopping cart, pricing table, navbar, footer, hero section, real estate, booking, gym.');
    
    // Note: 'language' parameter ta amra add korlam na jate Auto-Detect bondho na hoy!

    const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
      },
      body: groqData
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error?.message || "Transcription failed");
    }

    console.log("✅ Whisper Output:", data.text);
    return NextResponse.json({ text: data.text });

  } catch (error: any) {
    console.error("Audio processing crashed:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}