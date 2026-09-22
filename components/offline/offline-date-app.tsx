"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, CalendarDays, CheckCircle2, Clock3, LoaderCircle, MapPin, UserRound, XCircle } from "lucide-react";

import { loadCharacters } from "@/lib/character-storage";
import { resolveUserIdentity } from "@/lib/settings-storage";
import { askCharacterToDecideOfflineInvitation } from "@/lib/offline-date-invitation";
import { generateOfflineDateOpening, sendOfflineDateMessage } from "@/lib/offline-date-chat";
import {
  appendOfflineDateTurn,
  endOfflineDateNow,
  loadOfflineDateTurns,
  startOfflineDateNow,
  type OfflineDateTurn,
} from "@/lib/offline-date-chat-storage";
import {
  DEFAULT_OFFLINE_ACTIVITIES,
  cancelOfflineInvitation,
  createOfflineInvitation,
  getCharacterBusyState,
  loadOfflineDateState,
  type OfflineActivity,
  type OfflineDateState,
  type OfflineInvitation,
} from "@/lib/offline-date-storage";

export type OfflineDateAppProps = {
  onClose: () => void;
};

function toDatetimeLocal(date: Date): string {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function defaultStartFor(activity: OfflineActivity): string {
  const date = new Date();
  date.setSeconds(0, 0);
  date.setMinutes(0);
  if (activity.timeTag === "night") {
    if (date.getHours() >= 19) date.setDate(date.getDate() + 1);
    date.setHours(19);
  } else {
    if (date.getHours() >= 11) date.setDate(date.getDate() + 1);
    date.setHours(10);
  }
  return toDatetimeLocal(date);
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusLabel(status: OfflineInvitation["status"]): string {
  if (status === "pending") return "等回应";
  if (status === "accepted") return "已约好";
  if (status === "active") return "正在约会";
  if (status === "completed") return "已结束";
  if (status === "declined") return "未答应";
  return "已取消";
}

function scenePalette(activityId: string): { sky: string; ground: string; accent: string; glow: string } {
  switch (activityId) {
    case "open-air-cinema-1989":
      return { sky: "#18243a", ground: "#40382f", accent: "#f1dd9a", glow: "rgba(236,217,151,.32)" };
    case "camping-1989":
      return { sky: "#536978", ground: "#506244", accent: "#e29b4a", glow: "rgba(229,142,58,.38)" };
    case "xinhua-bookstore-1989":
      return { sky: "#c9b89f", ground: "#80654f", accent: "#8b2e2e", glow: "rgba(255,244,214,.3)" };
    case "state-restaurant-1989":
      return { sky: "#d3b99d", ground: "#8b5f45", accent: "#a5342f", glow: "rgba(255,232,193,.34)" };
    default:
      return { sky: "#c8d0b3", ground: "#957454", accent: "#b43b2f", glow: "rgba(255,244,210,.32)" };
  }
}

function SceneIllustration({ activity, companionName }: { activity: OfflineActivity; companionName?: string }) {
  const colors = scenePalette(activity.id);
  return (
    <div
      aria-label={`${activity.title} 2D 场景`}
      style={{
        position: "relative",
        overflow: "hidden",
        height: 178,
        borderRadius: 22,
        background: colors.sky,
        border: "1px solid rgba(73,49,31,.14)",
        boxShadow: "inset 0 0 40px rgba(255,255,255,.16)",
      }}
    >
      <div style={{ position: "absolute", right: 22, top: 18, width: 36, height: 36, borderRadius: "50%", background: colors.accent, opacity: .72 }} />
      <div style={{ position: "absolute", left: -20, right: -20, bottom: -32, height: 98, borderRadius: "50% 50% 0 0", background: colors.ground }} />
      <div style={{ position: "absolute", left: 22, bottom: 40, fontSize: 50, filter: "saturate(.8)" }}>{activity.sceneEmoji}</div>
      <div style={{ position: "absolute", left: 83, bottom: 52, right: 18, color: activity.id === "open-air-cinema-1989" ? "#f8f0df" : "#3e3026" }}>
        <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: ".04em" }}>{activity.title}</div>
        <div style={{ marginTop: 6, fontSize: 12, opacity: .72 }}>{activity.sceneLabel}</div>
      </div>
      {companionName ? (
        <div style={{ position: "absolute", right: 14, bottom: 12, padding: "6px 10px", borderRadius: 999, background: "rgba(249,244,228,.88)", fontSize: 12, color: "#4f3d31", boxShadow: "0 4px 16px rgba(35,25,18,.12)" }}>
          和 {companionName} 一起
        </div>
      ) : null}
      <div style={{ position: "absolute", left: 12, top: 12, padding: "5px 8px", borderRadius: 999, background: "rgba(248,244,230,.72)", fontSize: 10, letterSpacing: ".08em", color: "#5e5145" }}>1989 · 2D 场景</div>
    </div>
  );
}

