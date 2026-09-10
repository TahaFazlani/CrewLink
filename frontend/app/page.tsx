"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import {
  ApiError,
  Announcement,
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
  login as apiLogin,
  patchAnnouncement,
  sendAnnouncement,
  setSession,
} from "../lib/api";

const POLL_MS = 4000;

export default function Home() {
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
  const [loadId, setLoadId] = useState(
    "b626bc32-066e-4659-b536-e2056305f946",
  );

  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const [aiError, setAiError] = useState("");
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const storedToken = getToken();
    const storedMember = getMember();
    setToken(storedToken);
    setMember(storedMember);
    setReady(true);
  }, []);

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
    } catch (err) {
      setLoginError(err instanceof ApiError ? err.message : "Login failed");
    }
  }

  function onLogout() {
    clearSession();
    setToken(null);
    setMember(null);
    setAnnouncement(null);
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
    setBusy(true);
    try {
      const row = await aiDraft(note.trim());
      applyAnnouncement(row);
    } catch (err) {
      if (err instanceof ApiError && (err.status === 503 || err.status === 504)) {
        setAiError(
          `AI draft failed (${err.status}): ${err.message}. You can still write the title and body yourself, approve, and send.`,
        );
      } else {
        setAiError(err instanceof Error ? err.message : "AI draft failed");
      }
    } finally {
      setBusy(false);
    }
  }

  async function onApprove() {
    setFormError("");
    setAiError("");
    if (!title.trim() || !body.trim()) {
      setFormError("Title and body are required before approve.");
      return;
    }
    setBusy(true);
    try {
      const draft = await persistDraftIfNeeded();
      const approved = await approveAnnouncement(draft.id);
      applyAnnouncement(approved);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Approve failed");
    } finally {
      setBusy(false);
    }
  }

  async function onSend() {
    setFormError("");
    if (!announcement || announcement.status !== "approved") {
      setFormError("Approve the announcement before sending.");
      return;
    }
    setBusy(true);
    try {
      await sendAnnouncement(announcement.id, classification || undefined);
      applyAnnouncement(await getAnnouncement(announcement.id));
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Send failed");
    } finally {
      setBusy(false);
    }
  }

  async function onLoadExisting(event: FormEvent) {
    event.preventDefault();
    setFormError("");
    setAiError("");
    setBusy(true);
    try {
      const row = await getAnnouncement(loadId.trim());
      applyAnnouncement(row);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not load announcement");
    } finally {
      setBusy(false);
    }
  }

  if (!ready) {
    return <main>Loading…</main>;
  }

  if (!token || !member) {
    return (
      <main>
        <h1>CrewLink leadership</h1>
        <form onSubmit={onLogin}>
          <p>
            <label>
              Email
              <br />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="username"
              />
            </label>
          </p>
          <p>
            <label>
              Password
              <br />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </label>
          </p>
          {loginError ? <p>{loginError}</p> : null}
          <button type="submit">Log in</button>
        </form>
      </main>
    );
  }

  const status = announcement?.status ?? "new";
  const canEdit = !announcement || announcement.status === "draft";
  const canSend = announcement?.status === "approved";
  const showCounts =
    announcement &&
    (announcement.status === "sent" || announcement.status === "approved");

  return (
    <main>
      <h1>CrewLink leadership</h1>
      <p>
        Signed in as {member.fullName} ({member.role})
        {" · "}
        <button type="button" onClick={onLogout}>
          Log out
        </button>
      </p>
      {member.role !== "leadership" ? (
        <p>
          This screen is for leadership. Member logins will get 403 on draft,
          approve, and send.
        </p>
      ) : null}
      <p>
        <strong>Local:</strong> {localName || "…"} ({member.localId})
      </p>
      <p>
        This page always uses the local on your login record. There is no
        picker for other locals — the API never trusts a client-supplied
        local_id (Rule 1), so choosing another local here would not change
        who can see the data.
      </p>

      <form onSubmit={onLoadExisting}>
        <label>
          Open existing announcement id
          <br />
          <input
            value={loadId}
            onChange={(e) => setLoadId(e.target.value)}
            size={40}
          />
        </label>{" "}
        <button type="submit">Load</button>
      </form>

      <hr />

      <p>
        <label>
          Messy note (optional)
          <br />
          <textarea
            rows={3}
            cols={60}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </label>
      </p>
      <p>
        <button type="button" onClick={onAiDraft} disabled={busy}>
          Draft with AI
        </button>
      </p>
      {aiError ? <p>{aiError}</p> : null}

      <p>
        <label>
          Title
          <br />
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={!canEdit}
            size={60}
          />
        </label>
      </p>
      <p>
        <label>
          Body
          <br />
          <textarea
            rows={8}
            cols={60}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            disabled={!canEdit}
          />
        </label>
      </p>
      <p>
        <label>
          Push preview (≤120 characters)
          <br />
          <input
            value={preview}
            onChange={(e) => setPreview(e.target.value)}
            disabled={!canEdit}
            maxLength={120}
            size={60}
          />
        </label>
      </p>
      <p>
        <label>
          <input
            type="checkbox"
            checked={needsAck}
            onChange={(e) => setNeedsAck(e.target.checked)}
            disabled={!canEdit}
          />{" "}
          Needs acknowledgement
        </label>
      </p>
      <p>
        <label>
          Classification filter (send only; omit for all active members)
          <br />
          <select
            value={classification}
            onChange={(e) => setClassification(e.target.value)}
            disabled={announcement?.status === "sent"}
          >
            <option value="">All active members</option>
            {CLASSIFICATIONS.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
      </p>

      <p>
        Status: {status}
        {announcement ? ` · id ${announcement.id}` : null}
      </p>
      {formError ? <p>{formError}</p> : null}
      <p>
        <button
          type="button"
          onClick={onApprove}
          disabled={busy || announcement?.status === "approved" || announcement?.status === "sent"}
        >
          Approve
        </button>{" "}
        <button type="button" onClick={onSend} disabled={busy || !canSend}>
          Send
        </button>
      </p>

      {showCounts && announcement ? (
        <section>
          <h2>Counts</h2>
          <p>Sent: {announcement.sentCount}</p>
          <p>Read: {announcement.readCount}</p>
          <p>Acknowledged: {announcement.acknowledgedCount}</p>
          {announcement.status === "sent" ? (
            <p>Polling every 4 seconds (announcement row only, not recipients).</p>
          ) : null}
        </section>
      ) : null}
    </main>
  );
}
