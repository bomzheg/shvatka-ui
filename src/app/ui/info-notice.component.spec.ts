import {Component} from '@angular/core';
import {ComponentFixture, TestBed} from '@angular/core/testing';

import {DocPage} from '../docs/doc-pages';
import {DocsService} from '../docs/docs.service';
import {InfoNoticeComponent} from './info-notice.component';

const DOCS_ROOT = 'https://docs.example.org/shvatka/master';

@Component({
  standalone: true,
  imports: [InfoNoticeComponent],
  template: `
    <app-info-notice [doc]="doc">Вы станете капитаном новой команды.</app-info-notice>`,
})
class HostComponent {
  doc?: DocPage;
}

describe('InfoNoticeComponent', () => {
  let fixture: ComponentFixture<HostComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [
        {provide: DocsService, useValue: {pageUrl: (page: DocPage) => `${DOCS_ROOT}/${page}.html`}},
      ],
    });
    fixture = TestBed.createComponent(HostComponent);
  });

  function link(): HTMLAnchorElement | null {
    return fixture.nativeElement.querySelector('.notice-doc');
  }

  it('offers the documentation page it was given', () => {
    fixture.componentInstance.doc = DocPage.createTeam;
    fixture.detectChanges();
    expect(link()?.getAttribute('href'))
      .toBe(`${DOCS_ROOT}/setup_team/create_team.html`);
    expect(link()?.getAttribute('rel')).toBe('noopener');
  });

  it('shows the hint without a link when there is no page for it', () => {
    fixture.detectChanges();
    expect(link()).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Вы станете капитаном новой команды.');
  });
});
