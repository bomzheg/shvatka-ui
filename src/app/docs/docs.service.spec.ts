import {TestBed} from '@angular/core/testing';

import {DEFAULT_DOCS_URL, ShvatkaConfig} from '../app.config';
import {DocPage} from './doc-pages';
import {DocsService} from './docs.service';

function serviceWith(docsUrl: string): DocsService {
  TestBed.configureTestingModule({
    providers: [DocsService, {provide: ShvatkaConfig, useValue: {docsUrl}}],
  });
  return TestBed.inject(DocsService);
}

describe('DocsService', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('builds a page url under the configured docs root', () => {
    const docs = serviceWith('https://docs.example.org/shvatka/3.7.0');
    expect(docs.pageUrl(DocPage.createTeam))
      .toBe('https://docs.example.org/shvatka/3.7.0/setup_team/create_team.html');
  });

  it('does not double the slash of a root that ends with one', () => {
    const docs = serviceWith('https://docs.example.org/shvatka/master/');
    expect(docs.pageUrl(DocPage.promotion))
      .toBe('https://docs.example.org/shvatka/master/player/promotion.html');
  });

  it('falls back to the docs of master when nothing is configured', () => {
    const config = TestBed.configureTestingModule({}).inject(ShvatkaConfig);
    expect(config.docsUrl).toBe(DEFAULT_DOCS_URL);
  });
});
