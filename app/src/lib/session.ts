/**
 * Session cookie utilities for "记住我" (Remember Me) feature.
 *
 * When rememberMe is false, a session cookie is set after login.
 * Session cookies have no Expires/Max-Age and are cleared when the browser
 * is fully closed (but persist across tabs within the same session).
 */

const COOKIE_NAME = 'auth_session';

function securePart(): string {
  return window.location.protocol === 'https:' ? '; Secure' : '';
}

/** Set a session cookie to indicate an active browser session. */
export function setSessionCookie(): void {
  document.cookie = `${COOKIE_NAME}=1; path=/; SameSite=Lax${securePart()}`;
}

/** Check if the session cookie exists. */
export function hasSessionCookie(): boolean {
  return document.cookie.split(';').some(c => c.trim().startsWith(`${COOKIE_NAME}=`));
}

/** Clear the session cookie. */
export function clearSessionCookie(): void {
  document.cookie = `${COOKIE_NAME}=; path=/; max-age=0`;
}