function Portrait({ src, name, side }: { src?: string | null; name: string; side: "left" | "right" }) {
  return (
    <div style={{ width: "43%", maxWidth: 180, minWidth: 118, alignSelf: "flex-end", textAlign: "center" }}>
      <div
        style={{
          position: "relative",
          height: 238,
          overflow: "hidden",
          borderRadius: "48% 48% 18px 18px",
          border: "1px solid rgba(255,255,255,.35)",
          background: side === "left" ? "rgba(120,56,47,.28)" : "rgba(61,69,48,.34)",
          boxShadow: "0 18px 38px rgba(28,20,14,.2)",
        }}
      >
        {src ? (
          <img src={src} alt={name} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center 20%" }} />
        ) : (
          <div style={{ width: "100%", height: "100%", display: "grid", placeItems: "center", fontSize: 54, fontWeight: 800, color: "rgba(255,255,255,.9)" }}>{name.slice(0, 1)}</div>
        )}
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: "28px 8px 9px", background: "linear-gradient(transparent, rgba(20,17,14,.62))", color: "#fffaf0", fontSize: 12, fontWeight: 800 }}>{name}</div>
      </div>
    </div>
  );
}

function DateScene({
  invitation,
  turns,
  generating,
  modelLabel,
  notice,
  draft,
  onDraftChange,
  onSend,
  onBack,
  onEnd,
}: {
  invitation: OfflineInvitation;
  turns: OfflineDateTurn[];
  generating: boolean;
  modelLabel: string;
  notice: string | null;
  draft: string;
  onDraftChange: (value: string) => void;
  onSend: () => void;
  onBack: () => void;
  onEnd: () => void;
}) {
  const activity = DEFAULT_OFFLINE_ACTIVITIES.find(item => item.id === invitation.activityId) ?? DEFAULT_OFFLINE_ACTIVITIES[0];
  const character = loadCharacters().find(item => item.id === invitation.characterId);
  const userIdentity = resolveUserIdentity(invitation.characterId, "chat") ?? resolveUserIdentity(invitation.characterId) ?? resolveUserIdentity();
  const userName = userIdentity?.name || "你";
  const userAvatar = userIdentity?.avatarUrl || null;
  const colors = scenePalette(activity.id);
  const ended = invitation.status === "completed" || invitation.status === "cancelled";

  return (
    <div style={{ height: "100%", minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden", background: "#171512", color: "#fffaf0", fontFamily: '"MiSans", system-ui, sans-serif' }}>
      <div style={{ flex: "1 1 auto", minHeight: 0, position: "relative", overflow: "hidden", background: `linear-gradient(180deg, ${colors.sky} 0%, ${colors.ground} 100%)` }}>
        <div style={{ position: "absolute", inset: 0, background: `radial-gradient(circle at 70% 18%, ${colors.glow}, transparent 34%), linear-gradient(180deg, transparent 45%, rgba(19,16,13,.55) 100%)` }} />
        <div style={{ position: "absolute", right: -25, top: 70, fontSize: 160, opacity: .09, filter: "grayscale(1)" }}>{activity.sceneEmoji}</div>
        <div style={{ position: "absolute", left: 14, right: 14, top: 12, zIndex: 4, display: "flex", alignItems: "center", gap: 10 }}>
          <button type="button" onClick={onBack} style={{ width: 34, height: 34, borderRadius: 12, border: "1px solid rgba(255,255,255,.18)", background: "rgba(20,17,14,.35)", color: "#fff", display: "grid", placeItems: "center", backdropFilter: "blur(10px)" }} aria-label="返回安排"><ArrowLeft size={18} /></button>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 850 }}>{activity.title}</div>
            <div style={{ marginTop: 2, fontSize: 10, opacity: .7 }}>{invitation.location} · {statusLabel(invitation.status)}</div>
          </div>
          {!ended ? <button type="button" onClick={onEnd} style={{ border: "1px solid rgba(255,255,255,.18)", borderRadius: 11, background: "rgba(20,17,14,.35)", color: "#fffaf0", padding: "7px 9px", fontSize: 10 }}>结束约会</button> : null}
        </div>

        <div style={{ position: "absolute", left: 16, right: 16, top: 70, bottom: 190, zIndex: 2, display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 10 }}>
          <Portrait src={userAvatar} name={userName} side="left" />
          <Portrait src={character?.avatar} name={invitation.characterName} side="right" />
        </div>

        <div style={{ position: "absolute", left: 12, right: 12, bottom: 10, zIndex: 5, borderRadius: 19, background: "rgba(248,241,226,.95)", color: "#302820", boxShadow: "0 16px 42px rgba(0,0,0,.25)", border: "1px solid rgba(255,255,255,.5)", overflow: "hidden" }}>
          <div style={{ maxHeight: 175, overflowY: "auto", padding: "12px 13px 6px" }}>
            {turns.length === 0 && generating ? (
              <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, opacity: .65 }}><LoaderCircle size={14} className="animate-spin" />{invitation.characterName} 正在进入场景……</div>
            ) : turns.length === 0 ? (
              <div style={{ fontSize: 12, opacity: .62 }}>约会场景已经准备好。</div>
            ) : (
              turns.slice(-10).map(turn => (
                <div key={turn.id} style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 10, fontWeight: 850, color: turn.role === "assistant" ? "#765236" : "#8b3d36" }}>{turn.role === "assistant" ? invitation.characterName : userName}</div>
                  <div style={{ marginTop: 3, whiteSpace: "pre-wrap", fontSize: 13, lineHeight: 1.62 }}>{turn.content}</div>
                </div>
              ))
            )}
            {generating && turns.length > 0 ? <div style={{ display: "flex", alignItems: "center", gap: 6, paddingBottom: 7, fontSize: 10, opacity: .5 }}><LoaderCircle size={12} className="animate-spin" />{invitation.characterName} 正在回应……</div> : null}
          </div>

          {!ended ? (
            <div style={{ display: "flex", alignItems: "flex-end", gap: 8, padding: "8px 9px 9px", borderTop: "1px solid rgba(67,49,35,.09)", background: "rgba(255,252,244,.92)" }}>
              <textarea
                value={draft}
                onChange={event => onDraftChange(event.target.value)}
                onKeyDown={event => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    onSend();
                  }
                }}
                placeholder="你想怎么回答，就自己写……"
                rows={1}
                disabled={generating}
                style={{ flex: 1, minHeight: 38, maxHeight: 92, resize: "vertical", boxSizing: "border-box", border: "1px solid rgba(70,50,34,.15)", borderRadius: 13, background: "#fffdf7", color: "#302820", padding: "9px 10px", font: "inherit", fontSize: 12, lineHeight: 1.45, outline: "none" }}
              />
              <button type="button" onClick={onSend} disabled={generating || !draft.trim()} style={{ height: 38, minWidth: 56, border: 0, borderRadius: 13, background: generating || !draft.trim() ? "#c7bcae" : "#6d4e38", color: "#fff", fontWeight: 800, fontSize: 12 }}>发送</button>
            </div>
          ) : (
            <div style={{ padding: "9px 12px", borderTop: "1px solid rgba(67,49,35,.09)", fontSize: 11, opacity: .58 }}>这次约会已经结束，对话记录会保留。</div>
          )}
        </div>
      </div>

      <div style={{ flex: "0 0 auto", display: "flex", justifyContent: "space-between", gap: 8, padding: "7px 10px", background: "#171512", fontSize: 9, opacity: .62 }}>
        <span>自由回复 · 不提供选项</span>
        <span>{modelLabel || "gemini-3.8-flash"}</span>
      </div>
      {notice ? <div style={{ position: "absolute", left: 14, right: 14, top: 56, zIndex: 8, padding: "9px 11px", borderRadius: 12, background: "rgba(43,34,28,.92)", color: "#fffaf0", fontSize: 11, boxShadow: "0 8px 24px rgba(0,0,0,.2)" }}>{notice}</div> : null}
    </div>
  );
}

