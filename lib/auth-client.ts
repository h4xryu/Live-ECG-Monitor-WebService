// Client-side session storage for the browser dashboard. Separate from lib/auth.ts, which
// verifies tokens server-side — this just holds the JWT in the browser between page loads.
const TOKEN_KEY = "ecg_token"
const USERNAME_KEY = "ecg_username"

export function getToken(): string | null {
  if (typeof window === "undefined") return null
  return window.localStorage.getItem(TOKEN_KEY)
}

export function getUsername(): string | null {
  if (typeof window === "undefined") return null
  return window.localStorage.getItem(USERNAME_KEY)
}

export function saveSession(token: string, username: string) {
  if (typeof window === "undefined") return
  window.localStorage.setItem(TOKEN_KEY, token)
  window.localStorage.setItem(USERNAME_KEY, username)
}

export function clearSession() {
  if (typeof window === "undefined") return
  window.localStorage.removeItem(TOKEN_KEY)
  window.localStorage.removeItem(USERNAME_KEY)
}
