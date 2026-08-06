import {ComponentFixture, TestBed} from '@angular/core/testing';
import {SimpleChange} from '@angular/core';

import {provideHttpClient} from '@angular/common/http';
import {provideHttpClientTesting} from '@angular/common/http/testing';

import {HintPartComponent} from './hint.part.component';
import {HintPart, HintType, RichFormat} from '../domain/game.models';

describe('HintPartComponent', () => {
  let component: HintPartComponent;
  let fixture: ComponentFixture<HintPartComponent>;

  const FILE_URL = 'https://cdn.example/media';
  const THUMB_URL = 'https://cdn.example/thumb.jpg';

  function media(type: HintType, hasSpoiler: boolean | null | undefined): HintPart {
    const hint = new HintPart(type);
    hint.file_guid = 'guid';
    hint.has_spoiler = hasSpoiler;
    return hint;
  }

  function photo(hasSpoiler: boolean | null | undefined): HintPart {
    return media(HintType.photo, hasSpoiler);
  }

  /** Bind a hint the way Angular would: set the inputs, then run ngOnChanges. */
  function render(hint: HintPart, thumbUrl?: string): HTMLElement {
    const previous = component.hint;
    component.hint = hint;
    component.fileUrl = FILE_URL;
    component.thumbUrl = thumbUrl;
    component.ngOnChanges({hint: new SimpleChange(previous, hint, false)});
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
    // A photo blurs itself, so the cover shows the file, not a thumbnail.
    expect(el.querySelector('img.hint-spoiler-image')?.getAttribute('src')).toBe(FILE_URL);

    (cover as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(el.querySelector('button.hint-spoiler')).toBeNull();
    expect((el.querySelector('img') as HTMLImageElement).src).toBe(FILE_URL);
  });

  it('keeps the caption visible while the media is covered', () => {
    const hint = photo(true);
    hint.caption = 'подпись';
    const el = render(hint);

    expect(el.querySelector('button.hint-spoiler')).toBeTruthy();
    expect(el.querySelector('.hint-caption')?.textContent).toContain('подпись');
  });

  it('shows media with no spoiler flag as usual', () => {
    for (const value of [undefined, null, false] as (boolean | null | undefined)[]) {
      for (const type of [HintType.photo, HintType.video, HintType.animation]) {
        const el = render(media(type, value));
        expect(el.querySelector('button.hint-spoiler'))
          .withContext(`${type} with has_spoiler=${value} must not be covered`)
          .toBeNull();
      }
    }
  });

  it('covers a spoilered video and animation, holding back the player', () => {
    for (const type of [HintType.video, HintType.animation]) {
      const el = render(media(type, true), THUMB_URL);

      expect(el.querySelector('button.hint-spoiler'))
        .withContext(`${type} must start covered`)
        .toBeTruthy();
      // Nothing may play (or even load) behind the blur.
      expect(el.querySelector('video')).withContext(`${type} player must not be mounted`).toBeNull();
      // Video and animation blur their thumbnail — there is no still otherwise.
      expect(el.querySelector('img.hint-spoiler-image')?.getAttribute('src')).toBe(THUMB_URL);

      (el.querySelector('button.hint-spoiler') as HTMLButtonElement).click();
      fixture.detectChanges();

      expect(el.querySelector('button.hint-spoiler')).toBeNull();
      expect(el.querySelector('video')).toBeTruthy();
    }
  });

  it('falls back to a plain cover for a video without a thumbnail', () => {
    const el = render(media(HintType.video, true));

    expect(el.querySelector('img.hint-spoiler-image')).toBeNull();
    expect(el.querySelector('.hint-spoiler-blank')).toBeTruthy();
  });

  it('names the hidden media in the cover label', () => {
    const labels = new Map<HintType, string>([
      [HintType.photo, 'Показать скрытое фото'],
      [HintType.video, 'Показать скрытое видео'],
      [HintType.animation, 'Показать скрытую анимацию'],
    ]);

    labels.forEach((label, type) => {
      const el = render(media(type, true), THUMB_URL);
      expect(el.querySelector('button.hint-spoiler')?.getAttribute('aria-label')).toBe(label);
    });
  });

  it('covers the new media again when the hint changes', () => {
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

  it('renders rich html and resolves the media it embeds', () => {
    const hint = new HintPart(HintType.rich);
    hint.text = '<h1>Загадка</h1><p>смотри <img src="pic"></p>';
    hint.format = RichFormat.html;
    hint.media = [{id: 'pic', file_guid: 'guid'}];
    component.fileUrlFor = guid => `https://cdn.example/${guid}`;

    const el = render(hint);

    expect(el.querySelector('.hint-rich h1')?.textContent).toBe('Загадка');
    expect(el.querySelector('.hint-rich img')?.getAttribute('src'))
      .toBe('https://cdn.example/guid');
  });

  it('leaves an unresolvable media reference alone', () => {
    const hint = new HintPart(HintType.rich);
    hint.text = '<p><img src="pic"></p>';
    hint.media = [{id: 'pic', file_guid: 'guid'}];
    component.fileUrlFor = () => undefined;

    const el = render(hint);

    expect(el.querySelector('.hint-rich img')?.getAttribute('src')).toBe('pic');
  });

  it('shows markdown markup as its source', () => {
    const hint = new HintPart(HintType.rich);
    hint.text = '# Загадка';
    hint.format = RichFormat.markdown;

    const el = render(hint);

    expect(el.querySelector('.hint-rich')).toBeNull();
    expect(el.querySelector('pre.hint-rich-source')?.textContent).toBe('# Загадка');
  });

  it('ignores the flag on types that cannot carry a spoiler', () => {
    const hint = new HintPart(HintType.document);
    hint.has_spoiler = true;
    const el = render(hint);

    expect(el.querySelector('button.hint-spoiler')).toBeNull();
    expect(el.querySelector('.hint-document')).toBeTruthy();
  });
});
