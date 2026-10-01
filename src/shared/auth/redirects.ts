/**
 * Validates and sanitizes a callback redirect URL to prevent Open Redirect vulnerabilities.
 * Arbitrary external URLs, protocol-relative URLs (//evil.com), and dangerous schemes are rejected.
 *
 * @param callbackUrl The candidate redirect URL
 * @param fallback The fallback relative path (default: '/dashboard')
 * @returns A safe relative path
 */
export function sanitizeCallbackUrl(
  callbackUrl: string | null | undefined,
  fallback: string = "/dashboard"
): string {
  if (!callbackUrl || typeof callbackUrl !== "string") {
    return fallback;
  }

  const trimmed = callbackUrl.trim();
  if (!trimmed) {
    return fallback;
  }

  // Reject protocol-relative URLs (e.g., //attacker.com, /\attacker.com)
  if (trimmed.startsWith("//") || trimmed.startsWith("/\\")) {
    return fallback;
  }

  // Reject javascript:, data:, vbscript: schemes
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed) && !trimmed.startsWith("http://") && !trimmed.startsWith("https://")) {
    return fallback;
  }

  // Allow standard relative paths starting with a single '/'
  if (trimmed.startsWith("/") && !trimmed.startsWith("//") && !trimmed.includes("\\")) {
    // Ensure there is no embedded protocol like /https://evil.com or /:80
    if (!trimmed.slice(1).includes(":")) {
      return trimmed;
    }
  }

  // Check if it's an absolute URL
  try {
    const parsed = new URL(trimmed);
    const appOrigin = process.env.NEXT_PUBLIC_APP_URL || process.env.BETTER_AUTH_URL;
    if (!appOrigin) return fallback;
    const allowedOrigins = [
      new URL(appOrigin).origin,
      "http://localhost:3000",
      "http://127.0.0.1:3000",
    ];

    if (allowedOrigins.includes(parsed.origin)) {
      return parsed.pathname + parsed.search + parsed.hash;
    }
  } catch {
    // Malformed URL, fallback to default
    return fallback;
  }

  return fallback;
}
