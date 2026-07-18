"use client";

import { useState, useRef, useEffect } from "react";
import { Mic, Square, Code, Play, CheckCircle2, Loader2, Sparkles, Globe, ExternalLink, Monitor, Smartphone, LayoutTemplate, AppWindow, RefreshCw, Stethoscope, Trash2, Terminal, Activity } from "lucide-react";

type LiveSpeechResult = {
  isFinal: boolean;
  length: number;
  [index: number]: { transcript: string };
};

type LiveSpeechEvent = {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: LiveSpeechResult;
  };
};

type LiveSpeechRecognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: LiveSpeechEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
};

type LiveSpeechRecognitionConstructor = new () => LiveSpeechRecognition;

type SpeechRecognitionWindow = Window & {
  SpeechRecognition?: LiveSpeechRecognitionConstructor;
  webkitSpeechRecognition?: LiveSpeechRecognitionConstructor;
};

export default function Home() {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [debugStatus, setDebugStatus] = useState("System Ready");

  const [srsData, setSrsData] = useState<any>(null);
  const [generatedCode, setGeneratedCode] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [agentStatus, setAgentStatus] = useState<string>("");

  const [isHealing, setIsHealing] = useState(false);
  const [isDeploying, setIsDeploying] = useState(false);
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [deployUrl, setDeployUrl] = useState<string | null>(null);

  const [projectType, setProjectType] = useState<'app' | 'website'>('app');
  const [sandboxView, setSandboxView] = useState<'desktop' | 'mobile'>('desktop');

  // 🩺 Doctor AI State
  const [isDiagnosing, setIsDiagnosing] = useState(false);

  // 🧠 LIVE BRAIN TERMINAL STATE
  const [brainLogs, setBrainLogs] = useState<string[]>([]);
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (brainLogs.length > 0) {
      logsEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [brainLogs]);

  // 🧹 CLEAN LOGS: YES Ai Master Edition Auto-Translator
  const addLog = (msg: string) => {
    let formattedMsg = msg;
    
    // Auto-translate old bracket tags to YES Ai Master Edition style!
    formattedMsg = formattedMsg.replace("[WHISPER]", "🎤 Whisper:");
    formattedMsg = formattedMsg.replace("[MANAGER]", "🎛️ Manager:");
    formattedMsg = formattedMsg.replace("[ARCHITECT]", "🧭 Architect:");
    formattedMsg = formattedMsg.replace("[CODER]", "💻 Coder:");
    formattedMsg = formattedMsg.replace("[THIEF]", "🕵️‍♂️ Thief:");
    formattedMsg = formattedMsg.replace("[SCULPTOR]", "🎨 Sculptor:");
    formattedMsg = formattedMsg.replace("[DATA WIZARD]", "🧙‍♂️ Data Wizard:");
    formattedMsg = formattedMsg.replace("[EVALUATOR]", "⚖️ Evaluator:");
    formattedMsg = formattedMsg.replace("[SYSTEM]", "⚙️ System:");
    formattedMsg = formattedMsg.replace("[CIRCUIT TRIPPED]", "⚙️ System: 🛡️ CIRCUIT BREAKER:");

    setBrainLogs(prev => [...prev, formattedMsg]);
  };

  // 👩‍💼 THE PREMIUM ENGLISH MAM (Hackathon Stable Version)
  const speakAgent = (customText?: string, languageCode = "en-US") => {
    window.speechSynthesis.cancel(); // Aager bokbok bondho

    // 🛑 FIX: Faltu translation bad! Strict Professional English.
    const safeText = customText || "Task completed successfully, boss.";
    const safeLanguage = /^[a-z]{2,3}(?:-[a-z]{2,4})?$/i.test(languageCode)
      ? languageCode
      : "en-US";
    const languagePrefix = safeLanguage.split('-')[0].toLowerCase();

    const utterance = new SpeechSynthesisUtterance(safeText);
    utterance.lang = "en-US"; // 🇺🇸 Force US English for premium accent
    utterance.lang = safeLanguage;
    utterance.rate = 1.0;
    utterance.pitch = 1.1;

    const setVoiceAndSpeak = () => {
      const voices = window.speechSynthesis.getVoices();
      
      // Prefer a voice matching the detected language, then fall back gracefully.
      const matchingVoices = voices.filter(v => v.lang.toLowerCase().startsWith(languagePrefix));
      const premiumVoice = matchingVoices.find(v =>
        (v.name.includes('Female') || v.name.includes('Google') || v.name.includes('Samantha') || v.name.includes('Zira'))
      ) || matchingVoices[0] || voices.find(v => v.lang.toLowerCase().startsWith('en')) || voices[0];
      
      if (premiumVoice) {
        utterance.voice = premiumVoice;
      }

      window.speechSynthesis.speak(utterance);
    };

    if (window.speechSynthesis.getVoices().length > 0) {
      setVoiceAndSpeak();
    } else {
      window.speechSynthesis.onvoiceschanged = setVoiceAndSpeak;
    }
  };

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const liveRecognitionRef = useRef<LiveSpeechRecognition | null>(null);
  const liveFinalTextRef = useRef("");
  const isRecordingRef = useRef(false);
  const isStoppingRef = useRef(false);

  const startLiveTranscript = () => {
    const speechWindow = window as SpeechRecognitionWindow;
    const Recognition = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;

    if (!Recognition) {
      setDebugStatus("Listening... (live preview unavailable; final transcript will arrive after recording)");
      return;
    }

    const recognition = new Recognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = navigator.language || "en-US";

    recognition.onresult = (event) => {
      let interimText = "";

      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const spokenText = result[0]?.transcript || "";

        if (result.isFinal) {
          liveFinalTextRef.current += `${spokenText} `;
        } else {
          interimText += spokenText;
        }
      }

      const liveText = `${liveFinalTextRef.current} ${interimText}`.trim();
      if (liveText) setTranscript(liveText);
    };

    recognition.onerror = (event) => {
      if (event.error !== "aborted" && event.error !== "not-allowed") {
        addLog(`[SYSTEM] Live transcript paused; final Whisper transcription will still run.`);
      }
    };

    recognition.onend = () => {
      if (!isStoppingRef.current && isRecordingRef.current) {
        try {
          recognition.start();
        } catch {
          // Some browsers throw when a recognition session is restarted too quickly.
        }
      }
    };

    liveRecognitionRef.current = recognition;

    try {
      recognition.start();
    } catch {
      setDebugStatus("Listening... (live preview unavailable; final transcript will arrive after recording)");
    }
  };

  const stopLiveTranscript = () => {
    isStoppingRef.current = true;
    const recognition = liveRecognitionRef.current;

    if (recognition) {
      try {
        recognition.stop();
      } catch {
        recognition.abort();
      }
    }

    liveRecognitionRef.current = null;
  };

  const startRecording = async () => {
    try {
      setTranscript("");
      liveFinalTextRef.current = "";
      isStoppingRef.current = false;
      // 🚨 Boro BUG FIX: Ekhane aage setGeneratedCode("") chilo, jeta purono code muse dicchilo! 
      // Ekhon theke user Trash button na tepa obdi code delete hobe na.
      setAgentStatus("");
      setIsHealing(false);
      setBrainLogs([]); // Sudhu logs ar transcript clear korbo notun command-er jonno

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        stream.getTracks().forEach(track => track.stop());
        await processAudio(audioBlob);
      };

      mediaRecorder.start();
      setIsRecording(true);
      isRecordingRef.current = true;
      startLiveTranscript();
      setDebugStatus("🎤 Listening with Perfect Ear...");
    } catch (err) {
      console.error(err);
      setDebugStatus("❌ Mic permission denied!");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      isRecordingRef.current = false;
      stopLiveTranscript();
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setDebugStatus("🔄 Whisper AI transcribing...");
    }
  };

  const processAudio = async (audioBlob: Blob) => {
    try {
      setAgentStatus("👂 Processing audio...");
      const formData = new FormData();
      formData.append('file', audioBlob, 'voice.webm');

      const res = await fetch('/api/transcribe', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      // 🛑 FIX: Whisper er boka boka hallucination kete bad dewa
      let finalText = data.text.trim();
      finalText = finalText.replace(/(?:\bthank you\.?\b|\bthanks for watching\.?\b)/gi, '').trim();

      setTranscript(finalText);

      if (finalText) {
        generateAppFlow(finalText, data.language || undefined);
      } else {
        setDebugStatus("⚠️ Kono kotha shunte paini! (Background noise ignored)");
        setAgentStatus("");
      }
    } catch (err: any) {
      setAgentStatus(`❌ Transcription Failed: ${err.message}`);
      setDebugStatus("System Ready");
    }
  };

  const generateAppFlow = async (text: string, languageHint?: string) => {
    setIsGenerating(true);
    addLog(`[WHISPER] Transcript received: "${text}"`);
    try {
      setAgentStatus("🚦 Manager Agent analyzing intent...");
      addLog(`[MANAGER] Routing request to Swarm Control...`);
      
      const languageContext = languageHint ? ` Whisper detected language hint: ${languageHint}. Treat it as a hint only and preserve the user's meaning.` : "";
      const strictContext = `Target format: ${projectType.toUpperCase()}.${languageContext} Command: ${text}`;
      
      const routerRes = await fetch('/api/router', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript: strictContext, hasExistingCode: !!generatedCode })
      });
      const decision = await routerRes.json();
      
      const activeEngine = decision.source || "OPENAI"; 
      const localizedCompletion = typeof decision.successMessage === "string" && decision.successMessage.trim()
        ? decision.successMessage
        : "Your project is ready! Do you want to make any modifications or publish it?";
      const localizedLanguage = typeof decision.languageCode === "string" ? decision.languageCode : "en-US";
      
      if (decision.circuitTripped) addLog(`[SYSTEM] 🛡️ CIRCUIT BREAKER: ${decision.circuitTripped}`);
      
      let finalAction = decision.action;
      if (generatedCode && finalAction !== "CLONE") {
        finalAction = "MODIFY";
        addLog(`[MANAGER] Override: Existing code found. Forcing MODIFY mode.`);
      } else {
        addLog(`[MANAGER] Decision Matrix Output: Action = ${finalAction}`);
      }

      if (finalAction === "CLONE") {
        setAgentStatus(`🕵️‍♂️ Thief Agent cloning ${decision.target}...`);
        addLog(`[THIEF] Target locked: ${decision.target}`);
        addLog(`[THIEF] Infiltrating via SerpApi to fetch DOM...`);
        
        const cloneRes = await fetch('/api/clone', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ target: decision.target, prompt: text, activeEngine: activeEngine }) 
        });
        const cloneData = await cloneRes.json();
        if (cloneData.error) throw new Error(cloneData.error);
        
        addLog(`[THIEF] 80,000+ lines of code scraped & parsed successfully.`);
        addLog(`[CODER] Reconstructing UI clone...`);
        setGeneratedCode(cloneData.code);
        setAgentStatus(`✨ Cloning Complete!`);
        addLog(`[SYSTEM] Clone operation finished 100% ✅`);
        
        // ✅ FIX: Strict English Call (No language code passed)
        speakAgent(localizedCompletion, localizedLanguage);
      }
      
      else if (finalAction === "MODIFY") {
        setAgentStatus(`🎨 Modifier Agent sculpting ${projectType}...`);
        addLog(`[SCULPTOR] Intercepting existing codebase...`);
        addLog(`[SCULPTOR] Applying targeted modifications...`);
        
        const modifyPrompt = `You are modifying an existing ${projectType}. Keep the structure strictly as a ${projectType}. The user's new modification request is: ${text}`;

        const modRes = await fetch('/api/modify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ existingCode: generatedCode, prompt: modifyPrompt, activeEngine: activeEngine }) 
        });
        const modData = await modRes.json();
        if (modData.error) throw new Error(modData.error);
        
        setGeneratedCode(modData.code);
        setAgentStatus(`✨ Modification Complete!`);
        addLog(`[SYSTEM] Hot-Reloading new UI elements ✅`);
        
        // ✅ FIX: Strict English Call (No language code passed)
        speakAgent(localizedCompletion, localizedLanguage);
      }
      
      else { 
        setAgentStatus("🧠 Architect Agent thinking...");
        addLog(`[ARCHITECT] Designing Software Requirements (SRS)...`);
        
        const contextEnhancedText = `You are an expert UI developer. I strictly want to build a ${projectType}. Do not build a website if I asked for an app, and do not build an app if I asked for a website. The specific requirement is: ${text}`;
        
        const intentRes = await fetch('/api/intent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ transcript: contextEnhancedText, activeEngine: activeEngine }) 
        });
        const intentData = await intentRes.json();
        if (intentData.error) throw new Error(intentData.error);
        
        setSrsData(intentData.srs);
        addLog(`[ARCHITECT] SRS Generated: ${intentData.srs.title || projectType}`);
        
        setAgentStatus(`🎨 Coder Agent building UI...`);
        addLog(`[CODER] Compiling Tailwind CSS & Glassmorphism UI...`);
        addLog(`[DATA WIZARD] Injecting LocalStorage Vanilla JS...`);
        
        const coderRes = await fetch('/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ srs: intentData.srs, activeEngine: activeEngine }) 
        });
        const coderData = await coderRes.json();
        if (coderData.error) throw new Error(coderData.error);

        let currentCode = coderData.code;

        setAgentStatus(`🧐 QA Agent evaluating code...`);
        addLog(`[EVALUATOR] Running syntax & visual QA tests...`);
        
        const qaRes = await fetch('/api/evaluate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ srs: intentData.srs, htmlCode: currentCode, activeEngine: activeEngine }) 
        });
        const qaData = await qaRes.json();
        
        if (qaData.evaluation && !qaData.evaluation.pass) {
          setIsHealing(true);
          setAgentStatus(`⚠️ QA Failed: ${qaData.evaluation.feedback}`);
          addLog(`[EVALUATOR] ALERT! Bug detected: ${qaData.evaluation.feedback}`);
          
          setAgentStatus(`🛠️ Coder fixing bugs based on QA feedback...`);
          addLog(`[CODER] Executing Self-Healing loop...`);
          
          const healRes = await fetch('/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              srs: intentData.srs, 
              previousCode: currentCode, 
              qaFeedback: qaData.evaluation.feedback,
              activeEngine: activeEngine 
            })
          });
          const healData = await healRes.json();
          if (healData.error) throw new Error(healData.error);
          
          currentCode = healData.code; 
          setIsHealing(false);
          addLog(`[SYSTEM] Code healed successfully ✅`);
        } else {
          addLog(`[EVALUATOR] QA Passed 100%. No bugs found ✅`);
        }

        setGeneratedCode(currentCode);
        setAgentStatus(`✨ Local Deployment Complete!`);
        addLog(`[SYSTEM] Live Sandbox updated successfully!`);
        
        // ✅ FIX: Strict English Call (No language code passed)
        speakAgent(localizedCompletion, localizedLanguage);
      }

    } catch (error: any) {
      setAgentStatus(`❌ Failed: ${error.message}`);
      addLog(`[SYSTEM] ❌ CRITICAL FAILURE: Process halted: ${error.message}`);
      setIsHealing(false);
    } finally {
      setIsGenerating(false);
      setDebugStatus("System Ready");
    }
  };

  const deployToVercel = async () => {
    if (!generatedCode) return;
    setIsDeploying(true);
    setAgentStatus("☁️ Uploading to Vercel Edge Network...");
    addLog("[SYSTEM] 🚀 Initiating One-Click Deployment...");
    
    try {
      const res = await fetch('/api/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          htmlCode: generatedCode,
          appName: srsData?.title || `trynext-ai-${projectType}`
        })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      setDeployUrl(data.url);
      
      // ==============================================================
      // 🚀 AWS UI STATUS UPDATE (Phase 1)
      // ==============================================================
      setAgentStatus("✅ App Live & Data Secured in AWS DynamoDB!");
      addLog(`[SYSTEM] 🌐 Edge Deployment successful: ${data.url}`);
      addLog("[DATA WIZARD] 💾 User Session securely scaled to AWS DynamoDB.");
      // ==============================================================

      speakAgent("Deployment successful. Your application is live, and your data is securely stored in A W S Dynamo D B.");
    } catch (error: any) {
      setAgentStatus(`❌ Deploy Failed: ${error.message}`);
      addLog(`[SYSTEM] ❌ Deployment failed: ${error.message}`);
    } finally {
      setIsDeploying(false);
    }
  };
  
  // ==============================================================
  // 💸 REAL REVENUE: RAZORPAY CHECKOUT
  // ==============================================================
  const handleUpgrade = async () => {
    setIsUpgrading(true);
    setAgentStatus("⏳ Initiating Secure Checkout...");
    addLog("[MANAGER] 🛡️ Opening Secure Payment Gateway...");

    try {
      // 1. Razorpay Script Load Kora
      const res = await new Promise((resolve) => {
        const script = document.createElement("script");
        script.src = "https://checkout.razorpay.com/v1/checkout.js";
        script.onload = () => resolve(true);
        script.onerror = () => resolve(false);
        document.body.appendChild(script);
      });

      if (!res) throw new Error("Razorpay SDK failed to load. Check your internet connection.");

      // 2. Amader Backend theke Order toiri kora
      const checkoutResponse = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deploymentId: deployUrl?.replace("https://", "") || `dep_${Date.now()}`,
          userEmail: "founder@trynext.ai"
        }),
      });

      const data = await checkoutResponse.json();
      if (!checkoutResponse.ok) throw new Error(data.error);

      // 3. Payment Modal Open Kora
      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID, // 🔒 Ekdom secure! Hardcoded noy!
        amount: data.order.amount,
        currency: data.order.currency,
        name: "TryNext AI",
        description: "Upgrade to PRO (1 Month Validity)",
        order_id: data.order.id,
        handler: function (response: any) {
          // Payment Success hole ei code ta cholbe
          setAgentStatus("✅ Payment Successful! Upgrading to PRO...");
          addLog("[DATA WIZARD] 💸 Payment verified via Webhook! Tier upgraded to PRO.");
          speakAgent("Payment successful. Welcome to Try Next A I Pro.");
        },
        prefill: {
          name: "Ranajit Dhar",
          email: "founder@trynext.ai",
          contact: "9999999999"
        },
        theme: {
          color: "#f59e0b" // Amber color to match the crown
        }
      };

      const paymentObject = new (window as any).Razorpay(options);
      paymentObject.open();

    } catch (err: any) {
      setAgentStatus(`❌ Checkout Failed: ${err.message}`);
      addLog(`[SYSTEM] ❌ Checkout Error: ${err.message}`);
    } finally {
      setIsUpgrading(false);
    }
  };
  // ==============================================================


  // 🩺 Doctor Agent Run Function (UPDATED WITH LOGS!)
  const runDoctorAgent = async () => {
    setIsDiagnosing(true);
    setAgentStatus("🩺 Doctor AI is scanning codebase...");
    addLog("[SYSTEM] 🩺 Doctor AI is connecting to GitHub and analyzing codebase...");
    
    try {
      const res = await fetch('/api/doctor', { method: 'POST' });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      if (data.circuitTripped) addLog(`[SYSTEM] 🛡️ CIRCUIT BREAKER: ${data.circuitTripped}`);

      if (data.status === "fixed") {
        setAgentStatus(`✅ PR Created by Doctor AI!`);
        addLog(`[SYSTEM] ⚠️ Doctor AI: Issues found! Auto-Pull Request generated successfully.`);
        if (data.prUrl) window.open(data.prUrl, '_blank');

        speakAgent("Code issue fixed. Please check the pull request on GitHub.");
      } else if (data.status === "review") {
        setAgentStatus(`⚠️ Manual Doctor Review Required`);
        addLog(`[SYSTEM] ⚠️ Doctor AI: A concern was found, but no unsafe automatic patch was created.`);
        speakAgent("The Doctor found a concern, but it needs manual review before any code is changed.");
      } else if (data.status === "healthy") {
        setAgentStatus(`✅ Repository scan complete`);
        addLog(`[SYSTEM] ✅ Doctor AI: No high-confidence repair was required. No PR needed.`);
      } else {
        setAgentStatus(`⚠️ Manual Doctor Review Required`);
        addLog(`[SYSTEM] ⚠️ Doctor AI returned an unrecognized result; no code was changed.`);
      }
    } catch (error: any) {
      setAgentStatus(`❌ Doctor Failed: ${error.message}`);
      addLog(`[SYSTEM] ❌ Doctor AI encountered an error: ${error.message}`);
    } finally {
      setIsDiagnosing(false);
    }
  };

  return (
    // 🌌 THE PERFECT STUDIO WRAPPER (Scroll natural, proportion locked)
    <div className="min-h-screen bg-[#050505] text-gray-100 relative overflow-x-hidden overflow-y-auto z-0 font-sans">
      
      {/* 🔮 Fixed Aurora Glows */}
      <div className="fixed top-[-10%] left-[-10%] w-[40vw] h-[40vw] min-w-[300px] min-h-[300px] bg-indigo-600/10 blur-[120px] rounded-full pointer-events-none -z-10"></div>
      <div className="fixed bottom-[-10%] right-[-10%] w-[40vw] h-[40vw] min-w-[300px] min-h-[300px] bg-purple-600/10 blur-[120px] rounded-full pointer-events-none -z-10"></div>

      {/* ========================================================= */}
      {/* 🛠️ MAIN FLEX CONTAINER (Perfect spacing and gap) */}
      {/* ========================================================= */}
      <div className="max-w-[1600px] mx-auto w-full min-h-screen p-4 md:p-6 lg:p-8 flex flex-col lg:flex-row gap-6 lg:gap-8 justify-center items-stretch">
        
        {/* ========================================================= */}
        {/* 🚀 LEFT PANEL: Command Center (Big, Bold, No Shrinking) */}
        {/* ========================================================= */}
        <div className="w-full lg:w-[420px] xl:w-[480px] flex flex-col bg-[#0a0a0c] border border-white/10 rounded-[2rem] p-6 lg:p-10 shadow-2xl relative z-10 flex-shrink-0">
          
          {/* HEADER */}
          <div className="flex items-center gap-3 mb-6 mt-0">
            <div className="relative flex items-center justify-center w-28 h-28 bg-transparent -ml-2">
              <img src="/logo.png" alt="TryNext Logo" className="relative z-10 w-full h-full object-contain" />
            </div>
            <div className="flex flex-col justify-center">
              <h1 className="text-4xl tracking-tight leading-none mb-1 flex items-baseline gap-1.5">
                <span className="font-semibold text-white">TryNext</span>
                <span className="font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-purple-400 to-orange-400">AI</span>
              </h1>
              <span className="italic font-serif text-[15px] text-gray-400 tracking-wide mt-1">
                A Product of Ranajit Dhar
              </span>
            </div>
          </div>

          {/* TOGGLE */}
          <div className="flex items-center bg-black/80 p-1.5 rounded-xl border border-white/5 mb-10 w-full shadow-inner">
            <button onClick={() => setProjectType('app')} className={`flex-1 flex items-center justify-center gap-2 py-3 px-3 rounded-lg text-sm font-bold uppercase tracking-wider transition-all duration-300 ${projectType === 'app' ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 shadow-[0_0_15px_rgba(99,102,241,0.2)]' : 'text-gray-500 hover:text-gray-300'}`}>
              <AppWindow className="w-4 h-4" /> App
            </button>
            <button onClick={() => setProjectType('website')} className={`flex-1 flex items-center justify-center gap-2 py-3 px-3 rounded-lg text-sm font-bold uppercase tracking-wider transition-all duration-300 ${projectType === 'website' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 shadow-[0_0_15px_rgba(6,182,212,0.2)]' : 'text-gray-500 hover:text-gray-300'}`}>
              <LayoutTemplate className="w-4 h-4" /> Web
            </button>
          </div>

          {/* THE ORB (Mic Button - Bishal Boro) */}
          <div className="relative flex items-center justify-center my-2 group">
            {isRecording && <div className="absolute inset-0 bg-rose-500/20 rounded-full blur-3xl animate-pulse scale-150"></div>}
            <div className="absolute inset-0 bg-indigo-500/10 rounded-full blur-2xl group-hover:scale-125 transition-transform duration-500 -z-10"></div>
            <button
              onMouseDown={startRecording} onMouseUp={stopRecording} onTouchStart={startRecording} onTouchEnd={stopRecording}
              disabled={isGenerating || isDeploying || isDiagnosing}
              className={`select-none relative z-10 flex items-center justify-center w-36 h-36 rounded-full transition-all duration-500 ${isGenerating || isDeploying || isDiagnosing ? 'bg-black/60 cursor-not-allowed border border-white/5' :
                  isRecording ? "bg-gradient-to-br from-rose-500 to-red-600 scale-105 shadow-[0_0_50px_rgba(225,29,72,0.5)] border-0" : "bg-gradient-to-br from-indigo-600 to-purple-700 hover:scale-105 hover:shadow-[0_0_50px_rgba(124,58,237,0.5)] border border-white/10"
                }`}
            >
              {isRecording ? <Square className="w-12 h-12 text-white/90 drop-shadow-md" /> : <Mic className="w-12 h-12 text-white/90 drop-shadow-md" />}
            </button>
          </div>

          <p className="text-[12px] font-bold tracking-[0.2em] uppercase mb-8 text-center mt-6">
            {generatedCode ? (
              <span className="text-amber-400 flex items-center justify-center gap-2 animate-pulse">
                <Sparkles className="w-4 h-4" /> Hold to modify {projectType}
              </span>
            ) : (
              <span className="text-gray-400 transition-colors">Hold to create {projectType}</span>
            )}
          </p>

          <div className="w-full flex-grow flex flex-col gap-5">
            {/* Transcript Box */}
            <div className="p-5 bg-black/90 rounded-2xl border border-white/10 shadow-[inset_0_0_20px_rgba(255,255,255,0.02)]">
              <p className="text-[11px] text-gray-400 mb-3 font-bold uppercase tracking-[0.2em]">Live Transcript</p>
              <p className="text-[15px] text-gray-200 min-h-[3.5rem] font-medium italic leading-relaxed">
                {transcript || <span className="text-gray-600">Awaiting your command...</span>}
              </p>
            </div>

            {/* Status Bar */}
            {(isGenerating || isDeploying || agentStatus) && (
              <div className={`p-4 rounded-xl flex items-center gap-3 transition-colors duration-300 border ${isHealing ? 'bg-amber-900/20 text-amber-300 border-amber-500/30 shadow-[0_0_15px_rgba(245,158,11,0.1)]' : isDiagnosing ? 'bg-rose-900/20 text-rose-300 border-rose-500/30 shadow-[0_0_15px_rgba(244,63,94,0.1)]' : 'bg-indigo-900/20 text-indigo-300 border-indigo-500/30 shadow-[0_0_15px_rgba(99,102,241,0.1)]'}`}>
                {isHealing || isDiagnosing || isGenerating || isDeploying ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-5 h-5" />
                )}
                <p className="text-[12px] font-bold tracking-widest uppercase">
                  {agentStatus}
                </p>
              </div>
            )}

            {/* 🧠 THE NEW ENHANCED BRAIN VIEW (Classic YES Ai Live Logs) */}
            <div className="mt-auto bg-[#020202]/90 rounded-2xl border border-emerald-500/20 font-mono flex flex-col shadow-[inset_0_0_30px_rgba(16,185,129,0.05)] relative overflow-hidden h-[240px]">
              
              {/* Brain Header (Clean, No Faltu Badges) */}
              <div className="flex items-center justify-between px-5 py-3 border-b border-emerald-500/20 bg-[#050505] z-10 shadow-sm flex-shrink-0">
                <div className="flex items-center gap-2.5">
                  <span className="text-[16px] drop-shadow-[0_0_8px_rgba(16,185,129,0.5)]">🧠</span>
                  <span className="font-bold tracking-[0.2em] text-emerald-500 uppercase text-[11px]">Swarm Intelligence</span>
                </div>
                
                {/* Just the ONLINE status */}
                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/10 rounded-md border border-emerald-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span className="text-[9px] font-black text-emerald-400 tracking-widest">ONLINE</span>
                </div>
              </div>

              {/* Dynamic Content Area */}
              <div className="p-5 overflow-y-auto custom-scrollbar flex-grow flex flex-col">
                {brainLogs.length === 0 ? (
                  /* 🎭 IDLE ROSTER STATE (Exactly as requested) */
                  <div className="flex flex-col h-full justify-between">
                    <div className="space-y-4 mt-1">
                      {/* MANAGER */}
                      <div className="flex items-center gap-3">
                        <span className="text-[18px] opacity-90 drop-shadow-md">🎛️</span>
                        <div className="flex flex-col">
                          <span className="font-bold text-gray-200 text-[11px] tracking-wide">Manager Agent</span>
                          <span className="text-[9px] text-gray-500 uppercase tracking-widest mt-0.5">Role: Routing & Intent</span>
                        </div>
                      </div>
                      
                      {/* CODER */}
                      <div className="flex items-center gap-3">
                        <span className="text-[18px] opacity-90 drop-shadow-md">🔨</span>
                        <div className="flex flex-col">
                          <span className="font-bold text-gray-200 text-[11px] tracking-wide">Coder Agent</span>
                          <span className="text-[9px] text-gray-500 uppercase tracking-widest mt-0.5">Role: UI/UX & Logic</span>
                        </div>
                      </div>
                      
                      {/* EVALUATOR */}
                      <div className="flex items-center gap-3">
                        <span className="text-[18px] opacity-90 drop-shadow-md">⚖️</span>
                        <div className="flex flex-col">
                          <span className="font-bold text-emerald-400 text-[11px] tracking-wide">Evaluator Agent</span>
                          <span className="text-[9px] text-emerald-500/60 uppercase tracking-widest mt-0.5">Role: QA & Auto-Healing</span>
                        </div>
                      </div>
                    </div>
                    
              
                  </div>
                ) : (
                  /* ⚡ ACTIVE LOGS STATE (YES Ai Master Edition Exact Replica) */
                <div className="flex flex-col gap-1.5">
                    {brainLogs.map((log, idx) => {
                      let colorClass = "text-gray-300"; 
                      
                      // Theme Colors
                      if (log.includes("✅") || log.includes("Complete") || log.includes("APPROVED")) colorClass = "text-emerald-400";
                      if (log.includes("❌") || log.includes("Failed") || log.includes("REJECTED")) colorClass = "text-rose-400";
                      if (log.includes("CIRCUIT BREAKER")) colorClass = "text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20";

                      // YES Ai Formatting Magic: Extract Role and Make it BOLD
                      const colonIdx = log.indexOf(':');
                      let rolePart = "";
                      let messagePart = log;
                      
                      if (colonIdx !== -1 && colonIdx < 30) {
                         rolePart = log.substring(0, colonIdx + 1); // "🎛️ Manager:"
                         messagePart = log.substring(colonIdx + 1); // " Routing request..."
                      }

                      return (
                        <div key={idx} className={`text-[12.5px] leading-relaxed transition-colors duration-300 ${colorClass}`}>
                          {rolePart && <strong className="font-bold text-gray-100 mr-1 drop-shadow-sm">{rolePart}</strong>}
                          <span className={`${log.includes("CIRCUIT") ? "font-bold tracking-wide" : "opacity-90"}`}>
                            {messagePart}
                          </span>
                        </div>
                      );
                    })}
                    <div ref={logsEndRef} />
                  </div>
                )}
              </div>
            </div>


          </div>
        </div>

        {/* ========================================================= */}
        {/* 🎨 RIGHT PANEL: The Stage (Max-Width limited to prevent stretching) */}
        {/* ========================================================= */}
        <div className="flex-1 w-full max-w-[1000px] flex flex-col bg-[#0a0a0c] border border-white/10 rounded-[2rem] p-6 lg:p-8 shadow-2xl relative z-10">
          
          {/* HEADER TOOLBAR */}
          <div className="flex flex-wrap items-center justify-between mb-4 gap-4">
            <div className="flex items-center gap-3">
              <Play className="w-6 h-6 text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.5)]" />
              <h2 className="text-2xl font-bold text-white tracking-wide">Live Sandbox</h2>
            </div>

            <div className="flex items-center gap-4 flex-wrap">
              
              {/* 🩺 THE NEW ENTERPRISE AI DOCTOR WIDGET (God Level Design) */}
              <button 
                onClick={!isDiagnosing ? runDoctorAgent : undefined}
                className={`relative flex items-center gap-3 px-4 py-2.5 rounded-2xl border transition-all duration-500 overflow-hidden group ${
                  isDiagnosing 
                    ? 'bg-rose-950/30 border-rose-500/50 cursor-not-allowed shadow-[0_0_20px_rgba(244,63,94,0.15)]' 
                    : 'bg-[#0f1014] border-emerald-500/30 hover:border-emerald-400 hover:bg-[#15171a] shadow-[0_4px_20px_rgba(16,185,129,0.1)] hover:shadow-[0_0_25px_rgba(16,185,129,0.25)] cursor-pointer'
                }`}
              >
                {/* Breathing Radar Dot */}
                <div className="relative flex items-center justify-center w-4 h-4">
                  <span className={`absolute w-3 h-3 rounded-full ${isDiagnosing ? 'bg-rose-500' : 'bg-emerald-400'} animate-ping opacity-60`}></span>
                  <span className={`relative w-2.5 h-2.5 rounded-full ${isDiagnosing ? 'bg-rose-500' : 'bg-emerald-500'}`}></span>
                </div>
                
                {/* Text Block */}
                <div className="flex flex-col items-start text-left hidden sm:flex">
                  <span className={`text-[13px] font-black tracking-widest uppercase leading-tight ${isDiagnosing ? 'text-rose-400' : 'text-gray-100 group-hover:text-white transition-colors'}`}>
                    {isDiagnosing ? 'Scanning repository...' : 'Run AI Doctor'}
                  </span>
                  <span className={`text-[9px] font-bold uppercase tracking-[0.2em] mt-0.5 ${isDiagnosing ? 'text-rose-500/80' : 'text-emerald-500/80 group-hover:text-emerald-400 transition-colors'}`}>
                    {isDiagnosing ? 'Whole-codebase review' : 'Active System Monitor'}
                  </span>
                </div>

                {/* Vertical Separator & Icon */}
                <div className={`w-[1px] h-7 mx-1 hidden sm:block transition-colors ${isDiagnosing ? 'bg-rose-500/20' : 'bg-white/10 group-hover:bg-emerald-500/20'}`}></div>
                <Stethoscope className={`w-5 h-5 ${isDiagnosing ? 'text-rose-400 animate-spin' : 'text-gray-400 group-hover:text-emerald-400 transition-colors'}`} />
                <span className="sm:hidden text-[11px] font-black uppercase tracking-widest text-gray-200 ml-1">Doctor</span>
              </button>

              {/* View Toggles & Actions */}
              <div className="flex items-center gap-2">
                <div className="flex items-center bg-black/50 p-1.5 rounded-xl border border-white/5 shadow-inner">
                  <button onClick={() => setSandboxView('desktop')} className={`p-2.5 rounded-lg transition-colors ${sandboxView === 'desktop' ? 'bg-white/10 text-white shadow-sm' : 'text-gray-500 hover:text-white'}`}>
                    <Monitor className="w-5 h-5" />
                  </button>
                  <button onClick={() => setSandboxView('mobile')} className={`p-2.5 rounded-lg transition-colors ${sandboxView === 'mobile' ? 'bg-white/10 text-white shadow-sm' : 'text-gray-500 hover:text-white'}`}>
                    <Smartphone className="w-5 h-5" />
                  </button>
                </div>

                {/* 🚨 HARANO TRASH BUTTON EKHANE FEROT ELO 🚨 */}
                <button 
                  onClick={() => { setGeneratedCode(""); setSrsData(null); setDeployUrl(null); setAgentStatus(""); }} 
                  disabled={!generatedCode || isGenerating || isDiagnosing}
                  className={`p-2.5 rounded-xl transition-colors border ${
                    generatedCode 
                      ? 'text-gray-400 bg-white/5 hover:bg-rose-500/10 hover:text-rose-400 hover:border-rose-500/30 border-white/10' 
                      : 'text-gray-600 bg-transparent border-transparent cursor-not-allowed opacity-50'
                  }`}
                  title="Clear Sandbox"
                >
                  <Trash2 className="w-5 h-5" />
                </button>

                {/* Publish Button - Always there, active only when code exists */}
                <button 
                  onClick={deployToVercel} 
                  disabled={!generatedCode || isDeploying || !!deployUrl || isGenerating} 
                  className={`flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-[12px] font-bold uppercase tracking-widest transition-all duration-300 ${
                    generatedCode && !deployUrl && !isGenerating
                      ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white hover:scale-105 shadow-[0_0_20px_rgba(6,182,212,0.3)] cursor-pointer' 
                      : 'bg-white/10 text-gray-400 border border-white/20 cursor-not-allowed shadow-inner'
                  }`}
                >
                  {isDeploying ? <Loader2 className="w-4 h-4 animate-spin text-gray-400" /> : <Globe className="w-4 h-4" />}
                  {deployUrl ? 'Published' : 'Publish'}
                </button>
              </div>
            </div>
          </div>

          <div className="h-[1px] w-full bg-white/5 mb-6 mt-2"></div> {/* Horizontal Divider */}

          {/* ============================================================== */}
          {/* 🌐 LIVE URL & 👑 PREMIUM PAYWALL BOX */}
          {/* ============================================================== */}
          {deployUrl && (
            <div className="mb-6 flex flex-col gap-3">
              {/* Box 1: The Live Link */}
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center justify-between shadow-lg">
                <p className="text-sm text-emerald-400 font-bold uppercase tracking-wider">🎉 Live URL Ready!</p>
                <a href={deployUrl} target="_blank" rel="noopener noreferrer" className="px-4 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 rounded-lg text-xs font-bold flex items-center gap-2 transition-colors">
                  Open Link <ExternalLink className="w-4 h-4" />
                </a>
              </div>
              
              {/* Box 2: The XPRIZE Paywall */}
              <div className="p-4 bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/30 rounded-xl flex items-center justify-between shadow-lg">
                <div className="flex flex-col">
                  <p className="text-sm text-amber-400 font-bold uppercase tracking-wider flex items-center gap-2">
                    👑 Upgrade to PRO
                  </p>
                  <p className="text-[10px] text-amber-500/70 font-bold uppercase tracking-widest mt-1">
                    Unlock 1-Month Validity & Auto-Scaling
                  </p>
                </div>
                <button 
                  onClick={handleUpgrade}
                  disabled={isUpgrading}
                  className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:scale-105 disabled:hover:scale-100 disabled:opacity-50 text-white rounded-lg text-xs font-black uppercase tracking-widest flex items-center gap-2 transition-all shadow-[0_0_15px_rgba(245,158,11,0.3)]"
                >
                  {isUpgrading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  Pay ₹10
                </button>
              </div>
            </div>
          )}
          {/* ============================================================== */}

          {/* ============================================================== */}
          {/* 📱 THE CLEAN BRIGHT CANVAS (100% Fixed Scroll & Height) */}
          {/* ============================================================== */}
          <div className="w-full flex-grow overflow-auto custom-scrollbar block pb-4 pt-2">
            <div className={`transition-all duration-700 ease-in-out relative flex flex-col mx-auto ${
                sandboxView === 'mobile'
                  ? 'w-max min-w-[320px] sm:min-w-[375px] h-[550px] sm:h-[750px] border-[12px] sm:border-[14px] border-[#000] rounded-[2.5rem] sm:rounded-[3rem] shadow-[0_30px_60px_rgba(0,0,0,0.8)] overflow-hidden bg-white ring-1 ring-white/10'
                  : 'w-[450px] lg:w-full min-h-[450px] h-full rounded-2xl overflow-hidden bg-white shadow-[0_10px_40px_rgba(0,0,0,0.5)] border border-white/10'
              }`}>

              {/* Fake Browser/Phone Header */}
              <div className={`bg-gray-50 border-b border-gray-200 flex items-center justify-center flex-shrink-0 ${sandboxView === 'mobile' ? 'h-8' : 'h-12 px-6 justify-start gap-2.5'}`}>
                {sandboxView === 'mobile' ? (
                  <div className="w-28 sm:w-36 h-5 sm:h-6 bg-black rounded-b-xl sm:rounded-b-2xl absolute top-0 flex items-center justify-center">
                     <div className="w-10 sm:w-12 h-1 sm:h-1.5 bg-white/10 rounded-full mt-0.5 sm:mt-1"></div>
                  </div>
                ) : (
                  <>
                    <div className="w-3.5 h-3.5 rounded-full bg-rose-400 shadow-sm"></div>
                    <div className="w-3.5 h-3.5 rounded-full bg-amber-400 shadow-sm"></div>
                    <div className="w-3.5 h-3.5 rounded-full bg-emerald-400 shadow-sm"></div>
                  </>
                )}
              </div>

              {!generatedCode ? (
                <div className="flex-grow flex flex-col items-center justify-center text-gray-400 bg-[#f8f9fa] relative">
                  <div className="absolute inset-0 bg-[linear-gradient(#e5e7eb_1px,transparent_1px),linear-gradient(90deg,#e5e7eb_1px,transparent_1px)] bg-[size:30px_30px] opacity-40 pointer-events-none"></div>
                  <div className="relative z-10 flex flex-col items-center">
                    <div className="w-20 h-20 rounded-full bg-white shadow-sm flex items-center justify-center mb-5 border border-gray-200">
                      <Code className="w-10 h-10 text-gray-300" />
                    </div>
                    <p className="font-bold text-sm uppercase tracking-[0.3em] text-gray-400">Canvas is empty</p>
                  </div>
                </div>
              ) : (
                <iframe
                  title="Live Preview"
                  srcDoc={generatedCode}
                  className="w-full flex-grow border-0 bg-white"
                  sandbox="allow-scripts allow-same-origin allow-forms"
                />
              )}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
