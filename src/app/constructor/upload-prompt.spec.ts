import {HttpErrorResponse} from "@angular/common/http";
import {of, throwError} from "rxjs";
import {
  isHeicFile,
  isUnsupportedMediaError,
  unsupportedMediaMessage,
  uploadOptionsQuery,
  UploadedFile,
} from "./constructor.models";
import {UploadPromptService} from "./upload-prompt.service";

function makeFile(name: string, type = ""): File {
  return new File([new Uint8Array([1, 2, 3])], name, {type});
}

const STORED: UploadedFile = {guid: "g1", original_filename: "photo", extension: ".jpg"};

/** What the engine answers when telegram refuses the file it was sending. */
function telegramError(description: string): HttpErrorResponse {
  return new HttpErrorResponse({
    status: 422,
    error: {type: "FileRejectedByTelegram", text: "rejected", description, docUrl: null},
  });
}

describe("uploadOptionsQuery", () => {
  it("is empty when no options apply", () => {
    expect(uploadOptionsQuery()).toBe("");
    expect(uploadOptionsQuery({})).toBe("");
    expect(uploadOptionsQuery({allowConversion: false, saveUnsupportedAsIs: false})).toBe("");
  });

  it("encodes each flag it is given", () => {
    expect(uploadOptionsQuery({allowConversion: true})).toBe("?allow_conversion=true");
    expect(uploadOptionsQuery({saveUnsupportedAsIs: true})).toBe("?save_unsupported_as_is=true");
  });
});

describe("isHeicFile", () => {
  it("detects by extension regardless of (possibly empty) MIME type", () => {
    expect(isHeicFile(makeFile("IMG_1.HEIC"))).toBeTrue();
    expect(isHeicFile(makeFile("clip.heif"))).toBeTrue();
  });

  it("detects by MIME type", () => {
    expect(isHeicFile(makeFile("noext", "image/heic"))).toBeTrue();
    expect(isHeicFile(makeFile("noext", "image/heif"))).toBeTrue();
  });

  it("ignores ordinary formats", () => {
    expect(isHeicFile(makeFile("a.jpg", "image/jpeg"))).toBeFalse();
    expect(isHeicFile(makeFile("a.png", "image/png"))).toBeFalse();
    expect(isHeicFile(makeFile("a.mp4", "video/mp4"))).toBeFalse();
  });
});

describe("unsupported media error", () => {
  const err = new HttpErrorResponse({
    status: 415,
    error: {detail: {text: "Формат не поддерживается", description: "heic"}},
  });

  it("recognizes a 415", () => {
    expect(isUnsupportedMediaError(err)).toBeTrue();
    expect(isUnsupportedMediaError(new HttpErrorResponse({status: 400}))).toBeFalse();
    expect(isUnsupportedMediaError(new Error("boom"))).toBeFalse();
  });

  it("extracts the localized detail.text", () => {
    expect(unsupportedMediaMessage(err)).toBe("Формат не поддерживается");
  });

  it("falls back when the body has no text", () => {
    const bare = new HttpErrorResponse({status: 415, error: null});
    expect(unsupportedMediaMessage(bare)).toContain("не поддерживается");
  });
});

