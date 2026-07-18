// lib/brain.ts
import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";

export type BrainResponse = {
  text: string;
  modelUsed: "OPENAI" | "LLAMA" | "QWEN";
  circuitTripped: string | null;
};

/**
 * Executes the configured model route with ordered failover.
 *
 * `preferredEngine` controls the entry point into the chain. When OPENAI is
 * selected, an OpenAI failure trips the request-level circuit and allows the
 * same request to continue through Bedrock and then Hugging Face. Selecting
 * LLAMA skips OpenAI; selecting any other value uses the final Qwen route.
 * The function does not persist circuit state between requests—
 * `circuitTrippedReason` is telemetry for this invocation only.
 */
// 🛑 preferredEngine default is now OPENAI
export async function askBrain(
  prompt: string,
  systemInstruction: string = "You are an expert AI.",
  preferredEngine: string = "OPENAI"
): Promise<BrainResponse> {

  let circuitTrippedReason: string | null = null;

  // ==========================================
  // 1️⃣ PRIMARY ROUTE: OPENAI
  // Attempted only when explicitly selected. Any configuration, transport,
  // authentication, quota, or API response failure is contained here so the
  // request can continue to the next provider.
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

      // Preserve a safe, user-facing description of the trip for observability
      // and downstream responses; do not expose the provider response itself.
      circuitTrippedReason =
        `OpenAI Suspended (${error.message.includes("Quota") ? "Quota Exceeded" : "Timeout/Error"}) → Routing to Llama 3`;
    }
  }

  // ==========================================
  // 2️⃣ SECONDARY ROUTE: LLAMA 3.3 (AWS BEDROCK)
  // Reached after an OpenAI trip, or directly when LLAMA is preferred. A
  // Bedrock failure is also non-fatal and advances the request to Qwen.
  // ==========================================
  if (preferredEngine === "OPENAI" || preferredEngine === "LLAMA") {
    try {
      const region = process.env.BEDROCK_AWS_REGION;
      const accessKeyId = process.env.BEDROCK_AWS_ACCESS_KEY_ID;
      const secretAccessKey = process.env.BEDROCK_AWS_SECRET_ACCESS_KEY;

      // Validate all required settings before constructing the SDK client so
      // missing deployment configuration follows the same fallback path as a
      // runtime Bedrock outage.
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

      // Llama 3 requires its special header/eot token format. Keeping prompt
      // construction in the adapter isolates provider-specific requirements.
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
      
      // Bedrock returns an encoded byte payload; decode and parse it before
      // normalizing the provider-specific generation field.
      const responseBody = JSON.parse(new TextDecoder().decode(response.body));

      return {
        text: responseBody.generation,
        modelUsed: "LLAMA",
        circuitTripped: circuitTrippedReason 
      };

    } catch (error: any) {
      console.error("Llama (AWS) failed:", error.message);
      // Replace the route marker with the latest failed provider so callers
      // can identify why the request ultimately proceeded to Qwen.
      circuitTrippedReason = `Llama Suspended (${error.message}) → Routing to Qwen`;
    }
  }

  // ==========================================
  // 3️⃣ TERTIARY ROUTE: QWEN 2.5 (HUGGING FACE)
  // This is the final provider. A failure here cannot be recovered locally,
  // so the function surfaces a single terminal error to its caller.
  // ==========================================
  try {
    const hfKey = process.env.HF_TOKEN;
    // Treat missing Hugging Face credentials as an unavailable provider and
    // let the terminal catch produce the consistent all-providers error.
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

    // Hugging Face echoes the input prompt; return only the generated assistant
    // continuation so all providers expose the same BrainResponse contract.
    let finalAnswer = data[0].generated_text.split("Assistant:").pop().trim();

    return {
      text: finalAnswer,
      modelUsed: "QWEN",
      circuitTripped: circuitTrippedReason
    };

  } catch (error: any) {
    // Deliberately avoid leaking provider credentials or raw upstream errors.
    // The detailed route is already recorded in logs and circuit metadata.
    throw new Error("🚨 ALL SYSTEMS CRASHED! No LLM available.");
  }
}
