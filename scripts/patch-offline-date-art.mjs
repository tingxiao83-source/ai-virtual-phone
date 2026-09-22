import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const rel = "components/offline/offline-date-app.tsx";
const file = path.join(root, rel);
let source = fs.readFileSync(file, "utf8");

if (source.includes("OFFLINE_DATE_ART_V1")) {
  console.log("[patch-offline-date-art] already applied");
  process.exit(0);
}

const helper = `
// OFFLINE_DATE_ART_V1: generated visual-novel art assets for 1989 dates.
function offlineSceneSheetStyle(activityId: string): Record<string, string> {
  const positions: Record<string, string> = {
    "town-market-1989": "0% 0%",
    "open-air-cinema-1989": "100% 0%",
    "camping-1989": "0% 50%",
    "xinhua-bookstore-1989": "100% 50%",
    "state-restaurant-1989": "0% 100%",
  };
  return {
    backgroundImage: 'url("/offline-date/scenes-sheet.webp")',
    backgroundSize: "200% 300%",
    backgroundPosition: positions[activityId] ?? positions["town-market-1989"],
    backgroundRepeat: "no-repeat",
  };
}

function defaultOfflineDatePortrait(name: string, fallback?: string | null): string | null | undefined {
  if (/陆承/.test(name)) return "/offline-date/lucheng.webp";
  return fallback;
}

`;

const sceneAnchor = "function SceneIllustration({ activity, companionName }";
if (!source.includes(sceneAnchor)) throw new Error("Missing SceneIllustration anchor");
source = source.replace(sceneAnchor, helper + sceneAnchor);

const portraitPattern = /function Portrait\([\s\S]*?\n}\n\nfunction DateScene/;
if (!portraitPattern.test(source)) throw new Error("Missing Portrait block");
const portraitReplacement = `function Portrait({ src, name, side }: { src?: string | null; name: string; side: "left" | "right" }) {
  const isStageArt = Boolean(src?.startsWith("/offline-date/"));
  return (
    <div style={{ width: "47%", maxWidth: 214, minWidth: 125, alignSelf: "flex-end", textAlign: "center" }}>
      <div
        style={{
          position: "relative",
          height: isStageArt ? 318 : 250,
          overflow: "hidden",
          borderRadius: isStageArt ? 0 : "48% 48% 18px 18px",
          border: isStageArt ? "none" : "1px solid rgba(255,255,255,.35)",
          background: isStageArt ? "transparent" : side === "left" ? "rgba(120,56,47,.28)" : "rgba(61,69,48,.34)",
          boxShadow: isStageArt ? "none" : "0 18px 38px rgba(28,20,14,.2)",
          filter: side === "left" ? "drop-shadow(-4px 8px 10px rgba(0,0,0,.22))" : "drop-shadow(4px 8px 10px rgba(0,0,0,.22))",
        }}
      >
        {src ? (
          <img
            src={src}
            alt={name}
            style={{
              width: "100%",
              height: "100%",
              objectFit: isStageArt ? "contain" : "cover",
              objectPosition: isStageArt ? "center bottom" : "center 20%",
              transform: side === "left" && isStageArt ? "scaleX(-1)" : undefined,
            }}
          />
        ) : (
          <div style={{ width: "100%", height: "100%", display: "grid", placeItems: "center", fontSize: 54, fontWeight: 800, color: "rgba(255,255,255,.9)" }}>{name.slice(0, 1)}</div>
        )}
        {!isStageArt ? <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: "28px 8px 9px", background: "linear-gradient(transparent, rgba(20,17,14,.62))", color: "#fffaf0", fontSize: 12, fontWeight: 800 }}>{name}</div> : null}
      </div>
    </div>
  );
}

function DateScene`;
source = source.replace(portraitPattern, portraitReplacement);

const bgNeedle = 'background: `linear-gradient(180deg, ${colors.sky} 0%, ${colors.ground} 100%)`';
if (!source.includes(bgNeedle)) throw new Error("Missing date-scene background anchor");
source = source.replace(bgNeedle, 'background: `linear-gradient(180deg, ${colors.sky} 0%, ${colors.ground} 100%)`, ...offlineSceneSheetStyle(activity.id)');

const userNeedle = '<Portrait src={userAvatar} name={userName} side="left" />';
if (!source.includes(userNeedle)) throw new Error("Missing user portrait anchor");
source = source.replace(userNeedle, '<Portrait src={userAvatar || "/offline-date/user.webp"} name={userName} side="left" />');

const charNeedle = '<Portrait src={character?.avatar} name={invitation.characterName} side="right" />';
if (!source.includes(charNeedle)) throw new Error("Missing character portrait anchor");
source = source.replace(charNeedle, '<Portrait src={defaultOfflineDatePortrait(invitation.characterName, character?.avatar)} name={invitation.characterName} side="right" />');

// The photo backgrounds carry enough visual information; keep the existing lighting overlay
// but remove the giant emoji that would sit over the character art.
source = source.replace(
  '<div style={{ position: "absolute", right: -25, top: 70, fontSize: 160, opacity: .09, filter: "grayscale(1)" }}>{activity.sceneEmoji}</div>',
  '<div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(0,0,0,.04), rgba(0,0,0,.30))", pointerEvents: "none" }} />',
);

fs.writeFileSync(file, source, "utf8");
console.log("[patch-offline-date-art] applied");
