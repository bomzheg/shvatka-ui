import {HttpErrorResponse} from "@angular/common/http";

/**
 * The error body the backend returns for a refused request (an SHError).
 *
 * `docUrl` is a link to the documentation page explaining the rule that was
 * broken; the backend builds it from its own configuration, and only some
 * errors have one.
 */
export interface ApiError {
  type: string;
  text: string;
  description: string;
  docUrl: string | null;
}

/** Reads the backend error body out of a failed response, if it has one. */
export function readApiError(error: unknown): ApiError | null {
  const body = error instanceof HttpErrorResponse ? error.error : (error as {error?: unknown})?.error;
  if (!body || typeof body !== "object") return null;
  const raw = body as Record<string, unknown>;
  return {
    type: typeof raw["type"] === "string" ? raw["type"] : "",
    text: typeof raw["text"] === "string" ? raw["text"] : "",
    description: typeof raw["description"] === "string" ? raw["description"] : "",
    docUrl: readDocUrl(raw["docUrl"]),
  };
}

/** The documentation link of a failed response, when it carries a usable one. */
export function readDocUrl(value: unknown): string | null {
  return typeof value === "string" && isSafeDocUrl(value) ? value : null;
}

/**
 * Only http(s) links are ever opened: the url comes from a response body, and
 * `javascript:` in a `window.open` would run in our own origin.
 */
export function isSafeDocUrl(url: string | null | undefined): url is string {
  if (!url) return false;
  try {
    const protocol = new URL(url, window.location.href).protocol;
    return protocol === "https:" || protocol === "http:";
  } catch {
    return false;
  }
}
