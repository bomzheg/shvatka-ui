import {DOCUMENT} from '@angular/common';
import {TestBed} from '@angular/core/testing';
import {PushSettingsService} from './push-settings.service';

const STORAGE_KEY = 'shvatka.push.settings';

describe('PushSettingsService', () => {
  let worker: jasmine.SpyObj<ServiceWorker>;

  /**
   * The service reads the browser off the document, so the tests hand it the
   * real one with a stubbed `defaultView`: the real `localStorage` (persistence
   * is the point) and a stub service worker. Everything else still goes to the
   * page's own document, which TestBed needs for its teardown.
   */
  function configure(): void {
    worker = jasmine.createSpyObj<ServiceWorker>('ServiceWorker', ['postMessage']);
    const container = {
      ready: Promise.resolve({active: worker} as unknown as ServiceWorkerRegistration),
      controller: null,
    };
    const browserWindow = {localStorage, navigator: {serviceWorker: container}};
    const testDocument = new Proxy(document, {
      get(target, property) {
        if (property === 'defaultView') {
          return browserWindow;
        }
        const value = Reflect.get(target, property);
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });
    TestBed.configureTestingModule({
      providers: [{provide: DOCUMENT, useValue: testDocument}],
    });
  }

  beforeEach(() => {
    localStorage.removeItem(STORAGE_KEY);
    configure();
  });

  afterEach(() => {
    localStorage.removeItem(STORAGE_KEY);
  });

  function service(): PushSettingsService {
    return TestBed.inject(PushSettingsService);
  }

  it('shows everything until something is turned off', () => {
    const settings = service();

    expect(settings.isDefault()).toBeTrue();
    expect(settings.isKindEnabled('hint')).toBeTrue();
    expect(settings.forWorker()).toEqual({mutedKinds: [], vibrate: true});
  });

  it('mutes a whole category at once', () => {
    const settings = service();

    settings.setCategoryEnabled('team', false);

    expect(settings.isCategoryEnabled('team')).toBeFalse();
    expect(settings.isKindEnabled('player_joined_team')).toBeFalse();
    expect(settings.isKindEnabled('puzzle')).toBeTrue();
    expect(settings.forWorker().mutedKinds).toContain('team_renamed');
  });

  it('remembers the choice across reloads', () => {
    const settings = service();
    settings.setCategoryEnabled('play', false);
    settings.setVibrate(false);

    TestBed.resetTestingModule();
    configure();

    const reloaded = service();
    expect(reloaded.isCategoryEnabled('play')).toBeFalse();
    expect(reloaded.vibrate).toBeFalse();
    expect(reloaded.isDefault()).toBeFalse();
  });

  it('returns to the defaults', () => {
    const settings = service();
    settings.setCategoryEnabled('org', false);
    settings.setVibrate(false);

    settings.resetToDefaults();

    expect(settings.isDefault()).toBeTrue();
    expect(settings.forWorker()).toEqual({mutedKinds: [], vibrate: true});
  });

  it('knows when nothing is left on', () => {
    const settings = service();

    settings.setCategoryEnabled('play', false);
    expect(settings.isEverythingMuted()).toBeFalse();

    settings.setCategoryEnabled('team', false);
    settings.setCategoryEnabled('org', false);

    expect(settings.isEverythingMuted()).toBeTrue();
  });

  it('survives garbage left in storage', () => {
    localStorage.setItem(STORAGE_KEY, 'not json at all');

    expect(service().isDefault()).toBeTrue();
  });

  it('hands the service worker the muted kinds on every change', async () => {
    const settings = service();

    settings.setCategoryEnabled('org', false);
    await TestBed.inject(DOCUMENT).defaultView!.navigator.serviceWorker.ready;

    expect(worker.postMessage).toHaveBeenCalledWith({
      type: 'set-push-settings',
      mutedKinds: ['org_level_up', 'new_org', 'level_test_completed'],
      vibrate: true,
    });
  });
});
