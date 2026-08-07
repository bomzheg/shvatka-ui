// ---------------------------------------------------------------------------
// Rich hints (Telegram rich messages).
//
// A rich hint carries its markup as written by the author — Rich HTML or Rich
// Markdown — plus the files it embeds. Inside the markup a file is referenced
// by the id of its `media` entry (`<img src="pic">`), which only means anything
// to Telegram, so before the markup can be shown on the web those ids have to
// become real CDN urls.
//
// The result still goes through Angular's HTML sanitizer at the binding, which
// keeps the structural markup (headings, lists, tables, quotes, images) and
// drops anything unsafe.
// ---------------------------------------------------------------------------

import {RichMedia} from "../domain/game.models";

/** Resolves the file guid of an embedded media to a url it can be shown from. */
export type FileUrlResolver = (guid: string) => string | undefined;

/**
 * Replace every media id used in the markup with the url of the file behind it.
 * Ids without a resolvable file are left alone — a broken image says more than
 * a silently dropped one.
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
    const url = urls.get(element.getAttribute("src") ?? "");
    if (url) {
      element.setAttribute("src", url);
    }
  });
  return doc.body.innerHTML;
}
