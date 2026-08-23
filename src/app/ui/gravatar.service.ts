import {Injectable} from "@angular/core";

const GRAVATAR_BASE = "https://gravatar.com/avatar";

/**
 * Builds Gravatar URLs for an email address.
 *
 * Gravatar keys avatars by the SHA-256 of the trimmed, lowercased address, so
 * the address itself never leaves the browser — but the hash and the viewer's
 * IP do reach gravatar.com. Only ever hand this an address the viewer owns.
 *
 * The URLs ask for `d=404`: an address without a Gravatar answers with a 404
 * rather than Gravatar's default silhouette, so the caller's own fallback
 * (an initial, an icon) stays on screen instead of being replaced by a stranger.
 */
@Injectable({providedIn: "root"})
export class GravatarService {
  /** One request per address+size; the hash never changes for either. */
  private readonly cache = new Map<string, Promise<string | null>>();

  /**
   * @param email the address to look up; null/blank yields no URL
   * @param sizePx pixel size to request (pass the rendered size doubled for retina)
   * @returns the avatar URL, or null when there is nothing to hash or no way to hash it
   */
  avatarUrl(email: string | null | undefined, sizePx: number): Promise<string | null> {
    const normalized = normalizeEmail(email);
    if (!normalized) {
      return Promise.resolve(null);
    }

    const key = `${normalized}|${sizePx}`;
    const cached = this.cache.get(key);
    if (cached) {
      return cached;
    }

    const pending = this.buildUrl(normalized, sizePx);
    this.cache.set(key, pending);
    return pending;
  }

  private async buildUrl(email: string, sizePx: number): Promise<string | null> {
    const hash = await sha256Hex(email);
    if (!hash) {
      return null;
    }
    return `${GRAVATAR_BASE}/${hash}?s=${sizePx}&d=404`;
  }
}

/** Gravatar hashes the address trimmed and lowercased. */
function normalizeEmail(email: string | null | undefined): string {
  return (email ?? "").trim().toLowerCase();
}

/**
 * SHA-256 as lowercase hex.
 *
 * `crypto.subtle` only exists in a secure context, so over plain http (a LAN
 * dev host, say) there is no hash and therefore no Gravatar — the caller keeps
 * its fallback rather than the page breaking.
 */
async function sha256Hex(value: string): Promise<string | null> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    return null;
  }

  try {
    const digest = await subtle.digest("SHA-256", new TextEncoder().encode(value));
    return Array.from(new Uint8Array(digest))
      .map(byte => byte.toString(16).padStart(2, "0"))
      .join("");
  } catch (e) {
    console.error("gravatar: hashing failed", e);
    return null;
  }
}
