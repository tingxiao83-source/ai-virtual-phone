# Gemini model routing

Text generation routes by app: `story` uses Pro; `chat` and `group_chat` use Flash; all other text-generation apps and auxiliary calls use Flash-Lite. An already-matching Gemini model tier/version is retained. Otherwise the fallback is the corresponding Gemini 2.5 model. Shopping and Xiaohongshu retain their pre-existing Flash-Lite policies.

The same resolver runs for completion, streaming, native tool completion and native tool streaming. Chat/group/story prompt builders resolve the effective model for previews and newly prepared push snapshots. Weixin snapshots, mascot/workshop direct calls, and auxiliary `simpleLLMCall` paths are covered. Already uploaded offline snapshots require refreshing from the app before they can use this policy.

Stored API keys, endpoints, bindings, prompts and model configurations are not rewritten. Non-Gemini APIs and dedicated image, TTS, audio, live and embedding models are not rerouted. API connectivity tests use the configured model, not the app policy. Gateway model namespaces/suffixes are preserved; availability and pricing are determined by the configured provider.

Validation: `node scripts/test-app-model-routing.cjs` exercises all four real dispatch entrypoints through actual provider payload construction (48 cases), without network calls, plus auxiliary requests, API-test isolation, correct-tier preservation and dedicated-model exclusions. Run `npx tsc --noEmit --incremental false` and `npm run build` for integration checks.
