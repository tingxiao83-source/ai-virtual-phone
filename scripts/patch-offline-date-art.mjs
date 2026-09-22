import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const rel = "components/offline/offline-date-app.tsx";
const file = path.join(root, rel);
let source = fs.readFileSync(file, "utf8");

if (source.includes("OFFLINE_DATE_ART_V3")) {
  console.log("[patch-offline-date-art] already applied");
  process.exit(0);
}

// Avoid stacking on a checkout that was already mutated by an older build.
if (source.includes("OFFLINE_DATE_ART_V1") || source.includes("OFFLINE_DATE_ART_V2")) {
  console.log("[patch-offline-date-art] older art patch already present; skipping duplicate patch");
  process.exit(0);
}

const helper = `
// OFFLINE_DATE_ART_V3: lightweight visual-novel art + expression sprites.
function offlineDateSceneArt(activityId: string): Record<string, string> {
  if (activityId !== "open-air-cinema-1989") return {};
  return {
    backgroundImage: 'url("/offline-date/cinema.webp")',
    backgroundSize: "cover",
    backgroundPosition: "center center",
    backgroundRepeat: "no-repeat",
  };
}

function offlineDateCharacterSprite(name: string): string | undefined {
  return /陆承/.test(name) ? "/offline-date/lucheng-expressions.webp" : undefined;
}

function offlineDateSpritePosition(kind: "user" | "lucheng", emotion: string): string {
  const userMap: Record<string, string> = {
    smile: "0% center",
    shy: "33.333% center",
    sad: "66.666% center",
    angry: "100% center",
  };
  const luMap: Record<string, string> = {
    calm: "0% center",
    frown: "33.333% center",
    warm: "66.666% center",
    smile: "66.666% center",
    weary: "100% center",
  };
  return (kind === "user" ? userMap[emotion] : luMap[emotion]) ?? "0% center";
}

function inferOfflineDateUserExpression(turns: OfflineDateTurn[]): string {
  const text = [...turns].reverse().find(turn => turn.role === "user")?.content ?? "";
  if (/(生气|讨厌|烦|别这样|不理你|😡|气死)/.test(text)) return "angry";
  if (/(委屈|难过|伤心|想哭|哭了|😢)/.test(text)) return "sad";
  if (/(害羞|脸红|不好意思|羞|🙈|🥺)/.test(text)) return "shy";
  return "smile";
}

`;

const sceneAnchor = "function SceneIllustration({ activity, companionName }";
if (!source.includes(sceneAnchor)) throw new Error("Missing SceneIllustration anchor");
source = source.replace(sceneAnchor, helper + sceneAnchor);

// Let the activity preview card use the real cinema background too.
const previewNeedle = "const colors = scenePalette(activity.id);\n  return (";
if (!source.includes(previewNeedle)) throw new Error("Missing scene preview anchor");
source = source.replace(
  previewNeedle,
  'const colors = scenePalette(activity.id);\n  const artStyle = offlineDateSceneArt(activity.id);\n  return (',
);
source = source.replace('background: colors.sky,', 'background: colors.sky, ...artStyle,');

