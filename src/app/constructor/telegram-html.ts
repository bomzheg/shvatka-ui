// Telegram message-entity HTML.
//
// Text hints are stored as the exact HTML subset Telegram accepts in the
// `HTML` parse mode (see https://core.telegram.org/bots/api#html-style):
//   <b> <i> <u> <s> <a href> <code> <pre> <blockquote> <tg-spoiler>
// Line breaks are stored as "\n" (the render side turns them into <br>, see
// `HintPartComponent.toHtml`).
//
// A WYSIWYG editor edits content in a `contenteditable` element whose markup is
// browser-specific (it may use <div>, inline styles, &nbsp;, …). These helpers
// bridge the two: `serializeTelegramHtml` turns the contenteditable DOM into the
// clean Telegram subset, and `telegramHtmlToEditable` turns stored hint HTML
// back into something the contenteditable can display.

interface TagWrap {
  open: string;
  close: string;
}

const WRAP_BOLD: TagWrap = {open: "<b>", close: "</b>"};
const WRAP_ITALIC: TagWrap = {open: "<i>", close: "</i>"};
const WRAP_UNDERLINE: TagWrap = {open: "<u>", close: "</u>"};
const WRAP_STRIKE: TagWrap = {open: "<s>", close: "</s>"};
const WRAP_CODE: TagWrap = {open: "<code>", close: "</code>"};
// Telegram accepts both <tg-spoiler> and <span class="tg-spoiler">. We emit the
// span form because Angular's HTML sanitizer keeps <span class> (so it renders
// in the read-only hint view via [innerHTML]) but strips the custom <tg-spoiler>.
const WRAP_SPOILER: TagWrap = {open: '<span class="tg-spoiler">', close: "</span>"};

function escapeText(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeAttr(value: string): string {
  return escapeText(value).replace(/"/g, "&quot;");
}

/** Formatting implied by an element's inline style (execCommand sometimes
 *  emits `<span style="font-weight:bold">` instead of `<b>`). */
function styleWraps(el: HTMLElement): TagWrap[] {
  const wraps: TagWrap[] = [];
  const style = el.style;
  const weight = style.fontWeight;
  if (weight === "bold" || weight === "bolder" || Number.parseInt(weight, 10) >= 600) {
    wraps.push(WRAP_BOLD);
  }
  if (style.fontStyle === "italic") {
    wraps.push(WRAP_ITALIC);
  }
  const decoration = `${style.textDecorationLine} ${style.textDecoration}`;
  if (decoration.includes("underline")) {
    wraps.push(WRAP_UNDERLINE);
  }
  if (decoration.includes("line-through")) {
    wraps.push(WRAP_STRIKE);
  }
  return wraps;
}

/** Formatting implied by an element's tag (and the spoiler span variant). */
function tagWraps(el: HTMLElement): TagWrap[] {
  switch (el.tagName) {
    case "B":
    case "STRONG":
      return [WRAP_BOLD];
    case "I":
    case "EM":
      return [WRAP_ITALIC];
    case "U":
    case "INS":
      return [WRAP_UNDERLINE];
    case "S":
    case "STRIKE":
    case "DEL":
      return [WRAP_STRIKE];
    case "CODE":
      return [WRAP_CODE];
    case "TG-SPOILER":
      return [WRAP_SPOILER];
    case "A": {
      const href = el.getAttribute("href");
      return href ? [{open: `<a href="${escapeAttr(href)}">`, close: "</a>"}] : [];
    }
    case "SPAN":
      return el.classList.contains("tg-spoiler") ? [WRAP_SPOILER] : [];
    default:
      return [];
  }
}

const BLOCK_TAGS = new Set(["DIV", "P", "LI", "SECTION", "ARTICLE"]);

/**
 * Serialize a contenteditable subtree into the Telegram HTML subset. Only the
 * supported tags survive; everything else is reduced to its text content, and
 * block boundaries / `<br>` become "\n".
 */
export function serializeTelegramHtml(root: Node): string {
  let out = "";
  const ensureNewline = () => {
    if (out.length > 0 && !out.endsWith("\n")) {
      out += "\n";
    }
  };

  const visit = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      out += escapeText((node.textContent ?? "").replace(/\u00a0/g, " "));
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) {
      return;
    }
    const el = node as HTMLElement;
    const tag = el.tagName;

    if (tag === "BR") {
      out += "\n";
      return;
    }
    // Skip genuinely empty inline elements (e.g. stray <span></span>), but keep
    // empty blocks since they represent intentional blank lines.
    if (!BLOCK_TAGS.has(tag) && (el.textContent ?? "").length === 0 && !el.querySelector("br")) {
      return;
    }

    if (tag === "PRE") {
      ensureNewline();
      out += "<pre>";
      el.childNodes.forEach(visit);
      out += "</pre>";
      ensureNewline();
      return;
    }
    if (tag === "BLOCKQUOTE") {
      ensureNewline();
      out += "<blockquote>";
      el.childNodes.forEach(visit);
      out += "</blockquote>";
      ensureNewline();
      return;
    }
    if (BLOCK_TAGS.has(tag)) {
      ensureNewline();
      el.childNodes.forEach(visit);
      ensureNewline();
      return;
    }

    const wraps = [...tagWraps(el), ...styleWraps(el)];
    wraps.forEach(w => (out += w.open));
    el.childNodes.forEach(visit);
    [...wraps].reverse().forEach(w => (out += w.close));
  };

  root.childNodes.forEach(visit);
  return out.replace(/^\n+/, "").replace(/\n+$/, "");
}

/**
 * Turn stored Telegram hint HTML into markup a contenteditable can display:
 * line-break "\n" become <br>, while newlines that sit inside a tag (between
 * attributes) are left untouched so the markup is not broken. Mirrors
 * `HintPartComponent.toHtml`.
 */
export function telegramHtmlToEditable(value: string | null | undefined): string {
  if (!value) {
    return "";
  }
  return value
    .replace(/\r\n?/g, "\n")
    .replace(/\n(?![^<]*>)/g, "<br>");
}
