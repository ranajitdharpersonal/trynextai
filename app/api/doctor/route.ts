import { NextResponse } from 'next/server';
import { askBrain } from '@/lib/brain';

// 🧠 Core Doctor Logic
async function runDoctor() {
  const TOKEN = process.env.GITHUB_TOKEN;
  const OWNER = process.env.GITHUB_USERNAME;
  const REPO = process.env.GITHUB_REPO;

  if (!TOKEN || !OWNER || !REPO) {
    throw new Error("GitHub credentials missing boss!");
  }

  console.log("🩺 Doctor AI is connecting to GitHub...");

  // 1. Direct GitHub theke live code fetch kora (🚨 FIX: Removed 'src/' from path)
  const fileRes = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/contents/app/page.tsx`, {
    headers: { Authorization: `Bearer ${TOKEN}`, 'Accept': 'application/vnd.github.v3+json' },
    cache: 'no-store' // 🚀 Ensure we always get the fresh code!
  });
  
  const fileData = await fileRes.json();
  if (!fileData.content) throw new Error("GitHub theke file pawa jayni!");

  const codeContent = Buffer.from(fileData.content, 'base64').toString('utf8');

  // 2. Doctor AI (Multi-Brain) Code Analysis
  console.log("🧠 Doctor AI is analyzing the code...");
  
  const SYSTEM_PROMPT = `You are a strict QA Doctor for TryNext AI.
  The provided Next.js code is already highly optimized, enterprise-grade, and fully functional.
  DO NOT attempt to refactor, format, or optimize the codebase.
  Unless there is a FATAL syntax error that completely breaks the app, you MUST reply EXACTLY with the word "PERFECT".
  Do not output any code. Just say "PERFECT".`;


  // 🧠 MULTI-BRAIN MASTER ENGINE CALL
  const response = await askBrain(codeContent, SYSTEM_PROMPT);
  let newCode = response.text.trim();
  
  // Markdown clean kora
  newCode = newCode.replace(/```tsx/gi, '').replace(/```html/gi, '').replace(/```/g, '').trim();

  // Jodi code already perfect thake
  if (newCode === "PERFECT" || newCode === codeContent) {
    console.log("✅ Code is healthy!");
    return { 
        status: "healthy", 
        message: "Code is perfect! No PR needed.",
        circuitTripped: response.circuitTripped 
    };
  }

  console.log("⚠️ Doctor found issues! Creating PR on GitHub...");

  // 3. The Magic: Auto Pull Request (PR) Toiri Kora
  const branchName = `doctor-fix-${Date.now()}`;

  const refRes = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/git/refs/heads/main`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
    cache: 'no-store'
  });
  const refData = await refRes.json();
  const baseSha = refData.object.sha;

  await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/git/refs`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ ref: `refs/heads/${branchName}`, sha: baseSha })
  });

  // 🚨 FIX: Removed 'src/' from path in PUT request too!
  await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/contents/app/page.tsx`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: "🩺 TryNext AI Doctor: Automated Code Fixes & Optimization",
      content: Buffer.from(newCode).toString('base64'),
      sha: fileData.sha,
      branch: branchName
    })
  });

  const prRes = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/pulls`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: "🩺 [Auto-Repair] TryNext AI Routine Checkup Fixes",
      body: `### 🚨 AI Diagnostic Report\nI am TryNext AI's Personal Doctor. I have scanned the codebase, identified potential bugs/optimizations, and written the patch. \n\n**Engine Used:** ${response.modelUsed}\n\n**Please review and merge this PR.**`,
      head: branchName,
      base: "main"
    })
  });
  
  const prData = await prRes.json();
  return { 
      status: "fixed", 
      message: "Issues found and PR created!", 
      prUrl: prData.html_url,
      circuitTripped: response.circuitTripped 
  };
}

export async function GET() {
  try {
    const result = await runDoctor();
    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST() {
  try {
    const result = await runDoctor();
    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}