const portraitPattern = /function Portrait\([\s\S]*?\n}\n\nfunction DateScene/;
if (!portraitPattern.test(source)) throw new Error("Missing Portrait block");
const portraitReplacement = `function Portrait({
  src,
  name,
  side,
  spriteSrc,
  spriteKind,
  emotion = "calm",
}: {
  src?: string | null;
  name: string;
  side: "left" | "right";
  spriteSrc?: string;
  spriteKind?: "user" | "lucheng";
  emotion?: string;
}) {
  const isSprite = Boolean(spriteSrc && spriteKind);
  const isStageArt = Boolean(src?.startsWith("/offline-date/"));
  return (
    <div style={{ width: "46%", maxWidth: 205, minWidth: 120, alignSelf: "flex-end", textAlign: "center" }}>
      <div
        style={{
          position: "relative",
          height: isSprite ? 286 : isStageArt ? 300 : 250,
          overflow: "hidden",
          borderRadius: isSprite ? 18 : isStageArt ? 14 : "48% 48% 18px 18px",
          border: "1px solid rgba(255,255,255,.18)",
          background: side === "left" ? "rgba(120,56,47,.18)" : "rgba(61,69,48,.22)",
          boxShadow: "0 16px 34px rgba(0,0,0,.18)",
          transition: "transform .2s ease, filter .2s ease",
        }}
      >
        {isSprite ? (
          <div
            role="img"
            aria-label={name}
            style={{
              width: "100%",
              height: "100%",
              backgroundImage: "url(" + spriteSrc + ")",
              backgroundSize: "400% 100%",
              backgroundPosition: offlineDateSpritePosition(spriteKind!, emotion),
              backgroundRepeat: "no-repeat",
              transition: "background-position .18s ease",
            }}
          />
        ) : src ? (
          <img
            src={src}
            alt={name}
            style={{
              width: "100%",
              height: "100%",
              objectFit: isStageArt ? "contain" : "cover",
              objectPosition: isStageArt ? "center bottom" : "center 20%",
            }}
          />
        ) : (
          <div style={{ width: "100%", height: "100%", display: "grid", placeItems: "center", fontSize: 54, fontWeight: 800, color: "rgba(255,255,255,.9)" }}>{name.slice(0, 1)}</div>
        )}
        {!isSprite && !isStageArt ? <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: "28px 8px 9px", background: "linear-gradient(transparent, rgba(20,17,14,.62))", color: "#fffaf0", fontSize: 12, fontWeight: 800 }}>{name}</div> : null}
      </div>
    </div>
  );
}

function DateScene`;
source = source.replace(portraitPattern, portraitReplacement);

const emotionAnchor = 'const colors = scenePalette(activity.id);\n  const ended = invitation.status === "completed" || invitation.status === "cancelled";';
if (!source.includes(emotionAnchor)) throw new Error("Missing DateScene emotion anchor");
source = source.replace(
  emotionAnchor,
  'const colors = scenePalette(activity.id);\n  const latestAssistantEmotion = [...turns].reverse().find(turn => turn.role === "assistant")?.emotion ?? "calm";\n  const latestUserEmotion = inferOfflineDateUserExpression(turns);\n  const ended = invitation.status === "completed" || invitation.status === "cancelled";',
);

const bgNeedle = 'background: `linear-gradient(180deg, ${colors.sky} 0%, ${colors.ground} 100%)`';
if (!source.includes(bgNeedle)) throw new Error("Missing date-scene background anchor");
source = source.replace(
  bgNeedle,
  'background: `linear-gradient(180deg, ${colors.sky} 0%, ${colors.ground} 100%)`, ...offlineDateSceneArt(activity.id)',
);

const userNeedle = '<Portrait src={userAvatar} name={userName} side="left" />';
if (!source.includes(userNeedle)) throw new Error("Missing user portrait anchor");
source = source.replace(
  userNeedle,
  '<Portrait src={userAvatar || "/offline-date/user.webp"} name={userName} side="left" spriteSrc="/offline-date/user-expressions.webp" spriteKind="user" emotion={latestUserEmotion} />',
);

const charNeedle = '<Portrait src={character?.avatar} name={invitation.characterName} side="right" />';
if (!source.includes(charNeedle)) throw new Error("Missing character portrait anchor");
source = source.replace(
  charNeedle,
  '<Portrait src={character?.avatar} name={invitation.characterName} side="right" spriteSrc={offlineDateCharacterSprite(invitation.characterName)} spriteKind={/陆承/.test(invitation.characterName) ? "lucheng" : undefined} emotion={latestAssistantEmotion} />',
);

// Photo background has enough detail. Replace the giant decorative emoji with a
// subtle dark veil so dialogue and portraits remain readable.
source = source.replace(
  '<div style={{ position: "absolute", right: -25, top: 70, fontSize: 160, opacity: .09, filter: "grayscale(1)" }}>{activity.sceneEmoji}</div>',
  '<div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(0,0,0,.04), rgba(0,0,0,.28))", pointerEvents: "none" }} />',
);

fs.writeFileSync(file, source, "utf8");
console.log("[patch-offline-date-art] applied V3");
