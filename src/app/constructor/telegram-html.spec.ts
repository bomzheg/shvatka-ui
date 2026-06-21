import {serializeTelegramHtml, telegramHtmlToEditable} from "./telegram-html";

function serializeHtml(html: string): string {
  const root = document.createElement("div");
  root.innerHTML = html;
  return serializeTelegramHtml(root);
}

describe("serializeTelegramHtml", () => {
  it("keeps plain text untouched", () => {
    expect(serializeHtml("hello world")).toBe("hello world");
  });

  it("escapes HTML-special characters in text", () => {
    expect(serializeHtml("a < b & c > d")).toBe("a &lt; b &amp; c &gt; d");
  });

  it("normalizes bold/italic/underline/strike tags", () => {
    expect(serializeHtml("<strong>a</strong> <em>b</em> <u>c</u> <del>d</del>"))
      .toBe("<b>a</b> <i>b</i> <u>c</u> <s>d</s>");
  });

  it("converts inline styles emitted by execCommand", () => {
    expect(serializeHtml('<span style="font-weight: bold">x</span>')).toBe("<b>x</b>");
    expect(serializeHtml('<span style="text-decoration: line-through">y</span>')).toBe("<s>y</s>");
  });

  it("keeps links with their href", () => {
    expect(serializeHtml('<a href="https://t.me">tg</a>')).toBe('<a href="https://t.me">tg</a>');
  });

  it("supports code, spoiler and blockquote", () => {
    expect(serializeHtml("<code>x</code>")).toBe("<code>x</code>");
    expect(serializeHtml('<span class="tg-spoiler">x</span>')).toBe('<span class="tg-spoiler">x</span>');
    expect(serializeHtml("<tg-spoiler>x</tg-spoiler>")).toBe('<span class="tg-spoiler">x</span>');
    expect(serializeHtml("<blockquote>x</blockquote>")).toBe("<blockquote>x</blockquote>");
  });

  it("turns <br> and block boundaries into newlines", () => {
    expect(serializeHtml("line1<br>line2")).toBe("line1\nline2");
    expect(serializeHtml("line1<div>line2</div><div>line3</div>")).toBe("line1\nline2\nline3");
  });

  it("preserves a blank line from an empty block", () => {
    expect(serializeHtml("a<div><br></div><div>b</div>")).toBe("a\n\nb");
  });

  it("drops disallowed tags but keeps their text", () => {
    expect(serializeHtml('<font color="red">x</font>')).toBe("x");
    expect(serializeHtml('<span style="color: red">x</span>')).toBe("x");
  });

  it("round-trips through the editable form", () => {
    const stored = "<b>bold</b> and <i>italic</i>\nsecond line";
    expect(serializeHtml(telegramHtmlToEditable(stored))).toBe(stored);
  });
});

describe("telegramHtmlToEditable", () => {
  it("returns empty string for empty input", () => {
    expect(telegramHtmlToEditable(undefined)).toBe("");
    expect(telegramHtmlToEditable(null)).toBe("");
    expect(telegramHtmlToEditable("")).toBe("");
  });

  it("turns line breaks into <br> but leaves markup intact", () => {
    expect(telegramHtmlToEditable("a\nb")).toBe("a<br>b");
    expect(telegramHtmlToEditable("<b>a</b>\n<i>b</i>")).toBe("<b>a</b><br><i>b</i>");
  });
});
