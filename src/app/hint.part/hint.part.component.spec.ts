import {ComponentFixture, TestBed} from '@angular/core/testing';
import {SimpleChange} from '@angular/core';

import {provideHttpClient} from '@angular/common/http';
import {provideHttpClientTesting} from '@angular/common/http/testing';

import {HintPartComponent} from './hint.part.component';
import {HintPart, HintType} from '../domain/game.models';

describe('HintPartComponent', () => {
  let component: HintPartComponent;
  let fixture: ComponentFixture<HintPartComponent>;

  function photo(hasSpoiler: boolean | null | undefined): HintPart {
    const hint = new HintPart(HintType.photo);
    hint.file_guid = 'guid';
    hint.has_spoiler = hasSpoiler;
    return hint;
  }

  function render(hint: HintPart): HTMLElement {
    component.hint = hint;
    component.fileUrl = 'https://cdn.example/photo.jpg';
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HintPartComponent],
      // <mat-icon svgIcon> fetches the SVG; the icons are never registered here.
      providers: [provideHttpClient(), provideHttpClientTesting()],
    })
    .compileComponents();

    fixture = TestBed.createComponent(HintPartComponent);
    component = fixture.componentInstance;
    component.hint = photo(undefined);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('covers a spoilered photo until it is clicked', () => {
    const el = render(photo(true));

    const cover = el.querySelector('button.hint-spoiler');
    expect(cover).withContext('spoilered photo must start covered').toBeTruthy();
    expect(el.querySelector('img.hint-spoiler-image')).toBeTruthy();

    (cover as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(el.querySelector('button.hint-spoiler')).toBeNull();
    const img = el.querySelector('img') as HTMLImageElement;
    expect(img.src).toBe('https://cdn.example/photo.jpg');
  });

  it('keeps the caption visible while the photo is covered', () => {
    const hint = photo(true);
    hint.caption = 'подпись';
    const el = render(hint);

    expect(el.querySelector('button.hint-spoiler')).toBeTruthy();
    expect(el.querySelector('.hint-caption')?.textContent).toContain('подпись');
  });

  it('shows a photo with no spoiler flag as usual', () => {
    for (const value of [undefined, null, false] as (boolean | null | undefined)[]) {
      const el = render(photo(value));
      expect(el.querySelector('button.hint-spoiler'))
        .withContext(`has_spoiler=${value} must not cover the photo`)
        .toBeNull();
      expect(el.querySelector('img')).toBeTruthy();
    }
  });

  it('covers the new photo again when the hint changes', () => {
    const el = render(photo(true));
    (el.querySelector('button.hint-spoiler') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(component.spoilerRevealed).toBeTrue();

    const next = photo(true);
    component.hint = next;
    component.ngOnChanges({hint: new SimpleChange(null, next, false)});
    fixture.detectChanges();

    expect(component.spoilerRevealed).toBeFalse();
    expect(el.querySelector('button.hint-spoiler')).toBeTruthy();
  });

  it('ignores the flag on non-photo hints', () => {
    const hint = new HintPart(HintType.video);
    hint.has_spoiler = true;
    const el = render(hint);

    expect(el.querySelector('button.hint-spoiler')).toBeNull();
    expect(el.querySelector('video')).toBeTruthy();
  });
});
