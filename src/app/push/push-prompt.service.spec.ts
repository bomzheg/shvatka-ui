import {TestBed} from '@angular/core/testing';
import {PushPromptService} from './push-prompt.service';

const STORAGE_KEY = 'shvatka.push.prompt.dismissed';

describe('PushPromptService', () => {
  beforeEach(() => {
    localStorage.removeItem(STORAGE_KEY);
    TestBed.configureTestingModule({});
  });

  afterEach(() => {
    localStorage.removeItem(STORAGE_KEY);
  });

  function service(): PushPromptService {
    return TestBed.inject(PushPromptService);
  }

  it('asks about a game until it is dismissed', () => {
    const prompts = service();
    const scope = prompts.gameScope(42);

    expect(prompts.isDismissed(scope)).toBeFalse();

    prompts.dismiss(scope);

    expect(prompts.isDismissed(scope)).toBeTrue();
    expect(prompts.isDismissed(prompts.gameScope(43))).toBeFalse();
  });

  it('remembers the dismissal across reloads', () => {
    service().dismiss('game:42');

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});

    expect(service().isDismissed('game:42')).toBeTrue();
  });

  it('restores every prompt at once', () => {
    const prompts = service();
    prompts.dismiss('game:42');
    prompts.dismiss('game:43');
    expect(prompts.hasDismissed()).toBeTrue();

    prompts.clearDismissed();

    expect(prompts.hasDismissed()).toBeFalse();
    expect(prompts.isDismissed('game:42')).toBeFalse();
    expect(localStorage.getItem(STORAGE_KEY)).toBe('[]');
  });

  it('survives garbage left in storage', () => {
    localStorage.setItem(STORAGE_KEY, 'not json at all');

    expect(service().isDismissed('game:42')).toBeFalse();
  });
});
