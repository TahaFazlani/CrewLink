export type MemberSession = {
  id: string;
  localId: string;
  role: 'member' | 'leadership';
  fullName: string;
};

const TOKEN_KEY = 'crewlink.token';
const MEMBER_KEY = 'crewlink.member';

export function getToken(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }
  return localStorage.getItem(TOKEN_KEY);
}

export function getMember(): MemberSession | null {
  if (typeof window === 'undefined') {
    return null;
  }
  const raw = localStorage.getItem(MEMBER_KEY);
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as MemberSession;
  } catch {
    clearSession();
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
