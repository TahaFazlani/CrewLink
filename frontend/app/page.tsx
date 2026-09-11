"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useState } from "react";
import {
  ApiError,
  Announcement,
  AnnouncementListItem,
  CLASSIFICATIONS,
  MemberSession,
  aiDraft,
  approveAnnouncement,
  clearSession,
  createAnnouncement,
  getAnnouncement,
  getLocal,
  getMember,
  getToken,
  listAnnouncements,
  login as apiLogin,
  patchAnnouncement,
  sendAnnouncement,
  setSession,
} from "../lib/api";

const POLL_MS = 4000;

const card = "rounded-lg border border-slate-200 bg-white shadow-sm";
const cardHead =
  "flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-3";
const cardTitle = "text-sm font-semibold text-slate-900";
const label = "text-sm font-semibold text-slate-800";
const hint = "text-xs text-slate-500";
const input =
  "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500";
const button =
  "rounded-md border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-800 transition hover:bg-slate-50 focus:ring-2 focus:ring-blue-100 focus:outline-none disabled:cursor-not-allowed disabled:opacity-55";
const buttonPrimary =
  "rounded-md border border-blue-600 bg-blue-600 px-3.5 py-2 text-sm font-medium text-white transition hover:bg-blue-700 focus:ring-2 focus:ring-blue-200 focus:outline-none disabled:cursor-not-allowed disabled:opacity-55";
const alertError =
  "rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800";

const statusBadge: Record<string, string> = {
  new: "bg-slate-100 text-slate-600",
  draft: "bg-amber-100 text-amber-800",
  approved: "bg-blue-100 text-blue-800",
  sent: "bg-emerald-100 text-emerald-800",
};

type Pending = "ai" | "approve" | "send" | "load" | null;