export function OfflineDateApp({ onClose }: OfflineDateAppProps) {
  const [characters, setCharacters] = useState(() => loadCharacters());
  const [state, setState] = useState<OfflineDateState>(() => loadOfflineDateState());
  const [selectedActivityId, setSelectedActivityId] = useState(DEFAULT_OFFLINE_ACTIVITIES[0].id);
  const [selectedCharacterId, setSelectedCharacterId] = useState("");
  const [startTime, setStartTime] = useState(() => defaultStartFor(DEFAULT_OFFLINE_ACTIVITIES[0]));
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [activeInvitationId, setActiveInvitationId] = useState<string | null>(null);
  const [turns, setTurns] = useState<OfflineDateTurn[]>([]);
  const [draft, setDraft] = useState("");
  const [generating, setGenerating] = useState(false);
  const [modelLabel, setModelLabel] = useState("gemini-3.8-flash");

  const activity = DEFAULT_OFFLINE_ACTIVITIES.find(item => item.id === selectedActivityId) ?? DEFAULT_OFFLINE_ACTIVITIES[0];
  const selectedCharacter = characters.find(item => item.id === selectedCharacterId);
  const activeInvitation = activeInvitationId ? state.invitations.find(item => item.id === activeInvitationId) ?? null : null;

  useEffect(() => {
    setCharacters(loadCharacters());
    setState(loadOfflineDateState());
  }, []);

  useEffect(() => {
    setStartTime(defaultStartFor(activity));
    setNotice(null);
  }, [activity.id]);

  const relevantInvitations = useMemo(
    () => state.invitations.filter(item => item.status !== "cancelled").slice(0, 16),
    [state.invitations],
  );

  const activeCompanion = useMemo(() => {
    const accepted = state.invitations.find(item =>
      item.activityId === activity.id && (item.status === "accepted" || item.status === "active"),
    );
    return accepted?.characterName;
  }, [activity.id, state.invitations]);

  async function sendInvitation() {
    if (!selectedCharacter) {
      setNotice("先选一个要邀请的人。");
      return;
    }
    const busy = getCharacterBusyState(selectedCharacter.id, new Date(startTime));
    if (busy.busy) {
      setNotice(`${selectedCharacter.name} 那个时间已经在${busy.location ?? "别处"}，不能同时出现在两个地方。`);
      return;
    }

    setSending(true);
    setNotice(`正在把邀请交给${selectedCharacter.name}自己决定……`);
    try {
      const created = createOfflineInvitation({
        activityId: activity.id,
        characterId: selectedCharacter.id,
        characterName: selectedCharacter.name,
        startTime: new Date(startTime).toISOString(),
      });
      if (!created.ok || !created.invitation) throw new Error(created.error || "邀请创建失败。");
      const decision = await askCharacterToDecideOfflineInvitation(created.invitation);
      setState(loadOfflineDateState());
      setNotice(`${selectedCharacter.name}：${decision.reply}`);
    } catch (error) {
      setState(loadOfflineDateState());
      setNotice(error instanceof Error ? error.message : "邀请发送失败。");
    } finally {
      setSending(false);
    }
  }

  function cancelInvitation(id: string) {
    setState(cancelOfflineInvitation(id));
    setNotice("这次安排已经取消，角色的这段时间也会被释放。 ");
  }

  async function enterDate(invitation: OfflineInvitation) {
    setNotice(null);
    let current = invitation;
    if (invitation.status === "accepted") {
      const started = startOfflineDateNow(invitation.id);
      if (!started.ok || !started.invitation) {
        setNotice(started.error || "暂时不能开始这次约会。");
        return;
      }
      current = started.invitation;
      setState(loadOfflineDateState());
    }
    setActiveInvitationId(current.id);
    const existing = loadOfflineDateTurns(current.id);
    setTurns(existing);
    if (existing.length === 0 && current.status !== "completed") {
      setGenerating(true);
      try {
        const result = await generateOfflineDateOpening(current);
        setModelLabel(result.model || "gemini-3.8-flash");
        setTurns(loadOfflineDateTurns(current.id));
      } catch (error) {
        setNotice(error instanceof Error ? error.message : "约会开场生成失败。");
      } finally {
        setGenerating(false);
      }
    }
  }

  async function sendSceneMessage() {
    if (!activeInvitation || generating) return;
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    setNotice(null);
    setGenerating(true);
    try {
      const result = await sendOfflineDateMessage(activeInvitation, text);
      setModelLabel(result.model || "gemini-3.8-flash");
      setTurns(loadOfflineDateTurns(activeInvitation.id));
      setState(loadOfflineDateState());
    } catch (error) {
      // sendOfflineDateMessage stores the user's line before asking the model, so
      // keep that line visible even when the API fails.
      setTurns(loadOfflineDateTurns(activeInvitation.id));
      setNotice(error instanceof Error ? error.message : "角色回复失败，可以再发一句继续。 ");
    } finally {
      setGenerating(false);
    }
  }

  function endScene() {
    if (!activeInvitation) return;
    const ended = endOfflineDateNow(activeInvitation.id);
    if (!ended.ok) {
      setNotice(ended.error || "结束约会失败。");
      return;
    }
    setState(loadOfflineDateState());
    setNotice("这次约会已经结束，人物的时间占用已释放。 ");
  }

  if (activeInvitation) {
    const liveInvitation = state.invitations.find(item => item.id === activeInvitation.id) ?? activeInvitation;
    return (
      <DateScene
        invitation={liveInvitation}
        turns={turns}
        generating={generating}
        modelLabel={modelLabel}
        notice={notice}
        draft={draft}
        onDraftChange={setDraft}
        onSend={() => void sendSceneMessage()}
        onBack={() => {
          setActiveInvitationId(null);
          setDraft("");
          setNotice(null);
          setState(loadOfflineDateState());
        }}
        onEnd={endScene}
      />
    );
  }

  return (
    <div style={{ height: "100%", minHeight: 0, overflowY: "auto", background: "#f5f0e5", color: "#342b24", fontFamily: '"MiSans", system-ui, sans-serif' }}>
      <div style={{ position: "sticky", top: 0, zIndex: 3, display: "flex", alignItems: "center", gap: 10, padding: "14px 14px 10px", background: "rgba(245,240,229,.94)", backdropFilter: "blur(12px)", borderBottom: "1px solid rgba(74,52,35,.1)" }}>
        <button type="button" onClick={onClose} aria-label="返回桌面" style={{ width: 34, height: 34, display: "grid", placeItems: "center", border: 0, borderRadius: 12, background: "#e9dfcd", color: "#43362c" }}>
          <ArrowLeft size={19} />
        </button>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800 }}>线下</div>
          <div style={{ fontSize: 11, opacity: .58, marginTop: 1 }}>乙游式自由对话 · 不提供回复选项</div>
        </div>
      </div>

      <div style={{ padding: 14, display: "grid", gap: 14 }}>
        <SceneIllustration activity={activity} companionName={activeCompanion} />

        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 9 }}>
          {DEFAULT_OFFLINE_ACTIVITIES.map(item => {
            const selected = item.id === activity.id;
            return (
              <button key={item.id} type="button" onClick={() => setSelectedActivityId(item.id)} style={{ textAlign: "left", padding: 11, borderRadius: 16, border: selected ? "1px solid #8d6547" : "1px solid rgba(75,52,35,.1)", background: selected ? "#efe0c8" : "#fffaf0", color: "#3d3128" }}>
                <div style={{ fontSize: 22 }}>{item.sceneEmoji}</div>
                <div style={{ marginTop: 6, fontWeight: 750, fontSize: 13 }}>{item.title}</div>
                <div style={{ marginTop: 3, fontSize: 10, opacity: .58 }}>{item.durationMinutes} 分钟 · {item.location}</div>
              </button>
            );
          })}
        </div>

        <section style={{ padding: 14, borderRadius: 20, background: "#fffaf0", border: "1px solid rgba(75,52,35,.1)" }}>
          <div style={{ fontSize: 14, fontWeight: 800 }}>{activity.title}</div>
          <div style={{ marginTop: 7, fontSize: 12, lineHeight: 1.7, opacity: .74 }}>{activity.description}</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 10, fontSize: 11, opacity: .65 }}>
            <span style={{ display: "inline-flex", gap: 4, alignItems: "center" }}><MapPin size={12} />{activity.location}</span>
            <span style={{ display: "inline-flex", gap: 4, alignItems: "center" }}><Clock3 size={12} />约 {activity.durationMinutes} 分钟</span>
          </div>
        </section>

        <section style={{ padding: 14, borderRadius: 20, background: "#fffaf0", border: "1px solid rgba(75,52,35,.1)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, fontWeight: 800, fontSize: 14 }}><UserRound size={16} />邀请人物</div>
          {characters.length === 0 ? (
            <div style={{ marginTop: 12, fontSize: 12, opacity: .62 }}>还没有角色。先在“角色”里建立人物卡。</div>
          ) : (
            <div style={{ display: "flex", gap: 9, overflowX: "auto", padding: "12px 1px 4px" }}>
              {characters.map(character => {
                const selected = selectedCharacterId === character.id;
                return (
                  <button key={character.id} type="button" onClick={() => setSelectedCharacterId(character.id)} style={{ flex: "0 0 74px", padding: "8px 5px", borderRadius: 14, border: selected ? "1px solid #8d6547" : "1px solid rgba(75,52,35,.1)", background: selected ? "#efe0c8" : "#f8f1e5", color: "inherit" }}>
                    <div style={{ width: 42, height: 42, margin: "0 auto", overflow: "hidden", borderRadius: "50%", display: "grid", placeItems: "center", background: "#ddd0ba", fontSize: 18, fontWeight: 800 }}>
                      {character.avatar ? <img src={character.avatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : character.name.slice(0, 1)}
                    </div>
                    <div style={{ marginTop: 6, fontSize: 11, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{character.name}</div>
                  </button>
                );
              })}
            </div>
          )}

          <label style={{ display: "grid", gap: 6, marginTop: 13, fontSize: 11, opacity: .72 }}>
            <span style={{ display: "inline-flex", gap: 5, alignItems: "center" }}><CalendarDays size={13} />开始时间</span>
            <input type="datetime-local" value={startTime} onChange={event => setStartTime(event.target.value)} style={{ width: "100%", boxSizing: "border-box", borderRadius: 12, border: "1px solid rgba(75,52,35,.16)", background: "#f8f1e5", padding: "10px 11px", color: "#3d3128", font: "inherit" }} />
          </label>

          <button type="button" disabled={sending || !selectedCharacterId} onClick={() => void sendInvitation()} style={{ width: "100%", marginTop: 12, height: 42, border: 0, borderRadius: 14, background: sending || !selectedCharacterId ? "#c8bdac" : "#6f4f39", color: "#fffaf0", fontWeight: 800 }}>
            {sending ? <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}><LoaderCircle size={15} className="animate-spin" />等角色回应</span> : "发出邀请"}
          </button>
          <div style={{ marginTop: 8, fontSize: 10, lineHeight: 1.6, opacity: .55 }}>角色先依据人设与当前关系决定是否赴约；答应后进入场景，你自己输入每一句回复。场景对话走 Gemini 3.8 Flash。</div>
        </section>

        {notice ? <div style={{ padding: "11px 13px", borderRadius: 14, background: "#eadfce", fontSize: 11, lineHeight: 1.55 }}>{notice}</div> : null}

        <section style={{ paddingBottom: 16 }}>
          <div style={{ margin: "2px 2px 9px", fontSize: 13, fontWeight: 800 }}>最近安排</div>
          <div style={{ display: "grid", gap: 8 }}>
            {relevantInvitations.length === 0 ? (
              <div style={{ padding: 18, textAlign: "center", borderRadius: 16, border: "1px dashed rgba(75,52,35,.18)", fontSize: 11, opacity: .55 }}>还没有线下安排</div>
            ) : relevantInvitations.map(invitation => {
              const activityItem = DEFAULT_OFFLINE_ACTIVITIES.find(item => item.id === invitation.activityId);
              const canCancel = invitation.status === "pending" || invitation.status === "accepted" || invitation.status === "active";
              const canEnter = invitation.status === "accepted" || invitation.status === "active" || invitation.status === "completed";
              const positive = invitation.status === "accepted" || invitation.status === "active" || invitation.status === "completed";
              return (
                <div key={invitation.id} style={{ padding: 12, borderRadius: 16, background: "#fffaf0", border: "1px solid rgba(75,52,35,.1)" }}>
                  <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <div style={{ fontSize: 24 }}>{activityItem?.sceneEmoji ?? "🗓️"}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 800 }}>
                        {invitation.characterName} · {activityItem?.title ?? invitation.location}
                        {positive ? <CheckCircle2 size={13} /> : invitation.status === "declined" ? <XCircle size={13} /> : null}
                      </div>
                      <div style={{ marginTop: 4, fontSize: 10, opacity: .58 }}>{formatDateTime(invitation.startTime)} · {statusLabel(invitation.status)}</div>
                    </div>
                    <div style={{ display: "flex", gap: 5 }}>
                      {canEnter ? <button type="button" onClick={() => void enterDate(invitation)} style={{ border: 0, borderRadius: 10, background: "#6f4f39", padding: "7px 9px", color: "#fffaf0", fontSize: 10, fontWeight: 800 }}>{invitation.status === "completed" ? "回看" : invitation.status === "active" ? "继续" : "开始"}</button> : null}
                      {canCancel ? <button type="button" onClick={() => cancelInvitation(invitation.id)} style={{ border: 0, borderRadius: 10, background: "#eee2d1", padding: "7px 8px", color: "#655344", fontSize: 10 }}>取消</button> : null}
                    </div>
                  </div>
                  {invitation.responseText ? <div style={{ marginTop: 9, paddingTop: 9, borderTop: "1px solid rgba(75,52,35,.08)", fontSize: 11, lineHeight: 1.55, opacity: .74 }}>“{invitation.responseText}”</div> : null}
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
