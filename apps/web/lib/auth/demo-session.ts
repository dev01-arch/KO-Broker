/** Session flag after successful demo login (tab-scoped). */
export const AUTH_SESSION_KEY = 'ko-platform-authenticated';
export const AUTH_USERNAME_KEY = 'ko-platform-username';

export function getSessionUsername(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return sessionStorage.getItem(AUTH_USERNAME_KEY);
  } catch {
    return null;
  }
}

export function isAuthenticated(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return sessionStorage.getItem(AUTH_SESSION_KEY) === '1' && Boolean(getSessionUsername());
  } catch {
    return false;
  }
}

export function setAuthenticated(username: string): void {
  try {
    sessionStorage.setItem(AUTH_SESSION_KEY, '1');
    sessionStorage.setItem(AUTH_USERNAME_KEY, username);
  } catch {
    /* ignore */
  }
}

export function clearAuthenticated(): void {
  try {
    sessionStorage.removeItem(AUTH_SESSION_KEY);
    sessionStorage.removeItem(AUTH_USERNAME_KEY);
  } catch {
    /* ignore */
  }
}