export default function Home() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [member, setMember] = useState<MemberSession | null>(null);
  const [localName, setLocalName] = useState<string>("");

  const [email, setEmail] = useState("leadership.27@crewlink.local");
  const [password, setPassword] = useState("password123");
  const [loginError, setLoginError] = useState("");

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [preview, setPreview] = useState("");
  const [note, setNote] = useState("");
  const [needsAck, setNeedsAck] = useState(false);
  const [classification, setClassification] = useState("");

  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const [announcementList, setAnnouncementList] = useState<
    AnnouncementListItem[]
  >([]);
  const [listError, setListError] = useState("");
  const [aiError, setAiError] = useState("");
  const [formError, setFormError] = useState("");
  const [pending, setPending] = useState<Pending>(null);
  const busy = pending !== null;

  useEffect(() => {
    setToken(getToken());
    setMember(getMember());
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) {
      return;
    }
    if (token && member?.role === "member") {
      router.replace("/member");
    }
  }, [ready, token, member?.role, router]);

  useEffect(() => {
    if (!token || !member) {
      return;
    }
    getLocal(member.localId)
      .then((local) => setLocalName(local.name))
      .catch(() => setLocalName(member.localId));
  }, [token, member]);

  const applyAnnouncement = useCallback((row: Announcement) => {
    setAnnouncement(row);
    setTitle(row.title);
    setBody(row.body);
    setPreview(row.notificationPreview ?? "");
    setNeedsAck(row.needsAck);
  }, []);

  const refreshAnnouncementList = useCallback(async () => {
    if (!token || member?.role !== "leadership") {
      setAnnouncementList([]);
      return;
    }
    try {
      setListError("");
      setAnnouncementList(await listAnnouncements());
    } catch (err) {
      setAnnouncementList([]);
      setListError(
        err instanceof Error ? err.message : "Could not load announcements",
      );
    }
  }, [token, member?.role]);

  useEffect(() => {
    void refreshAnnouncementList();
  }, [refreshAnnouncementList]);

  const announcementId = announcement?.id;
  const announcementStatus = announcement?.status;

  useEffect(() => {
    if (!announcementId || announcementStatus !== "sent") {
      return;
    }
    const tick = () => {
      getAnnouncement(announcementId)
        .then(applyAnnouncement)
        .catch(() => undefined);
    };
    const handle = window.setInterval(tick, POLL_MS);
    return () => window.clearInterval(handle);
  }, [announcementId, announcementStatus, applyAnnouncement]);

  async function onLogin(event: FormEvent) {
    event.preventDefault();
    setLoginError("");
    try {
      const result = await apiLogin(email, password);
      setSession(result.accessToken, result.member);
      setToken(result.accessToken);
      setMember(result.member);
      if (result.member.role === "member") {
        router.replace("/member");
      }
    } catch (err) {
      setLoginError(err instanceof ApiError ? err.message : "Login failed");
    }
  }

  function onLogout() {
    clearSession();
    setToken(null);
    setMember(null);
    setAnnouncement(null);
    setAnnouncementList([]);
    setListError("");
    setTitle("");
    setBody("");
    setPreview("");
    setNote("");
    setAiError("");
    setFormError("");
  }

  async function persistDraftIfNeeded(): Promise<Announcement> {
    if (announcement?.status === "draft") {
      return patchAnnouncement(announcement.id, {
        title,
        body,
        notificationPreview: preview || undefined,
        needsAck,
      });
    }
    if (announcement) {
      return announcement;
    }
    return createAnnouncement({
      title,
      body,
      notificationPreview: preview || undefined,
      needsAck,
    });
  }

  async function onAiDraft() {
    setAiError("");
    setFormError("");
    if (!note.trim()) {
      setAiError("Paste a messy note first.");
      return;
    }
    setPending("ai");
    try {
      applyAnnouncement(await aiDraft(note.trim()));
      await refreshAnnouncementList();
    } catch (err) {
      if (
        err instanceof ApiError &&
        (err.status === 503 || err.status === 504)
      ) {
        setAiError(
          `AI draft failed (${err.status}): ${err.message}. You can still write the title and body yourself, approve, and send.`,
        );
      } else {
        setAiError(err instanceof Error ? err.message : "AI draft failed");
      }
    } finally {
      setPending(null);
    }
  }

  async function onApprove() {
    setFormError("");
    setAiError("");
    if (!title.trim() || !body.trim()) {
      setFormError("Title and body are required before approve.");
      return;
    }
    setPending("approve");
    try {
      const draft = await persistDraftIfNeeded();
      applyAnnouncement(await approveAnnouncement(draft.id));
      await refreshAnnouncementList();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Approve failed");
    } finally {
      setPending(null);
    }
  }

  async function onSend() {
    setFormError("");
    if (!announcement || announcement.status !== "approved") {
      setFormError("Approve the announcement before sending.");
      return;
    }
    setPending("send");
    try {
      await sendAnnouncement(announcement.id, classification || undefined);
      applyAnnouncement(await getAnnouncement(announcement.id));
      await refreshAnnouncementList();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Send failed");
    } finally {
      setPending(null);
    }
  }

  async function onSelectAnnouncement(id: string) {
    setFormError("");
    setAiError("");
    setPending("load");
    try {
      applyAnnouncement(await getAnnouncement(id));
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Could not load announcement",
      );
    } finally {
      setPending(null);
    }
  }

  if (!ready) {
    return (
      <main className="grid min-h-screen place-items-center text-sm text-slate-500">
        Loading…
      </main>
    );
  }

  if (!token || !member) {
    return (
      <main className="grid min-h-screen place-items-center p-5">
        <div className="w-full max-w-sm">
          <div className="mb-4 text-center">
            <h1 className="text-2xl font-semibold tracking-tight">CrewLink</h1>
            <p className="mt-1 text-sm text-slate-500">
              Leadership sign-in. Announcements are scoped to your local.
            </p>
          </div>
          <form onSubmit={onLogin} className={card}>
            <div className="grid gap-4 p-5">
              <div className="grid gap-1.5">
                <label className={label} htmlFor="email">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  className={input}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="username"
                />
              </div>
              <div className="grid gap-1.5">
                <label className={label} htmlFor="password">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  className={input}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                />
              </div>
              {loginError ? <p className={alertError}>{loginError}</p> : null}
              <button type="submit" className={buttonPrimary}>
                Log in
              </button>
              <p className={`${hint} text-center`}>
                Member?{" "}
                <Link href="/member" className="text-blue-600 hover:underline">
                  Go to inbox
                </Link>
              </p>
            </div>
          </form>
        </div>
      </main>
    );
  }

  if (member.role !== "leadership") {
    return (
      <main className="grid min-h-screen place-items-center text-sm text-slate-500">
        Redirecting…
      </main>
    );
  }

  const status = announcement?.status ?? "new";
  const canEdit = !announcement || announcement.status === "draft";
  const canSend = announcement?.status === "approved";
  const isSent = announcement?.status === "sent";
  const showCounts = announcement && (isSent || canSend);

  const steps = [
    {
      label: "Draft",
      done: Boolean(announcement),
      current: !announcement,
    },
    {
      label: "Approve",
      done: canSend || isSent,
      current: announcement?.status === "draft",
    },
    { label: "Send", done: isSent, current: canSend },
  ];

  return (
    <div>
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-5 py-3">
          <div className="text-base font-semibold tracking-tight">
            CrewLink{" "}
            <span className="font-normal text-slate-400">/ Leadership</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right text-xs leading-tight">
              <span className="block font-semibold">{member.fullName}</span>
              <span className="text-slate-500">{member.role}</span>
            </div>
            <button type="button" className={button} onClick={onLogout}>
              Log out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-5 pt-6 pb-16">
        <div className="grid items-start gap-5 lg:grid-cols-[1.6fr_1fr]">
          <div className="grid gap-5">
            <section className={card}>
              <div className={cardHead}>
                <h2 className={cardTitle}>Draft with AI</h2>
                <span className={hint}>Optional</span>
              </div>
              <div className="grid gap-4 p-5">
                <div className="grid gap-1.5">
                  <label className={label} htmlFor="note">
                    Messy note
                  </label>
                  <textarea
                    id="note"
                    rows={3}
                    className={`${input} resize-y`}
                    placeholder="mtg thurs 6pm hall, vote on the new contract, bring your card"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />
                  <p className={hint}>
                    The AI only writes drafts. It never approves or sends.
                  </p>
                </div>
                <div>
                  <button
                    type="button"
                    className={button}
                    onClick={onAiDraft}
                    disabled={busy}
                  >
                    {pending === "ai" ? "Drafting…" : "Draft with AI"}
                  </button>
                </div>
                {aiError ? <p className={alertError}>{aiError}</p> : null}
              </div>
            </section>

            <section className={card}>
              <div className={cardHead}>
                <h2 className={cardTitle}>Announcement</h2>
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-bold tracking-wide uppercase ${statusBadge[status]}`}
                >
                  {status}
                </span>
              </div>
              <div className="grid gap-4 p-5">
                <div className="grid gap-1.5">
                  <label className={label} htmlFor="title">
                    Title
                  </label>
                  <input
                    id="title"
                    className={input}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    disabled={!canEdit}
                  />
                </div>
                <div className="grid gap-1.5">
                  <label className={label} htmlFor="body">
                    Body
                  </label>
                  <textarea
                    id="body"
                    rows={8}
                    className={`${input} resize-y`}
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    disabled={!canEdit}
                  />
                </div>
                <div className="grid gap-1.5">
                  <label className={label} htmlFor="preview">
                    Push preview
                  </label>
                  <input
                    id="preview"
                    className={input}
                    value={preview}
                    onChange={(e) => setPreview(e.target.value)}
                    disabled={!canEdit}
                    maxLength={120}
                  />
                  <p className={hint}>{preview.length}/120 characters</p>
                </div>
                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 accent-blue-600 disabled:cursor-not-allowed"
                    checked={needsAck}
                    onChange={(e) => setNeedsAck(e.target.checked)}
                    disabled={!canEdit}
                  />
                  Needs acknowledgement
                </label>
                <div className="grid gap-1.5">
                  <label className={label} htmlFor="classification">
                    Classification filter
                  </label>
                  <select
                    id="classification"
                    className={input}
                    value={classification}
                    onChange={(e) => setClassification(e.target.value)}
                    disabled={isSent}
                  >
                    <option value="">All active members</option>
                    {CLASSIFICATIONS.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                  <p className={hint}>
                    Applied at send time only; it is not stored on the
                    announcement.
                  </p>
                </div>

                {!canEdit && !isSent ? (
                  <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                    Approved announcements are locked. Send it, or start a new
                    draft to make changes.
                  </p>
                ) : null}
                {formError ? <p className={alertError}>{formError}</p> : null}

                <div className="flex flex-wrap items-center gap-2 border-t border-slate-200 pt-4">
                  <button
                    type="button"
                    className={button}
                    onClick={onApprove}
                    disabled={busy || canSend || isSent}
                  >
                    {pending === "approve" ? "Approving…" : "Approve"}
                  </button>
                  <button
                    type="button"
                    className={buttonPrimary}
                    onClick={onSend}
                    disabled={busy || !canSend}
                  >
                    {pending === "send" ? "Sending…" : "Send"}
                  </button>
                  {!canSend && !isSent ? (
                    <span className={hint}>
                      Send unlocks once the draft is approved.
                    </span>
                  ) : null}
                </div>
              </div>
            </section>
          </div>

          <div className="grid gap-5">
            <section className={card}>
              <div className={cardHead}>
                <h2 className={cardTitle}>Workflow</h2>
              </div>
              <div className="grid gap-4 p-5">
                <ol className="grid gap-2">
                  {steps.map((step, index) => (
                    <li
                      key={step.label}
                      className={`flex items-center gap-2.5 text-sm ${
                        step.done || step.current
                          ? "text-slate-900"
                          : "text-slate-500"
                      } ${step.current ? "font-semibold" : ""}`}
                    >
                      <span
                        className={`grid h-[1.375rem] w-[1.375rem] flex-none place-items-center rounded-full border text-[11px] font-bold ${
                          step.current
                            ? "border-blue-600 bg-blue-600 text-white"
                            : step.done
                              ? "border-emerald-600 bg-emerald-50 text-emerald-700"
                              : "border-slate-300 bg-white text-slate-500"
                        }`}
                      >
                        {step.done ? "✓" : index + 1}
                      </span>
                      {step.label}
                    </li>
                  ))}
                </ol>
                {announcement ? (
                  <p className="font-mono text-xs break-all text-slate-500">
                    id {announcement.id}
                  </p>
                ) : null}
              </div>
            </section>

            {showCounts && announcement ? (
              <section className={card}>
                <div className={cardHead}>
                  <h2 className={cardTitle}>Delivery</h2>
                  {isSent ? (
                    <span className="flex items-center gap-1.5 text-xs text-slate-500">
                      <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
                      live
                    </span>
                  ) : null}
                </div>
                <div className="grid gap-3 p-5">
                  <div className="grid grid-cols-3 gap-2.5">
                    {[
                      { label: "Sent", value: announcement.sentCount },
                      { label: "Read", value: announcement.readCount },
                      {
                        label: "Acked",
                        value: announcement.acknowledgedCount,
                      },
                    ].map((stat) => (
                      <div
                        key={stat.label}
                        className="rounded-md border border-slate-200 bg-slate-50/60 p-2.5 text-center"
                      >
                        <div className="text-xl font-semibold tabular-nums">
                          {stat.value}
                        </div>
                        <div className="text-[11px] tracking-wide text-slate-500 uppercase">
                          {stat.label}
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className={hint}>
                    {isSent
                      ? "Polling GET /announcements/:id every 4 seconds. Recipient rows are never queried from the browser."
                      : "Counters start moving once the announcement is sent."}
                  </p>
                </div>
              </section>
            ) : null}

            {member.role === "leadership" ? (
              <section className={card}>
                <div className={cardHead}>
                  <h2 className={cardTitle}>Announcements</h2>
                  <button
                    type="button"
                    className={`${button} py-1 text-xs`}
                    onClick={() => void refreshAnnouncementList()}
                    disabled={busy}
                  >
                    Refresh
                  </button>
                </div>
                <div className="grid gap-3 p-5">
                  {listError ? <p className={alertError}>{listError}</p> : null}
                  <div className="grid gap-1.5">
                    <label className={label} htmlFor="announcement-select">
                      Select announcement
                    </label>
                    <select
                      id="announcement-select"
                      className={input}
                      value={announcement?.id ?? ""}
                      onChange={(e) => {
                        const id = e.target.value;
                        if (id) {
                          void onSelectAnnouncement(id);
                        }
                      }}
                      disabled={busy || announcementList.length === 0}
                    >
                      <option value="">
                        {announcementList.length === 0
                          ? "No announcements yet"
                          : pending === "load"
                            ? "Loading…"
                            : "Choose an announcement…"}
                      </option>
                      {announcementList.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.title || "(untitled)"} · {item.status} ·{" "}
                          {item.sentCount} sent
                        </option>
                      ))}
                    </select>
                  </div>
                  <p className={hint}>
                    Pick an announcement to open it and watch delivery counters
                    without sending again.
                  </p>
                </div>
              </section>
            ) : null}

            {/* <section className={card}>
              <div className={cardHead}>
                <h2 className={cardTitle}>Local</h2>
              </div>
              <div className="grid gap-2 p-5">
                <p className="text-sm font-semibold">{localName || "…"}</p>
                <p className="font-mono text-xs break-all text-slate-500">
                  {member.localId}
                </p>
                <p className="text-xs leading-relaxed text-slate-600">
                  Read-only by design. There is no picker for other locals: the
                  API derives the local from your JWT and never trusts a
                  client-supplied <span className="font-mono">local_id</span>,
                  so a picker here could not change what you are allowed to
                  see.
                </p>
              </div>
            </section> */}
          </div>
        </div>
      </main>
    </div>
  );
}
