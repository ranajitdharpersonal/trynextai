// lib/brain.ts
import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";

export type BrainResponse = {
  text: string;
  modelUsed: "OPENAI" | "LLAMA" | "QWEN";
  circuitTripped: string | null;
};

// 🛑 preferredEngine default is now OPENAI
export async function askBrain(
  prompt: string,
  systemInstruction: string = "You are an expert AI.",
  preferredEngine: string = "OPENAI"
): Promise<BrainResponse> {

  let circuitTrippedReason: string | null = null;

  // ==========================================
  // 1️⃣ PRIORITY 1: OPENAI (Only if preferredEngine is OPENAI)
  // ==========================================
  if (preferredEngine === "OPENAI") {
    try {
      const openaiKey = process.env.OPENAI_API_KEY;
      if (!openaiKey) throw new Error("OPENAI_API_KEY missing");

      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${openaiKey}`
        },
        body: JSON.stringify({
          model: "gpt-5.6",
          messages: [
            {
              role: "system",
              content: systemInstruction
            },
            {
              role: "user",
              content: prompt
            }
          ]
        })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error?.message || "OpenAI Error");
      }

      return {
        text: data.choices[0].message.content,
        modelUsed: "OPENAI",
        circuitTripped: null
      };

    } catch (error: any) {
      console.error("OpenAI failed:", error.message);

      circuitTrippedReason =
        `OpenAI Suspended (${error.message.includes("Quota") ? "Quota Exceeded" : "Timeout/Error"}) → Routing to Llama 3`;
    }
  }

  // ==========================================
  // 2️⃣ PRIORITY 2: LLAMA 3.3 (AWS BEDROCK)
  // ==========================================
  if (preferredEngine === "OPENAI" || preferredEngine === "LLAMA") {
    try {
      const region = process.env.BEDROCK_AWS_REGION;
      const accessKeyId = process.env.BEDROCK_AWS_ACCESS_KEY_ID;
      const secretAccessKey = process.env.BEDROCK_AWS_SECRET_ACCESS_KEY;

      if (!region || !accessKeyId || !secretAccessKey) {
        throw new Error("Bedrock AWS Credentials missing in .env");
      }

      const client = new BedrockRuntimeClient({
        region: region,
        credentials: {
          accessKeyId: accessKeyId,
          secretAccessKey: secretAccessKey,
        },
      });

      // Llama 3 strict prompt formatting for AWS Bedrock
      const formattedPrompt = `<|begin_of_text|><|start_header_id|>system<|end_header_id|>\n${systemInstruction}\n<|eot_id|><|start_header_id|>user<|end_header_id|>\n${prompt}\n<|eot_id|><|start_header_id|>assistant<|end_header_id|>`;

      const command = new InvokeModelCommand({
        modelId: "us.meta.llama3-3-70b-instruct-v1:0",
        contentType: "application/json",
        accept: "application/json",
        body: JSON.stringify({
          prompt: formattedPrompt,
          max_gen_len: 2000,
          temperature: 0.5,
          top_p: 0.9,
        }),
      });

      const response = await client.send(command);
      
      // AWS Bedrock response parsing
      const responseBody = JSON.parse(new TextDecoder().decode(response.body));

      return {
        text: responseBody.generation,
        modelUsed: "LLAMA",
        circuitTripped: circuitTrippedReason 
      };

    } catch (error: any) {
      console.error("Llama (AWS) failed:", error.message);
      circuitTrippedReason = `Llama Suspended (${error.message}) → Routing to Qwen`;
    }
  }

  // ==========================================
  // 3️⃣ PRIORITY 3: QWEN 2.5 (Fallback of the fallback)
  // ==========================================
  try {
    const hfKey = process.env.HF_TOKEN;
    if (!hfKey) throw new Error("HF_TOKEN missing");

    const res = await fetch("https://api-inference.huggingface.co/models/Qwen/Qwen2.5-72B-Instruct", {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Authorization": `Bearer ${hfKey}`
      },
      body: JSON.stringify({
        inputs: `${systemInstruction}\nUser: ${prompt}\nAssistant:`,
        parameters: { max_new_tokens: 2000 }
      })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "HF Error");

    let finalAnswer = data[0].generated_text.split("Assistant:").pop().trim();

    return {
      text: finalAnswer,
      modelUsed: "QWEN",
      circuitTripped: circuitTrippedReason
    };

  } catch (error: any) {
    throw new Error("🚨 ALL SYSTEMS CRASHED! No LLM available.");
  }
}