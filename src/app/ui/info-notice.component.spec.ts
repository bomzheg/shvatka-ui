import {Component} from '@angular/core';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {of} from 'rxjs';

import {DocPage, DocPageLink} from '../docs/doc-pages';
import {DocsService} from '../docs/docs.service';
import {InfoNoticeComponent} from './info-notice.component';

const CREATE_TEAM: DocPageLink = {
  url: 'https://bomzheg.github.io/Shvatka/shvatka/setup_team/create_team.html',
  title: 'Создание команды',
};

const MOVE_CHAT: DocPageLink = {
  url: 'https://bomzheg.github.io/Shvatka/shvatka/setup_team/move_chat.html',
  title: 'Перенести команду в другой чат',
};

@Component({
  standalone: true,
  imports: [InfoNoticeComponent],
  template: `
    <app-info-notice [doc]="doc">Вы станете капитаном новой команды.</app-info-notice>`,
})
class HostComponent {
  doc?: DocPage | DocPage[];
}

describe('InfoNoticeComponent', () => {
  let fixture: ComponentFixture<HostComponent>;
  let asked: DocPage[];

  beforeEach(() => {
    asked = [];
    TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [
        {
          provide: DocsService,
          useValue: {
            page: (page: DocPage) => {
              asked.push(page);
              if (page === 'CREATE_TEAM') return of(CREATE_TEAM);
              if (page === 'MOVE_CHAT') return of(MOVE_CHAT);
              return of(null);
            },
          },
        },
      ],
    });
    fixture = TestBed.createComponent(HostComponent);
  });

  function link(): HTMLAnchorElement | null {
    return fixture.nativeElement.querySelector('.notice-doc');
  }

  function links(): HTMLAnchorElement[] {
    return Array.from(fixture.nativeElement.querySelectorAll('.notice-doc'));
  }

  it('offers the page the engine gave it, by its title', () => {
    fixture.componentInstance.doc = 'CREATE_TEAM';
    fixture.detectChanges();
    expect(asked).toEqual(['CREATE_TEAM']);
    expect(link()?.getAttribute('href')).toBe(CREATE_TEAM.url);
    expect(link()?.textContent).toContain('Создание команды');
    expect(link()?.getAttribute('rel')).toBe('noopener');
  });

  it('offers every page a hint spans, in the order given', () => {
    fixture.componentInstance.doc = ['CREATE_TEAM', 'MOVE_CHAT'];
    fixture.detectChanges();
    expect(asked).toEqual(['CREATE_TEAM', 'MOVE_CHAT']);
    expect(links().map(a => a.getAttribute('href'))).toEqual([CREATE_TEAM.url, MOVE_CHAT.url]);
    expect(fixture.nativeElement.textContent).toContain('Подробнее:');
  });

  it('drops the pages the engine does not know, keeping the rest', () => {
    fixture.componentInstance.doc = ['CREATE_TEAM', 'WAIVERS'];
    fixture.detectChanges();
    expect(links().map(a => a.getAttribute('href'))).toEqual([CREATE_TEAM.url]);
  });

  it('shows the hint alone when the engine has no such page', () => {
    fixture.componentInstance.doc = 'WAIVERS';
    fixture.detectChanges();
    expect(link()).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Вы станете капитаном новой команды.');
  });

  it('asks for nothing when the hint names no page', () => {
    fixture.detectChanges();
    expect(asked).toEqual([]);
    expect(link()).toBeNull();
  });
});
