import {HttpClientTestingModule, HttpTestingController} from '@angular/common/http/testing';
import {TestBed} from '@angular/core/testing';

import {ShvatkaConfig} from '../app.config';
import {DocPageLink} from './doc-pages';
import {DocsService} from './docs.service';

const CREATE_TEAM: DocPageLink = {
  url: 'https://bomzheg.github.io/Shvatka/shvatka/setup_team/create_team.html',
  title: 'Создание команды',
};

describe('DocsService', () => {
  let http: HttpTestingController;
  let service: DocsService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [DocsService, {provide: ShvatkaConfig, useValue: {apiUrl: '/api'}}],
    });
    http = TestBed.inject(HttpTestingController);
    service = TestBed.inject(DocsService);
  });

  afterEach(() => http.verify());

  function answer(pages: Record<string, DocPageLink>): void {
    http.expectOne('/api/docs/pages').flush({pages});
  }

  it('asks the engine where the page is', () => {
    const seen: (DocPageLink | null)[] = [];
    service.page('CREATE_TEAM').subscribe(link => seen.push(link));
    answer({CREATE_TEAM});
    expect(seen).toEqual([CREATE_TEAM]);
  });

  it('asks once, however many hints are on the page', () => {
    service.page('CREATE_TEAM').subscribe();
    service.page('PROMOTION').subscribe();
    answer({CREATE_TEAM});
    service.page('MOVE_CHAT').subscribe();
    http.expectNone('/api/docs/pages');
  });

  it('has no link for a page the engine does not know', () => {
    const seen: (DocPageLink | null)[] = [];
    service.page('MOVE_CHAT').subscribe(link => seen.push(link));
    answer({CREATE_TEAM});
    expect(seen).toEqual([null]);
  });

  it('stays quiet when the request fails', () => {
    const seen: (DocPageLink | null)[] = [];
    service.page('CREATE_TEAM').subscribe(link => seen.push(link));
    http.expectOne('/api/docs/pages').error(new ProgressEvent('network error'));
    expect(seen).toEqual([null]);
  });
});
