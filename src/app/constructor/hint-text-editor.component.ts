import {Component, ElementRef, forwardRef, Input, ViewChild} from "@angular/core";
import {ControlValueAccessor, NG_VALUE_ACCESSOR} from "@angular/forms";
import {MatIcon} from "@angular/material/icon";
import {AppIcon} from "../ui/icons";
import {serializeTelegramHtml, telegramHtmlToEditable} from "./telegram-html";

/**
 * WYSIWYG editor for text hints. The visible content is edited in a
 * `contenteditable` element, but the value exposed through `ngModel` is always
 * the Telegram message-entity HTML subset (see {@link serializeTelegramHtml}),
 * so what you format here is exactly what Telegram will render.
 *
 * The toolbar is intentionally limited to the formatting Telegram supports:
 * bold, italic, underline, strikethrough, spoiler, inline code, link and quote.
 */
@Component({
  selector: "app-hint-text-editor",
  standalone: true,
  imports: [MatIcon],
  templateUrl: "./hint-text-editor.component.html",
  styleUrl: "./hint-text-editor.component.scss",
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => HintTextEditorComponent),
      multi: true,
    },
  ],
})
export class HintTextEditorComponent implements ControlValueAccessor {
  @Input() placeholder = "Текст подсказки";
  @ViewChild("editor", {static: true}) editorRef!: ElementRef<HTMLDivElement>;

  protected readonly AppIcon = AppIcon;
  protected disabled = false;
  protected isEmpty = true;
  /** "wysiwyg" — rich contenteditable; "plain" — raw Telegram HTML textarea. */
  protected mode: "wysiwyg" | "plain" = "wysiwyg";
  /** Source of truth: the stored Telegram HTML. Bound to the plain textarea. */
  protected currentValue = "";

  private onChange: (value: string) => void = () => {};
  private onTouched: () => void = () => {};

  // -- ControlValueAccessor ------------------------------------------------

  writeValue(value: string | null): void {
    this.currentValue = value ?? "";
    this.editorRef.nativeElement.innerHTML = telegramHtmlToEditable(this.currentValue);
    this.refreshEmpty();
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }

  // -- mode tabs -----------------------------------------------------------

  setMode(mode: "wysiwyg" | "plain"): void {
    if (mode === this.mode) {
      return;
    }
    if (mode === "wysiwyg") {
      // Re-hydrate the contenteditable from whatever was typed as raw HTML.
      this.editorRef.nativeElement.innerHTML = telegramHtmlToEditable(this.currentValue);
      this.refreshEmpty();
    }
    this.mode = mode;
  }

  // -- editor events -------------------------------------------------------

  onInput(): void {
    this.emit();
  }

  onBlur(): void {
    this.onTouched();
  }

  /** Raw-HTML textarea edits feed the value straight through. */
  onPlainInput(value: string): void {
    this.currentValue = value;
    this.isEmpty = value.trim().length === 0;
    this.onChange(value);
  }

  // -- toolbar -------------------------------------------------------------

  bold(): void {
    this.exec("bold");
  }

  italic(): void {
    this.exec("italic");
  }

  underline(): void {
    this.exec("underline");
  }

  strike(): void {
    this.exec("strikeThrough");
  }

  quote(): void {
    this.exec("formatBlock", "blockquote");
  }

  link(): void {
    const url = window.prompt("Адрес ссылки (URL):")?.trim();
    if (url) {
      this.exec("createLink", url);
    }
  }

  code(): void {
    this.wrapSelection(() => document.createElement("code"));
  }

  spoiler(): void {
    this.wrapSelection(() => {
      const span = document.createElement("span");
      span.className = "tg-spoiler";
      return span;
    });
  }

  /** Strip all formatting from the current selection. */
  clearFormat(): void {
    const editor = this.editorRef.nativeElement;
    editor.focus();
    document.execCommand("removeFormat");
    document.execCommand("unlink");
    // removeFormat leaves <code>/<tg-spoiler>/<blockquote> wrappers behind.
    this.unwrapWithin(["CODE", "SPAN", "BLOCKQUOTE", "PRE"]);
    this.emit();
  }

  // -- internals -----------------------------------------------------------

  private exec(command: string, value?: string): void {
    this.editorRef.nativeElement.focus();
    document.execCommand(command, false, value);
    this.emit();
  }

  /** Wrap the current (non-empty) selection in a fresh element. */
  private wrapSelection(make: () => HTMLElement): void {
    const editor = this.editorRef.nativeElement;
    editor.focus();
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      return;
    }
    const range = selection.getRangeAt(0);
    if (range.collapsed || !editor.contains(range.commonAncestorContainer)) {
      return;
    }
    const wrapper = make();
    try {
      range.surroundContents(wrapper);
    } catch {
      // surroundContents throws when the range partially crosses element
      // boundaries; extract + re-insert handles that case.
      wrapper.appendChild(range.extractContents());
      range.insertNode(wrapper);
    }
    selection.removeAllRanges();
    const restored = document.createRange();
    restored.selectNodeContents(wrapper);
    selection.addRange(restored);
    this.emit();
  }

  /** Replace any wrapper elements intersecting the selection with their
   *  contents (used by "clear formatting" for non-execCommand tags). */
  private unwrapWithin(tags: string[]): void {
    const editor = this.editorRef.nativeElement;
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      return;
    }
    const range = selection.getRangeAt(0);
    const candidates = Array.from(editor.querySelectorAll(tags.join(","))) as HTMLElement[];
    for (const el of candidates) {
      if (el.tagName === "SPAN" && !el.classList.contains("tg-spoiler")) {
        continue;
      }
      if (!range.intersectsNode(el)) {
        continue;
      }
      const parent = el.parentNode;
      if (!parent) {
        continue;
      }
      while (el.firstChild) {
        parent.insertBefore(el.firstChild, el);
      }
      parent.removeChild(el);
    }
  }

  private emit(): void {
    this.refreshEmpty();
    this.currentValue = serializeTelegramHtml(this.editorRef.nativeElement);
    this.onChange(this.currentValue);
  }

  private refreshEmpty(): void {
    this.isEmpty = (this.editorRef.nativeElement.textContent ?? "").trim().length === 0;
  }
}
