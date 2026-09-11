"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useState } from "react";
import {
  ApiError,
  MemberAnnouncement,
  MemberSession,
  acknowledgeMyAnnouncement,
  clearSession,
  getLocal,
  getMember,
  getMyAnnouncement,
  getToken,
  listMyAnnouncements,
  login as apiLogin,
  setSession,
} from "../../lib/api";

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

type Pending = "list" | "load" | "ack" | null;

function formatWhen(value: string | null): string {
  if (!value) {
    return "Not yet";
  }
  return new Date(value).toLocaleString();
}

export default function MemberInboxPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [member, setMember] = useState<MemberSession | null>(null);
  const [localName, setLocalName] = useState("");

  const [email, setEmail] = useState("member.27@crewlink.local");
  const [password, setPassword] = useState("password123");
  const [loginError, setLoginError] = useState("");

  const [inbox, setInbox] = useState<MemberAnnouncement[]>([]);
  const [selected, setSelected] = useState<MemberAnnouncement | null>(null);
  const [listError, setListError] = useState("");
  const [actionError, setActionError] = useState("");
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
    if (token && member?.role === "leadership") {
      router.replace("/");
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

  const refreshInbox = useCallback(async () => {
    if (!token || member?.role !== "member") {
      setInbox([]);
      return;
    }
    setPending("list");
    try {
      setListError("");
      setInbox(await listMyAnnouncements());
    } catch (err) {
      setInbox([]);
      setListError(
        err instanceof Error ? err.message : "Could not load inbox",
      );
    } finally {
      setPending(null);
    }
  }, [token, member?.role]);

  useEffect(() => {
    void refreshInbox();
  }, [refreshInbox]);

  async function onLogin(event: FormEvent) {
    event.preventDefault();
    setLoginError("");
    try {
      const result = await apiLogin(email, password);
      setSession(result.accessToken, result.member);
      setToken(result.accessToken);
      setMember(result.member);
      if (result.member.role === "leadership") {
        router.replace("/");
      }
    } catch (err) {
      setLoginError(err instanceof ApiError ? err.message : "Login failed");
    }
  }

  function onLogout() {
    clearSession();
    setToken(null);
    setMember(null);
    setInbox([]);
    setSelected(null);
    setListError("");
    setActionError("");
  }

  async function onSelectAnnouncement(id: string) {
    if (!id) {
      setSelected(null);
      return;
    }
    setActionError("");
    setPending("load");
    try {
      const row = await getMyAnnouncement(id);
      setSelected(row);
      setInbox((prev) =>
        prev.map((item) => (item.id === row.id ? row : item)),
      );
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Could not open announcement",
      );
    } finally {
      setPending(null);
    }
  }

  async function onAcknowledge() {
    if (!selected) {
      return;
    }
    setActionError("");
    setPending("ack");
    try {
      const row = await acknowledgeMyAnnouncement(selected.id);
      setSelected(row);
      setInbox((prev) =>
        prev.map((item) => (item.id === row.id ? row : item)),
      );
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Could not acknowledge",
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

  if (!token || !member || member.role !== "member") {
    return (
      <main className="grid min-h-screen place-items-center p-5">
        <div className="w-full max-w-sm">
          <div className="mb-4 text-center">
            <h1 className="text-2xl font-semibold tracking-tight">CrewLink</h1>
            <p className="mt-1 text-sm text-slate-500">
              Member inbox. Announcements sent to your local appear here.
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
                Leadership?{" "}
                <Link href="/" className="text-blue-600 hover:underline">
                  Go to compose
                </Link>
              </p>
            </div>
          </form>
        </div>
      </main>
    );
  }

  const needsAckPending =
    selected?.needsAck && !selected.acknowledgedAt;

  return (
    <div>
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-4 px-5 py-3">
          <div className="text-base font-semibold tracking-tight">
            CrewLink <span className="font-normal text-slate-400">/ Inbox</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right text-xs leading-tight">
              <span className="block font-semibold">{member.fullName}</span>
              <span className="text-slate-500">{localName || member.localId}</span>
            </div>
            <button type="button" className={button} onClick={onLogout}>
              Log out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 pt-6 pb-16">
        <div className="grid gap-5">
          <section className={card}>
            <div className={cardHead}>
              <h2 className={cardTitle}>Your announcements</h2>
              <button
                type="button"
                className={`${button} py-1 text-xs`}
                onClick={() => void refreshInbox()}
                disabled={busy}
              >
                Refresh
              </button>
            </div>
            <div className="grid gap-3 p-5">
              {listError ? <p className={alertError}>{listError}</p> : null}
              <div className="grid gap-1.5">
                <label className={label} htmlFor="inbox-select">
                  Select announcement
                </label>
                <select
                  id="inbox-select"
                  className={input}
                  value={selected?.id ?? ""}
                  onChange={(e) => void onSelectAnnouncement(e.target.value)}
                  disabled={busy || inbox.length === 0}
                >
                  <option value="">
                    {inbox.length === 0
                      ? "No announcements yet"
                      : pending === "load"
                        ? "Loading…"
                        : "Choose an announcement…"}
                  </option>
                  {inbox.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.title || "(untitled)"}
                      {item.needsAck && !item.acknowledgedAt ? " · ack required" : ""}
                      {item.readAt ? " · read" : " · unread"}
                    </option>
                  ))}
                </select>
              </div>
              <p className={hint}>
                Opening an announcement marks it as read and updates leadership
                counters.
              </p>
            </div>
          </section>

          {selected ? (
            <section className={card}>
              <div className={cardHead}>
                <h2 className={cardTitle}>{selected.title}</h2>
                {selected.needsAck ? (
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase ${
                      selected.acknowledgedAt
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {selected.acknowledgedAt ? "Acknowledged" : "Ack required"}
                  </span>
                ) : null}
              </div>
              <div className="grid gap-4 p-5">
                {selected.notificationPreview ? (
                  <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                    {selected.notificationPreview}
                  </p>
                ) : null}
                <div className="whitespace-pre-wrap text-sm leading-relaxed text-slate-800">
                  {selected.body}
                </div>
                <dl className="grid gap-2 border-t border-slate-200 pt-4 text-xs text-slate-600">
                  <div className="flex justify-between gap-3">
                    <dt>Delivery</dt>
                    <dd className="font-medium capitalize text-slate-800">
                      {selected.recipientStatus}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt>Read</dt>
                    <dd className="font-medium text-slate-800">
                      {formatWhen(selected.readAt)}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt>Acknowledged</dt>
                    <dd className="font-medium text-slate-800">
                      {formatWhen(selected.acknowledgedAt)}
                    </dd>
                  </div>
                </dl>
                {actionError ? <p className={alertError}>{actionError}</p> : null}
                {needsAckPending ? (
                  <button
                    type="button"
                    className={buttonPrimary}
                    onClick={() => void onAcknowledge()}
                    disabled={busy}
                  >
                    {pending === "ack" ? "Acknowledging…" : "Acknowledge"}
                  </button>
                ) : selected.needsAck && selected.acknowledgedAt ? (
                  <p className={hint}>You have acknowledged this announcement.</p>
                ) : null}
              </div>
            </section>
          ) : null}
        </div>
      </main>
    </div>
  );
}