describe("UploadPromptService", () => {
  let service: UploadPromptService;

  beforeEach(() => {
    service = new UploadPromptService();
  });

  it("uploads ordinary files without prompting", () => {
    const uploadFn = jasmine.createSpy("uploadFn").and.returnValue(of(STORED));
    let result: UploadedFile | undefined;
    service.upload(makeFile("a.jpg", "image/jpeg"), uploadFn).subscribe(f => (result = f));

    expect(result).toEqual(STORED);
    expect(uploadFn).toHaveBeenCalledOnceWith();
    expect(service.prompt$.value).toBeNull();
  });

  it("prompts for a detected HEIC and converts on choice", () => {
    const uploadFn = jasmine.createSpy("uploadFn").and.returnValue(of(STORED));
    let result: UploadedFile | undefined;
    service.upload(makeFile("a.heic"), uploadFn).subscribe(f => (result = f));

    // Prompt is visible; nothing uploaded yet.
    expect(service.prompt$.value).not.toBeNull();
    expect(uploadFn).not.toHaveBeenCalled();

    service.choose("convert");

    expect(uploadFn).toHaveBeenCalledOnceWith({allowConversion: true});
    expect(result).toEqual(STORED);
    expect(service.prompt$.value).toBeNull();
  });

  it("keeps the original when the user chooses so", () => {
    const uploadFn = jasmine.createSpy("uploadFn").and.returnValue(of(STORED));
    service.upload(makeFile("a.heic"), uploadFn).subscribe();
    service.choose("keep");
    expect(uploadFn).toHaveBeenCalledOnceWith({saveUnsupportedAsIs: true});
  });

  it("completes without uploading when the user cancels", () => {
    const uploadFn = jasmine.createSpy("uploadFn").and.returnValue(of(STORED));
    let emitted = false;
    let completed = false;
    service.upload(makeFile("a.heic"), uploadFn).subscribe({
      next: () => (emitted = true),
      complete: () => (completed = true),
    });

    service.choose("cancel");

    expect(uploadFn).not.toHaveBeenCalled();
    expect(emitted).toBeFalse();
    expect(completed).toBeTrue();
  });

  it("prompts on a server 415 and retries with the chosen flag", () => {
    const err = new HttpErrorResponse({status: 415, error: {detail: {text: "nope"}}});
    const uploadFn = jasmine.createSpy("uploadFn").and.returnValues(throwError(() => err), of(STORED));
    let result: UploadedFile | undefined;
    // No client-side hint (empty type, generic name) → first request goes out.
    service.upload(makeFile("mystery"), uploadFn).subscribe(f => (result = f));

    expect(uploadFn).toHaveBeenCalledTimes(1);
    expect(service.prompt$.value?.message).toBe("nope");

    service.choose("convert");

    expect(uploadFn).toHaveBeenCalledTimes(2);
    expect(uploadFn.calls.mostRecent().args).toEqual([{allowConversion: true}]);
    expect(result).toEqual(STORED);
  });

  it("prompts when telegram refuses the file and forces on the author's word", () => {
    const err = telegramError("«clip.mov»: Request Entity Too Large");
    const uploadFn = jasmine
      .createSpy("uploadFn")
      .and.returnValues(throwError(() => err), of(STORED));
    let result: UploadedFile | undefined;
    service.upload(makeFile("clip.mov", "video/quicktime"), uploadFn).subscribe(
      f => (result = f),
    );

    expect(uploadFn).toHaveBeenCalledTimes(1);
    expect(service.prompt$.value?.refusal).toBe("telegram");
    expect(service.prompt$.value?.message).toContain("Request Entity Too Large");

    service.choose("force");

    expect(uploadFn.calls.mostRecent().args).toEqual([{force: true}]);
    expect(result).toEqual(STORED);
  });

  it("keeps nothing when the author declines a file telegram refused", () => {
    const uploadFn = jasmine
      .createSpy("uploadFn")
      .and.returnValue(throwError(() => telegramError("слишком большой")));
    let emitted = false;
    let completed = false;
    service.upload(makeFile("clip.mov", "video/quicktime"), uploadFn).subscribe({
      next: () => (emitted = true),
      complete: () => (completed = true),
    });

    service.choose("cancel");

    expect(uploadFn).toHaveBeenCalledTimes(1);
    expect(emitted).toBeFalse();
    expect(completed).toBeTrue();
  });

  it("carries the format choice into the forced upload", () => {
    const uploadFn = jasmine
      .createSpy("uploadFn")
      .and.returnValues(throwError(() => telegramError("не принят")), of(STORED));
    service.upload(makeFile("a.heic"), uploadFn).subscribe();

    service.choose("keep");
    expect(uploadFn.calls.mostRecent().args).toEqual([{saveUnsupportedAsIs: true}]);

    service.choose("force");
    expect(uploadFn.calls.mostRecent().args).toEqual([{saveUnsupportedAsIs: true, force: true}]);
  });

  it("propagates non-415 errors without prompting", () => {
    const err = new HttpErrorResponse({status: 500});
    const uploadFn = jasmine.createSpy("uploadFn").and.returnValue(throwError(() => err));
    let caught: unknown;
    service.upload(makeFile("a.jpg", "image/jpeg"), uploadFn).subscribe({error: e => (caught = e)});

    expect(caught).toBe(err);
    expect(service.prompt$.value).toBeNull();
  });
});
