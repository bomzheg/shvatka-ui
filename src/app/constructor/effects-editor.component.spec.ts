import {ComponentFixture, TestBed} from "@angular/core/testing";
import {CdkDragDrop} from "@angular/cdk/drag-drop";
import {provideHttpClient} from "@angular/common/http";
import {provideHttpClientTesting} from "@angular/common/http/testing";
import {NoopAnimationsModule} from "@angular/platform-browser/animations";

import {EffectsEditorComponent} from "./effects-editor.component";
import {EffectsPayload, HintPayload} from "./constructor.models";
import {HintType} from "../domain/game.models";

describe("EffectsEditorComponent", () => {
  let component: EffectsEditorComponent;
  let fixture: ComponentFixture<EffectsEditorComponent>;

  function effects(...hints: HintPayload[]): EffectsPayload {
    return {
      id: "eff-1",
      hints,
      bonus_minutes: 0,
      level_up: false,
      next_level: null,
    };
  }

  function text(value: string): HintPayload {
    return {type: HintType.text, text: value};
  }

  function render(payload: EffectsPayload): HTMLElement {
    component.effects = payload;
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  function texts(): (string | undefined)[] {
    return component.effects.hints.map(h => h.text);
  }

  function moveButtons(el: HTMLElement, title: string): HTMLButtonElement[] {
    return Array.from(el.querySelectorAll<HTMLButtonElement>(`button[title="${title}"]`));
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EffectsEditorComponent, NoopAnimationsModule],
      // <mat-icon svgIcon> fetches the SVG; the icons are never registered here.
      providers: [provideHttpClient(), provideHttpClientTesting()],
    })
      .compileComponents();

    fixture = TestBed.createComponent(EffectsEditorComponent);
    component = fixture.componentInstance;
    component.effects = effects();
    fixture.detectChanges();
  });

  it("offers no reorder controls for a lone part", () => {
    const el = render(effects(text("один")));

    expect(component.canReorder()).toBeFalse();
    expect(moveButtons(el, "Выше").length).toBe(0);
    expect(moveButtons(el, "Ниже").length).toBe(0);
    expect(el.querySelectorAll(".drag-handle:not(.is-hidden)").length).toBe(0);
  });

  it("keeps the reorder controls away while the editor is read-only", () => {
    component.disabled = true;
    const el = render(effects(text("раз"), text("два")));

    expect(component.canReorder()).toBeFalse();
    expect(moveButtons(el, "Выше").length).toBe(0);
    expect(el.querySelectorAll(".drag-handle:not(.is-hidden)").length).toBe(0);
  });

  it("disables the arrows that point outside the list", () => {
    const el = render(effects(text("раз"), text("два"), text("три")));

    expect(moveButtons(el, "Выше").map(b => b.disabled)).toEqual([true, false, false]);
    expect(moveButtons(el, "Ниже").map(b => b.disabled)).toEqual([false, false, true]);
    expect(el.querySelectorAll(".drag-handle:not(.is-hidden)").length).toBe(3);
  });

  it("moves a part down when its «Ниже» arrow is clicked", () => {
    const el = render(effects(text("раз"), text("два"), text("три")));

    moveButtons(el, "Ниже")[0].click();
    fixture.detectChanges();

    expect(texts()).toEqual(["два", "раз", "три"]);
  });

  it("moves a part up when its «Выше» arrow is clicked", () => {
    const el = render(effects(text("раз"), text("два"), text("три")));

    moveButtons(el, "Выше")[2].click();
    fixture.detectChanges();

    expect(texts()).toEqual(["раз", "три", "два"]);
  });

  it("leaves the order alone when the move would fall off either end", () => {
    render(effects(text("раз"), text("два")));

    component.moveHint(0, -1);
    component.moveHint(1, 1);

    expect(texts()).toEqual(["раз", "два"]);
  });

  it("reorders on a drop", () => {
    render(effects(text("раз"), text("два"), text("три")));

    component.onHintDrop({previousIndex: 2, currentIndex: 0} as CdkDragDrop<HintPayload[]>);

    expect(texts()).toEqual(["три", "раз", "два"]);
  });
});
