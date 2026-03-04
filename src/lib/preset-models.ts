export interface PresetModelGroup {
  provider: string;
  label: string;
  models: string[];
}

export const PRESET_MODEL_GROUPS: PresetModelGroup[] = [
  {
    provider: "openai",
    label: "OpenAI",
    models: [
      "gpt-5.3-codex",
      "gpt-5.3-instant",
      "gpt-5.2",
      "o3",
      "o3-pro",
      "o3-mini",
      "o4-mini",
      "codex-mini-latest",
    ],
  },
  {
    provider: "anthropic",
    label: "Anthropic",
    models: [
      "claude-opus-4-6",
      "claude-sonnet-4-6",
      "claude-haiku-4-5",
      "claude-opus-4-5",
      "claude-sonnet-4-5",
    ],
  },
  {
    provider: "google",
    label: "Google Gemini",
    models: [
      "gemini-3.1-pro",
      "gemini-3-flash",
      "gemini-3.1-flash-lite",
      "gemini-2.5-pro",
      "gemini-2.5-flash",
      "gemini-2.5-flash-lite",
    ],
  },
  {
    provider: "deepseek",
    label: "DeepSeek",
    models: [
      "deepseek-chat",
      "deepseek-reasoner",
    ],
  },
  {
    provider: "kimi",
    label: "Kimi (Moonshot)",
    models: [
      "kimi-k2.5",
      "kimi-k2",
      "moonshot-v1-auto",
      "moonshot-v1-128k",
      "moonshot-v1-32k",
      "moonshot-v1-8k",
    ],
  },
  {
    provider: "glm",
    label: "GLM (Zhipu/智谱)",
    models: [
      "glm-5",
      "glm-4.7",
      "glm-4-plus",
      "glm-4-long",
      "glm-4-flash",
      "glm-4v-plus",
    ],
  },
  {
    provider: "minimax",
    label: "MiniMax",
    models: [
      "MiniMax-M2.5",
      "MiniMax-M2.5-highspeed",
      "MiniMax-M2.1",
    ],
  },
  {
    provider: "qwen",
    label: "Qwen (Alibaba/通义)",
    models: [
      "qwen3.5-flash",
      "qwen3-max-thinking",
      "qwen3-max",
      "qwen3-plus",
      "qwen3-turbo",
      "qwen3.5-122b-a10b",
      "qwen3.5-35b-a3b",
      "qwen3.5-27b",
    ],
  },
  {
    provider: "grok",
    label: "Grok (xAI)",
    models: [
      "grok-4-0709",
      "grok-4-1-fast-reasoning",
      "grok-4-1-fast-non-reasoning",
      "grok-3",
      "grok-3-mini",
      "grok-code-fast-1",
    ],
  },
];

export function getPresetProviderLabels(): Record<string, string> {
  const map: Record<string, string> = {};
  for (const group of PRESET_MODEL_GROUPS) {
    map[group.provider] = group.label;
  }
  return map;
}

export function findPresetGroupByProvider(provider: string): PresetModelGroup | undefined {
  return PRESET_MODEL_GROUPS.find((g) => g.provider === provider);
}
