import { NextResponse } from 'next/server';
import { askBrain } from '@/lib/brain';

const SYSTEM_PROMPT = `You are an elite UI/UX Website Cloner for 'TryNext AI'. 
Analyze the raw HTML structure of the provided target website and create a visually identical clone.
1. Replicate layout, navbars, footers, typography, and colors using Tailwind CSS via CDN.
2. DO NOT copy complex backend logic. Focus purely on frontend UI.
3. Make it a single-file responsive HTML output.
4. Replace missing images with beautiful placeholders.
5. Return ONLY raw HTML code without markdown blocks.`;

export async function POST(req: Request) {
  try {
    const { target, prompt } = await req.json();
    if (!target) return NextResponse.json({ error: "Target asheni boss!" }, { status: 400 });

    let urlToScrape = target;

    // Jodi target ta direct URL na hoy (e.g. "Apple website"), tahole SerpApi diye khujbo!
    if (!target.startsWith('http')) {
      console.log(`🔍 SerpApi searching for: ${target}`);
      if (!process.env.SERPAPI_API_KEY) throw new Error("SerpApi Key nei boss!");
      
      const serpRes = await fetch(`https://serpapi.com/search.json?q=${encodeURIComponent(target)}&api_key=${process.env.SERPAPI_API_KEY}`);
      const serpData = await serpRes.json();
      
      if (serpData.organic_results && serpData.organic_results.length > 0) {
        urlToScrape = serpData.organic_results[0].link;
        console.log(`🎯 Found URL to clone: ${urlToScrape}`);
      } else {
        throw new Error(`'${target}' er kono website khuje pelam na!`);
      }
    }

    console.log(`🕵️‍♂️ Thief Agent scraping: ${urlToScrape}`);
    
    const scrapeRes = await fetch(urlToScrape, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
    });
    if (!scrapeRes.ok) throw new Error("Website block kore rekheche ba down ache.");
    
    const rawHtml = await scrapeRes.text();
    const truncatedHtml = rawHtml.slice(0, 80000); 

    const clonePrompt = `User Prompt: ${prompt}\n\nTARGET WEBSITE RAW HTML:\n${truncatedHtml}`;
    
    console.log("🎨 Cloner Agent is drawing the replica...");
    
    // 🧠 MULTI-BRAIN ROUTING (Ebar Thief agent o kokhono fail korbe na!)
    try {
      const response = await askBrain(clonePrompt, SYSTEM_PROMPT);
      
      let htmlCode = response.text.replace(/```html/gi, '').replace(/```/g, '').trim();
      
      return NextResponse.json({ 
          source: response.modelUsed, 
          code: htmlCode,
          circuitTripped: response.circuitTripped 
      });

    } catch (brainError: any) {
      console.error("⚠️ Cloner Engine Failed:", brainError.message);
      return NextResponse.json({ error: "Thief Agent er theke onnyo model o clone korte parchhe na." }, { status: 500 });
    }

  } catch (error: any) {
    return NextResponse.json({ error: `Clone korte giye jhamela: ${error.message}` }, { status: 500 });
  }
}