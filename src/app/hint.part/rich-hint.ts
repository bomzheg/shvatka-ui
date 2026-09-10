// ---------------------------------------------------------------------------
// Rich hints (Telegram rich messages).
//
// A rich hint carries its markup as written by the author — Rich HTML or Rich
// Markdown — plus the files it embeds. Inside the markup a file is referenced
// through a telegram link built from the id of its `media` entry
// (`<img src="tg://photo?id=pic"/>`), which only means something to Telegram,
// so before the markup can be shown on the web those links have to become real
// CDN urls.
//
// The result still goes through Angular's HTML sanitizer at the binding, which
// keeps the structural markup (headings, lists, tables, quotes, images) and
// drops anything unsafe.
// ---------------------------------------------------------------------------

import {RichMedia} from "../domain/game.models";

/** Resolves the file guid of an embedded media to a url it can be shown from. */
export type FileUrlResolver = (guid: string) => string | undefined;

/** Reads the media id out of a `tg://photo?id=…` link, or null if it isn't one. */
function mediaIdOf(src: string): string | null {
  const match = /^tg:\/\/(?:photo|video|audio)\?id=(.+)$/.exec(src.trim());
  return match ? match[1] : null;
}

/**
 * Replace every telegram media link in the markup with the url of the file
 * behind it. Links without a resolvable file are left alone — a broken image
 * says more than a silently dropped one.
 */
export function resolveRichMedia(
  markup: string | undefined,
  media: RichMedia[],
  fileUrl: FileUrlResolver | undefined,
): string {
  if (!markup) {
    return "";
  }
  const urls = new Map<string, string>();
  for (const item of media) {
    const url = fileUrl?.(item.file_guid);
    if (url) {
      urls.set(item.id, url);
    }
  }
  if (urls.size === 0) {
    return markup;
  }

  const doc = new DOMParser().parseFromString(markup, "text/html");
  doc.querySelectorAll("[src]").forEach(element => {
    const id = mediaIdOf(element.getAttribute("src") ?? "");
    const url = id === null ? undefined : urls.get(id);
    if (url) {
      element.setAttribute("src", url);
    }
  });
  return doc.body.innerHTML;
}
