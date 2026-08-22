import {ShareService} from "./share.service";
import {SnackbarService} from "../snackbar/snackbar.service";

interface FakeWindowOptions {
  matchingDisplayModes?: string[];
  standalone?: boolean;
  share?: jasmine.Spy;
  clipboard?: { writeText: jasmine.Spy };
}

function fakeDocument(options: FakeWindowOptions = {}) {
  const matching = options.matchingDisplayModes ?? [];
  return {
    title: "Схватка",
    defaultView: {
      location: {href: "https://shvatka.ru/games/42"},
      navigator: {
        standalone: options.standalone,
        share: options.share,
        clipboard: options.clipboard,
      },
      matchMedia: (query: string) => ({
        matches: matching.some(mode => query === `(display-mode: ${mode})`),
      }) as MediaQueryList,
    },
  };
}

describe("ShareService", () => {
  let snackbar: jasmine.SpyObj<SnackbarService>;

  beforeEach(() => {
    snackbar = jasmine.createSpyObj<SnackbarService>("SnackbarService", ["success", "error"]);
  });

  it("detects an installed PWA by display-mode", () => {
    const service = new ShareService(fakeDocument({matchingDisplayModes: ["standalone"]}), snackbar);

    expect(service.isInstalledPwa()).toBeTrue();
  });

  it("detects an installed PWA on iOS via navigator.standalone", () => {
    const service = new ShareService(fakeDocument({standalone: true}), snackbar);

    expect(service.isInstalledPwa()).toBeTrue();
  });

  it("is not an installed PWA in a browser tab", () => {
    const service = new ShareService(fakeDocument(), snackbar);

    expect(service.isInstalledPwa()).toBeFalse();
  });

  it("shares the current page through the native share sheet", async () => {
    const share = jasmine.createSpy("share").and.resolveTo();
    const clipboard = {writeText: jasmine.createSpy("writeText").and.resolveTo()};
    const service = new ShareService(fakeDocument({share, clipboard}), snackbar);

    await service.shareCurrentPage();

    expect(share).toHaveBeenCalledWith({title: "Схватка", url: "https://shvatka.ru/games/42"});
    expect(clipboard.writeText).not.toHaveBeenCalled();
  });

  it("copies the link when the share api is missing", async () => {
    const clipboard = {writeText: jasmine.createSpy("writeText").and.resolveTo()};
    const service = new ShareService(fakeDocument({clipboard}), snackbar);

    await service.shareCurrentPage();

    expect(clipboard.writeText).toHaveBeenCalledWith("https://shvatka.ru/games/42");
    expect(snackbar.success).toHaveBeenCalled();
  });

  it("stays quiet when the user dismisses the share sheet", async () => {
    const share = jasmine.createSpy("share").and.rejectWith(new DOMException("cancelled", "AbortError"));
    const clipboard = {writeText: jasmine.createSpy("writeText").and.resolveTo()};
    const service = new ShareService(fakeDocument({share, clipboard}), snackbar);

    await service.shareCurrentPage();

    expect(clipboard.writeText).not.toHaveBeenCalled();
    expect(snackbar.success).not.toHaveBeenCalled();
  });

  it("falls back to copying when sharing fails", async () => {
    const share = jasmine.createSpy("share").and.rejectWith(new Error("not allowed"));
    const clipboard = {writeText: jasmine.createSpy("writeText").and.resolveTo()};
    const service = new ShareService(fakeDocument({share, clipboard}), snackbar);

    await service.shareCurrentPage();

    expect(clipboard.writeText).toHaveBeenCalledWith("https://shvatka.ru/games/42");
  });

  it("reports a failure when the link cannot be copied", async () => {
    const clipboard = {writeText: jasmine.createSpy("writeText").and.rejectWith(new Error("denied"))};
    const service = new ShareService(fakeDocument({clipboard}), snackbar);

    await service.shareCurrentPage();

    expect(snackbar.error).toHaveBeenCalled();
  });
});
