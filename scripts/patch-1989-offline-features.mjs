import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function write(rel, content) {
  fs.writeFileSync(path.join(root, rel), content, "utf8");
}

function replaceOnce(source, needle, replacement, label) {
  if (!source.includes(needle)) {
    throw new Error(`[patch-1989-offline-features] Missing patch anchor: ${label}`);
  }
  return source.replace(needle, replacement);
}

function patchWallet() {
  const rel = "lib/wallet-storage.ts";
  let source = read(rel);
  if (source.includes("WALLET_BALANCE_100K_MIGRATION_KEY")) return;

  source = replaceOnce(
    source,
    'const DEFAULT_WALLET_BALANCE = 10000;',
    'const DEFAULT_WALLET_BALANCE = 100000;\nconst WALLET_BALANCE_100K_MIGRATION_KEY = "wallet_balance_100000_migration_v1";',
    "wallet default balance",
  );
  source = replaceOnce(
    source,
    'registerKvMigration(WALLET_STATE_KEY);',
    'registerKvMigration(WALLET_STATE_KEY);\nregisterKvMigration(WALLET_BALANCE_100K_MIGRATION_KEY);',
    "wallet migration registration",
  );
  source = replaceOnce(
    source,
    `    if (!raw) {\n      const next = createDefaultWalletState();\n      saveWalletState(next);\n      return next;\n    }`,
    `    if (!raw) {\n      const next = createDefaultWalletState();\n      saveWalletState(next);\n      kvSet(WALLET_BALANCE_100K_MIGRATION_KEY, "done");\n      return next;\n    }`,
    "wallet empty-state migration",
  );
  source = replaceOnce(
    source,
    `    const parsed = JSON.parse(raw) as Record<string, unknown>;\n    const next = migrateLegacyParsedState(parsed);\n    if (!("balance" in parsed) || next.cards.length === 0) saveWalletState(next);\n    return next;`,
    `    const parsed = JSON.parse(raw) as Record<string, unknown>;\n    const needsBalanceMigration = kvGet(WALLET_BALANCE_100K_MIGRATION_KEY) !== "done";\n    let next = migrateLegacyParsedState(parsed);\n    if (needsBalanceMigration) {\n      const previousBalance = normalizeMoney(next.balance);\n      const delta = normalizeSignedMoney(DEFAULT_WALLET_BALANCE - previousBalance);\n      const now = new Date().toISOString();\n      const migrationTransaction: WalletTransaction = {\n        id: "wallet_balance_100000_migration_v1",\n        cardId: WALLET_BALANCE_ACCOUNT_ID,\n        accountType: "balance",\n        title: "1989 世界钱包余额调整",\n        amount: delta,\n        kind: "adjustment",\n        category: "初始化",\n        createdAt: now,\n        detail: "一次性将玩家钱包余额调整为 ¥100,000；之后消费与入账正常累计，不再自动重置。",\n        balanceAfter: DEFAULT_WALLET_BALANCE,\n      };\n      next = normalizeWalletState({\n        ...next,\n        balance: DEFAULT_WALLET_BALANCE,\n        transactions: [migrationTransaction, ...next.transactions],\n        updatedAt: now,\n      });\n    }\n    if (needsBalanceMigration || !("balance" in parsed) || next.cards.length === 0) saveWalletState(next);\n    if (needsBalanceMigration) kvSet(WALLET_BALANCE_100K_MIGRATION_KEY, "done");\n    return next;`,
    "wallet existing-state migration",
  );
  write(rel, source);
}

function patchShopping() {
  const rel = "lib/shopping-storage.ts";
  let source = read(rel);
  if (source.includes("SHOPPING_1989_CATALOG_MIGRATION_KEY")) return;

  source = replaceOnce(
    source,
    'const SHOPPING_STATE_KEY = "ai_phone_shopping_state_v1";',
    'const SHOPPING_STATE_KEY = "ai_phone_shopping_state_v1";\nconst SHOPPING_1989_CATALOG_MIGRATION_KEY = "shopping_1989_catalog_migration_v1";',
    "shopping migration key",
  );
  source = replaceOnce(
    source,
    'registerKvMigration(SHOPPING_STATE_KEY);',
    'registerKvMigration(SHOPPING_STATE_KEY);\nregisterKvMigration(SHOPPING_1989_CATALOG_MIGRATION_KEY);',
    "shopping migration registration",
  );
  source = replaceOnce(
    source,
    `    const parsed = JSON.parse(raw) as Record<string, unknown>;\n    const catalogRaw = parsed.catalog && typeof parsed.catalog === "object"`,
    `    let parsed = JSON.parse(raw) as Record<string, unknown>;\n    if (kvGet(SHOPPING_1989_CATALOG_MIGRATION_KEY) !== "done") {\n      // Old generated lists may contain modern products. Drop only active catalogue-like\n      // data and keep order history/payment records intact. The 1989-aware generator\n      // will rebuild recommendations/search results on demand.\n      parsed = {\n        ...parsed,\n        catalog: { categories: [], recommendations: [] },\n        searchResult: undefined,\n        savedItems: [],\n        cartItems: [],\n        generatedAt: undefined,\n      };\n      kvSet(SHOPPING_STATE_KEY, JSON.stringify(parsed));\n      kvSet(SHOPPING_1989_CATALOG_MIGRATION_KEY, "done");\n    }\n    const catalogRaw = parsed.catalog && typeof parsed.catalog === "object"`,
    "shopping catalogue migration",
  );
  write(rel, source);
}

function patchDesktopShell() {
  const rel = "components/desktop-shell.tsx";
  let source = read(rel);

  if (!source.includes('import { OfflineDateApp } from "@/components/offline/offline-date-app";')) {
    source = replaceOnce(
      source,
      'import { ShoppingApp } from "@/components/shopping/shopping-app";',
      'import { ShoppingApp } from "@/components/shopping/shopping-app";\nimport { OfflineDateApp } from "@/components/offline/offline-date-app";',
      "desktop offline import",
    );
  }

  if (!source.includes('activeApp === "offline" &&')) {
    source = replaceOnce(
      source,
      '                {shoppingMounted && (',
      `                {activeApp === "offline" && (\n                  <section className="phone-app-pane">\n                    <OfflineDateApp onClose={() => setActiveApp(null)} />\n                  </section>\n                )}\n                {shoppingMounted && (`,
      "desktop offline render",
    );
  }
  write(rel, source);
}

function patchChatBusyContext() {
  const rel = "lib/chat-engine.ts";
  let source = read(rel);
  if (!source.includes('import { buildOfflineBusyPrompt } from "./offline-date-storage";')) {
    source = replaceOnce(
      source,
      'import { buildCharacterTimeContext } from "./character-time";',
      'import { buildCharacterTimeContext } from "./character-time";\nimport { buildOfflineBusyPrompt } from "./offline-date-storage";',
      "chat busy import",
    );
  }
  if (!source.includes("const offlineBusyPrompt = buildOfflineBusyPrompt")) {
    source = replaceOnce(
      source,
      '    if (promptProfile?.output === "plain_text") {',
      `    const offlineBusyPrompt = buildOfflineBusyPrompt(character.id, now);\n    if (offlineBusyPrompt) {\n        llmMessages.push({ role: "system", content: offlineBusyPrompt });\n    }\n\n    if (promptProfile?.output === "plain_text") {`,
      "chat busy context injection",
    );
  }
  write(rel, source);
}

patchWallet();
patchShopping();
patchDesktopShell();
patchChatBusyContext();
console.log("[patch-1989-offline-features] applied");
