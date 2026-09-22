"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, CalendarDays, CheckCircle2, Clock3, LoaderCircle, MapPin, UserRound, XCircle } from "lucide-react";

import { loadCharacters } from "@/lib/character-storage";
import { askCharacterToDecideOfflineInvitation } from "@/lib/offline-date-invitation";
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

function scenePalette(activityId: string): { sky: string; ground: string; accent: string } {
  switch (activityId) {
    case "open-air-cinema-1989":
      return { sky: "#1f2a3a", ground: "#514537", accent: "#f1dd9a" };
    case "camping-1989":
      return { sky: "#b8d6c0", ground: "#6f8b63", accent: "#d9a45a" };
    case "xinhua-bookstore-1989":
      return { sky: "#d8c6aa", ground: "#9b7658", accent: "#8b2e2e" };
    case "state-restaurant-1989":
      return { sky: "#e3cbb0", ground: "#9f6d4e", accent: "#a5342f" };
    default:
      return { sky: "#d6dbc3", ground: "#a9835e", accent: "#b43b2f" };
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
      <div style={{ position: "absolute", left: 83, bottom: 52, right: 18, color: "#3e3026" }}>
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

export function OfflineDateApp({ onClose }: OfflineDateAppProps) {
  const [characters, setCharacters] = useState(() => loadCharacters());
  const [state, setState] = useState<OfflineDateState>(() => loadOfflineDateState());
  const [selectedActivityId, setSelectedActivityId] = useState(DEFAULT_OFFLINE_ACTIVITIES[0].id);
  const [selectedCharacterId, setSelectedCharacterId] = useState("");
  const [startTime, setStartTime] = useState(() => defaultStartFor(DEFAULT_OFFLINE_ACTIVITIES[0]));
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const activity = DEFAULT_OFFLINE_ACTIVITIES.find(item => item.id === selectedActivityId) ?? DEFAULT_OFFLINE_ACTIVITIES[0];
  const selectedCharacter = characters.find(item => item.id === selectedCharacterId);

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
      setNotice("先选一个要邀请的人。人类约会目前仍要求至少两个人参加。 ");
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

  return (
    <div style={{ height: "100%", minHeight: 0, overflowY: "auto", background: "#f5f0e5", color: "#342b24", fontFamily: '"MiSans", system-ui, sans-serif' }}>
      <div style={{ position: "sticky", top: 0, zIndex: 3, display: "flex", alignItems: "center", gap: 10, padding: "14px 14px 10px", background: "rgba(245,240,229,.94)", backdropFilter: "blur(12px)", borderBottom: "1px solid rgba(74,52,35,.1)" }}>
        <button type="button" onClick={onClose} aria-label="返回桌面" style={{ width: 34, height: 34, display: "grid", placeItems: "center", border: 0, borderRadius: 12, background: "#e9dfcd", color: "#43362c" }}>
          <ArrowLeft size={19} />
        </button>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800 }}>线下</div>
          <div style={{ fontSize: 11, opacity: .58, marginTop: 1 }}>见面会占用真实时间与地点</div>
        </div>
      </div>

      <div style={{ padding: 14, display: "grid", gap: 14 }}>
        <SceneIllustration activity={activity} companionName={activeCompanion} />

        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 9 }}>
          {DEFAULT_OFFLINE_ACTIVITIES.map(item => {
            const selected = item.id === activity.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setSelectedActivityId(item.id)}
                style={{
                  textAlign: "left",
                  padding: 11,
                  borderRadius: 16,
                  border: selected ? "1px solid #8d6547" : "1px solid rgba(75,52,35,.1)",
                  background: selected ? "#efe0c8" : "#fffaf0",
                  color: "#3d3128",
                }}
              >
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
          <div style={{ marginTop: 8, fontSize: 10, lineHeight: 1.6, opacity: .55 }}>角色会依据自己的人设、关系、最近聊天和剧情决定接受或拒绝，不会自动答应。</div>
        </section>

        {notice ? <div style={{ padding: "11px 13px", borderRadius: 14, background: "#e9dfcd", fontSize: 12, lineHeight: 1.6 }}>{notice}</div> : null}

        <section style={{ paddingBottom: 16 }}>
          <div style={{ margin: "2px 2px 9px", fontSize: 13, fontWeight: 800 }}>最近安排</div>
          <div style={{ display: "grid", gap: 8 }}>
            {relevantInvitations.length === 0 ? (
              <div style={{ padding: 18, textAlign: "center", borderRadius: 16, border: "1px dashed rgba(75,52,35,.18)", fontSize: 11, opacity: .55 }}>还没有线下安排</div>
            ) : relevantInvitations.map(invitation => {
              const activityItem = DEFAULT_OFFLINE_ACTIVITIES.find(item => item.id === invitation.activityId);
              const canCancel = invitation.status === "pending" || invitation.status === "accepted" || invitation.status === "active";
              const positive = invitation.status === "accepted" || invitation.status === "active" || invitation.status === "completed";
              return (
                <div key={invitation.id} style={{ padding: 12, borderRadius: 16, background: "#fffaf0", border: "1px solid rgba(75,52,35,.1)" }}>
                  <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <div style={{ fontSize: 24 }}>{activityItem?.sceneEmoji ?? "🗓️"}</div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 800 }}>
                        {invitation.characterName} · {activityItem?.title ?? invitation.location}
                        {positive ? <CheckCircle2 size={13} /> : invitation.status === "declined" ? <XCircle size={13} /> : null}
                      </div>
                      <div style={{ marginTop: 4, fontSize: 10, opacity: .58 }}>{formatDateTime(invitation.startTime)} · {statusLabel(invitation.status)}</div>
                    </div>
                    {canCancel ? <button type="button" onClick={() => cancelInvitation(invitation.id)} style={{ border: 0, borderRadius: 10, background: "#eee2d1", padding: "6px 8px", color: "#655344", fontSize: 10 }}>取消</button> : null}
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
