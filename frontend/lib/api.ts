const TOKEN_KEY = "crewlink.token";
const MEMBER_KEY = "crewlink.member";

export const CLASSIFICATIONS = [
  "Journeyman Wireman",
  "Apprentice 3rd Year",
  "Sheet Metal Worker",
  "Transit Operator",
] as const;

export type MemberSession = {
  id: string;
  localId: string;
  role: "member" | "leadership";
  fullName: string;
};

export type Announcement = {
  id: string;
  localId: string;
  title: string;
  body: string;
  notificationPreview: string | null;
  needsAck: boolean;
  status: "draft" | "approved" | "sent";
  sentAt: string | null;
  sentCount: number;
  readCount: number;
  acknowledgedCount: number;
};

function apiBase(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";
}

export function getToken(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  return localStorage.getItem(TOKEN_KEY);
}

export function getMember(): MemberSession | null {
  if (typeof window === "undefined") {
    return null;
  }
  const raw = localStorage.getItem(MEMBER_KEY);
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as MemberSession;
  } catch {
    return null;
  }
}

export function setSession(token: string, member: MemberSession): void {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(MEMBER_KEY, JSON.stringify(member));
}

export function clearSession(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(MEMBER_KEY);
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(
  path: string,
  options: RequestInit & { token?: string | null } = {},
): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const token = options.token === undefined ? getToken() : options.token;
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  const res = await fetch(`${apiBase()}${path}`, { ...options, headers });
  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text) as unknown;
    } catch {
      data = { message: text };
    }
  }
  if (!res.ok) {
    const message =
      typeof data === "object" &&
      data !== null &&
      "message" in data &&
      typeof (data as { message: unknown }).message === "string"
        ? (data as { message: string }).message
        : `Request failed (${res.status})`;
    throw new ApiError(res.status, message);
  }
  return data as T;
}

export function login(email: string, password: string) {
  return request<{ accessToken: string; member: MemberSession }>(
    "/auth/login",
    {
      method: "POST",
      body: JSON.stringify({ email, password }),
      token: null,
    },
  );
}

export function getLocal(id: string) {
  return request<{ id: string; name: string }>(`/locals/${id}`);
}

export function createAnnouncement(body: {
  title: string;
  body: string;
  notificationPreview?: string;
  needsAck?: boolean;
}) {
  return request<Announcement>("/announcements", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function aiDraft(note: string) {
  return request<Announcement>("/announcements/ai-draft", {
    method: "POST",
    body: JSON.stringify({ note }),
  });
}

export function getAnnouncement(id: string) {
  return request<Announcement>(`/announcements/${id}`);
}

export function patchAnnouncement(
  id: string,
  body: {
    title?: string;
    body?: string;
    notificationPreview?: string;
    needsAck?: boolean;
  },
) {
  return request<Announcement>(`/announcements/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function approveAnnouncement(id: string) {
  return request<Announcement>(`/announcements/${id}/approve`, {
    method: "POST",
  });
}

export function sendAnnouncement(id: string, classification?: string) {
  return request<Announcement>(`/announcements/${id}/send`, {
    method: "POST",
    body: JSON.stringify(classification ? { classification } : {}),
  });
}
