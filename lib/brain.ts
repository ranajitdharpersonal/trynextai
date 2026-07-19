import {
  BedrockRuntimeClient,
  ConverseCommand,
} from "@aws-sdk/client-bedrock-runtime";

export type BrainProvider = "OPENAI" | "NOVA" | "QWEN" | "LLAMA";

export type BrainRole =
  | "ROUTER"
  | "MANAGER"
  | "CODER"
  | "MODIFIER"
  | "CLONER"
  | "EVALUATOR"
  | "DOCTOR";

export type BrainResponse = {
  text: string;
  modelUsed: BrainProvider;
  modelName: string;
  circuitTripped: string | null;
};

const BEDROCK_MODELS: Record<Exclude<BrainProvider, "OPENAI">, string> = {
  NOVA: "us.amazon.nova-2-lite-v1:0",
  QWEN: "qwen.qwen3-coder-next",
  LLAMA: "us.meta.llama3-3-70b-instruct-v1:0",
};

const MODEL_LABELS: Record<BrainProvider, string> = {
  OPENAI: "OpenAI GPT-5.6",
  NOVA: "Amazon Nova 2 Lite",
  QWEN: "Qwen3 Coder Next",
  LLAMA: "Llama 3.3 70B Instruct",
};

/**
 * The primary tier is intentionally role-aware to control cost without
 * making the GPT-5.6 integration decorative:
 *
 * - Nova 2 Lite handles lightweight routing and requirement planning.
 * - GPT-5.6 handles code generation, modification, and cloning.
 * - Qwen3 Coder Next handles QA and repository repair.
 *
 * If the selected primary provider fails, the same request falls through to
 * Qwen3 Coder Next and then Llama 3.3. A circuit is request-scoped; no global
 * provider state is persisted between users or requests.
 */
const PRIMARY_PROVIDER_BY_ROLE: Record<BrainRole, BrainProvider> = {
  ROUTER: "NOVA",
  MANAGER: "NOVA",
  CODER: "OPENAI",
  MODIFIER: "OPENAI",
  CLONER: "OPENAI",
  EVALUATOR: "QWEN",
  DOCTOR: "QWEN",
};

const CODE_ROLES = new Set<BrainRole>(["CODER", "MODIFIER", "CLONER"]);
const CODE_RESPONSE_TOKEN_LIMIT = 7000;

function providerTimeoutFor(provider: BrainProvider, role: BrainRole): number {
  // Repository scans legitimately need more time than a normal conversational
  // request, while interactive app generation must stay bounded for the UI.
  if (role === "DOCTOR") return 90_000;

  const isCodeRequest = CODE_ROLES.has(role);
  if (provider === "OPENAI") return isCodeRequest ? 35_000 : 25_000;
  if (provider === "QWEN") return isCodeRequest ? 25_000 : 25_000;
  if (provider === "LLAMA") return isCodeRequest ? 15_000 : 20_000;
  return 20_000;
}

