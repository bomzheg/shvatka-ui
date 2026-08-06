import {resolveRichMedia} from "./rich-hint";

describe("resolveRichMedia", () => {
  const url = (guid: string) => `https://cdn.example/${guid}`;

  it("returns an empty string for markup that isn't there", () => {
    expect(resolveRichMedia(undefined, [], url)).toBe("");
    expect(resolveRichMedia("", [{id: "pic", file_guid: "guid"}], url)).toBe("");
  });

  it("keeps the markup untouched when nothing is embedded", () => {
    const markup = "<h1>Загадка</h1><p>текст</p>";

    expect(resolveRichMedia(markup, [], url)).toBe(markup);
  });

  it("replaces every media id with the url of its file", () => {
    const markup = '<p><img src="pic"></p><p><img src="clip"></p>';

    const html = resolveRichMedia(
      markup,
      [
        {id: "pic", file_guid: "guid-1"},
        {id: "clip", file_guid: "guid-2"},
      ],
      url,
    );

    expect(html).toContain('src="https://cdn.example/guid-1"');
    expect(html).toContain('src="https://cdn.example/guid-2"');
  });

  it("leaves a src alone when it is not a media id", () => {
    const markup = '<p><img src="https://example.com/other.png"></p>';

    expect(resolveRichMedia(markup, [{id: "pic", file_guid: "guid"}], url))
      .toContain('src="https://example.com/other.png"');
  });

  it("leaves the markup alone when no file has a url", () => {
    const markup = '<p><img src="pic"></p>';

    expect(resolveRichMedia(markup, [{id: "pic", file_guid: "guid"}], () => undefined))
      .toBe(markup);
  });
});
