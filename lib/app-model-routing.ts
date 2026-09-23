import type { ApiConfig } from "./settings-types";

export const APP_MODELS = {
  story: "gemini-3.1-pro-preview",
  chat: "gemini-3.8-flash",
  background: "gemini-3.5-flash-lite",
} as const;

type Tier = keyof typeof APP_MODELS;
export function modelTierForApp(appId = "chat"): Tier {
  if (appId === "story") return "story";
  if (appId === "chat" || appId === "group_chat") return "chat";
  return "background";
}

/** Route Gemini text generation only. Never mutate stored credentials or bindings.
 * Gemini requests are normalized to the current app defaults, including STORY,
 * so stale Pro bindings such as gemini-2.5-pro are upgraded automatically.
 * Dedicated image, audio and embedding models, non-Gemini providers and API
 * tests are untouched.
 */
export function resolveAppModelConfig<T extends ApiConfig>(config: T, appId = "chat"): T {
  if (appId === "api_test" || appId === "embedding") return config;
  const model = config.defaultModel.trim();
  const gemini = /^(.*\/)?(gemini-[^/:]+)(:[^/]+)?$/i.exec(model);
  if (!gemini && !/^(google|gemini)$/i.test(config.provider.trim())) return config;
  if (/image|tts|audio|embedding|live|robotics|computer-use/i.test(model)) return config;
  const tier = modelTierForApp(appId);
  // OpenRouter and compatible gateways may require e.g. google/ and :free.
  const prefix = gemini?.[1] ?? "";
  const suffix = gemini?.[3] ?? "";
  const targetModel = `${prefix}${APP_MODELS[tier]}${suffix}`;
  if (model.toLowerCase() === targetModel.toLowerCase()) return config;
  return { ...config, defaultModel: targetModel };
}