async function withProviderTimeout<T>(
  provider: BrainProvider,
  role: BrainRole,
  request: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  const timeoutMs = providerTimeoutFor(provider, role);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await request(controller.signal);
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error(`${MODEL_LABELS[provider]} timed out after ${timeoutMs / 1000} seconds`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown provider error";
}

function primaryProviderFor(role: BrainRole): BrainProvider {
  return PRIMARY_PROVIDER_BY_ROLE[role];
}

function providerChain(preferredEngine: string, role: BrainRole): BrainProvider[] {
  const requested = preferredEngine.toUpperCase();
  const primary =
    requested === "QWEN" || requested === "LLAMA" || requested === "NOVA"
      ? (requested as BrainProvider)
      : primaryProviderFor(role);

  const chain: BrainProvider[] = [primary];
  if (primary !== "QWEN" && primary !== "LLAMA") chain.push("QWEN");
  if (primary !== "LLAMA") chain.push("LLAMA");

  return [...new Set(chain)];
}

function maxTokensFor(provider: Exclude<BrainProvider, "OPENAI">, role: BrainRole): number {
  if (provider === "LLAMA") return 4000;
  if (provider === "NOVA") return 2200;
  return CODE_ROLES.has(role) ? CODE_RESPONSE_TOKEN_LIMIT : role === "DOCTOR" ? 6000 : 3000;
}

async function callOpenAI(
  prompt: string,
  systemInstruction: string,
  role: BrainRole,
): Promise<string> {
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) throw new Error("OPENAI_API_KEY missing");

  const response = await withProviderTimeout("OPENAI", role, (signal) =>
    fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-5.6",
        messages: [
          { role: "system", content: systemInstruction },
          { role: "user", content: prompt },
        ],
        // Bound full-app responses so one request cannot monopolize the UI or
        // consume the complete demo budget. The Coder still has room for a
        // complete single-file application.
        max_completion_tokens: CODE_ROLES.has(role) ? CODE_RESPONSE_TOKEN_LIMIT : 2200,
      }),
      signal,
    }),
  );

  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || "OpenAI request failed");

  const text = data.choices?.[0]?.message?.content;
  if (typeof text !== "string" || !text.trim()) {
    throw new Error("OpenAI returned an empty response");
  }

  return text.trim();
}

async function callBedrock(
  provider: Exclude<BrainProvider, "OPENAI">,
  prompt: string,
  systemInstruction: string,
  role: BrainRole,
): Promise<string> {
  const region = process.env.BEDROCK_AWS_REGION;
  const accessKeyId = process.env.BEDROCK_AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.BEDROCK_AWS_SECRET_ACCESS_KEY;

  if (!region || !accessKeyId || !secretAccessKey) {
    throw new Error("Bedrock AWS credentials missing in environment");
  }

  const client = new BedrockRuntimeClient({
    region,
    credentials: { accessKeyId, secretAccessKey },
  });

  // Converse provides one model-agnostic Bedrock contract for Nova, Qwen,
  // and Llama, avoiding provider-specific prompt/response assumptions.
  const command = new ConverseCommand({
    modelId: BEDROCK_MODELS[provider],
    system: [{ text: systemInstruction }],
    messages: [{ role: "user", content: [{ text: prompt }] }],
    inferenceConfig: {
      maxTokens: maxTokensFor(provider, role),
      temperature: 0.5,
      topP: 0.9,
    },
  });

  const response = await withProviderTimeout(provider, role, (abortSignal) =>
    client.send(command, { abortSignal }),
  );
  const content = response.output?.message?.content || [];
  const text = content
    .map((block) => ("text" in block && typeof block.text === "string" ? block.text : ""))
    .join("")
    .trim();

  if (!text) throw new Error(`${MODEL_LABELS[provider]} returned an empty response`);
  return text;
}

/**
 * Run one role-aware request through the three-tier provider circuit:
 * primary role model → Qwen3 Coder Next → Llama 3.3.
 *
 * Passing `preferredEngine` as QWEN or LLAMA is supported for explicit
 * failover/testing, while the default OPENAI entry uses the role map above.
 */
export async function askBrain(
  prompt: string,
  systemInstruction: string = "You are an expert AI.",
  preferredEngine: string = "OPENAI",
  role: BrainRole = "CODER",
): Promise<BrainResponse> {
  const providers = providerChain(preferredEngine, role);
  const failures: string[] = [];

  for (const provider of providers) {
    try {
      const text =
        provider === "OPENAI"
          ? await callOpenAI(prompt, systemInstruction, role)
          : await callBedrock(provider, prompt, systemInstruction, role);

      return {
        text,
        modelUsed: provider,
        modelName: MODEL_LABELS[provider],
        circuitTripped: failures.length ? failures.join(" → ") : null,
      };
    } catch (error) {
      const reason = `${MODEL_LABELS[provider]} failed: ${errorMessage(error)}`;
      failures.push(reason);
      console.error(reason);
    }
  }

  throw new Error("ALL SYSTEMS CRASHED! No configured LLM available.");
}
