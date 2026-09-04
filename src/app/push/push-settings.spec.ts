import {
  categoryOfKind,
  defaultPushSettings,
  isDefaultPushSettings,
  isEverythingMuted,
  isKindEnabled,
  mutedKinds,
  normalizePushSettings,
  PUSH_CATEGORIES,
} from './push-settings';

describe('push settings', () => {
  it('starts with everything on', () => {
    const settings = defaultPushSettings();

    expect(isDefaultPushSettings(settings)).toBeTrue();
    expect(mutedKinds(settings)).toEqual([]);
    expect(isEverythingMuted(settings)).toBeFalse();
  });

  it('maps every kind to exactly one category', () => {
    const seen = new Set<string>();
    for (const category of PUSH_CATEGORIES) {
      for (const kind of category.kinds) {
        expect(seen.has(kind)).withContext(`${kind} listed twice`).toBeFalse();
        seen.add(kind);
        expect(categoryOfKind(kind)).toBe(category.id);
      }
    }
  });

  it('mutes the kinds of a category that is off', () => {
    const settings = defaultPushSettings();
    settings.categories.team = false;

    expect(mutedKinds(settings)).toEqual([
      'player_joined_team',
      'player_left_team',
      'team_captain_changed',
      'team_renamed',
    ]);
    expect(isKindEnabled(settings, 'team_renamed')).toBeFalse();
    expect(isKindEnabled(settings, 'hint')).toBeTrue();
    expect(isDefaultPushSettings(settings)).toBeFalse();
  });

  it('keeps the whole level with the game it happens in', () => {
    const settings = defaultPushSettings();
    settings.categories.play = false;

    expect(isKindEnabled(settings, 'puzzle')).toBeFalse();
    expect(isKindEnabled(settings, 'hint')).toBeFalse();
    expect(categoryOfKind('hint')).toBe('play');
  });

  it('shows a kind the ui does not know', () => {
    const settings = defaultPushSettings();
    settings.categories.play = false;

    expect(categoryOfKind('brand_new_kind')).toBeNull();
    expect(isKindEnabled(settings, 'brand_new_kind')).toBeTrue();
    expect(isKindEnabled(settings, undefined)).toBeTrue();
  });

  it('sees when nothing is left on', () => {
    const settings = defaultPushSettings();
    for (const category of PUSH_CATEGORIES) {
      settings.categories[category.id] = false;
    }

    expect(isEverythingMuted(settings)).toBeTrue();
  });

  it('fills in what a stored value does not say, and drops what it no longer means', () => {
    const settings = normalizePushSettings({categories: {team: false, hints: false}});

    expect(settings.categories.team).toBeFalse();
    expect(settings.categories.play).toBeTrue();
    expect(settings.vibrate).toBeTrue();
    // `hints` was folded into `play`; a value stored under the old name is ignored.
    expect(Object.keys(settings.categories).sort()).toEqual(['org', 'play', 'team']);
  });

  it('falls back to the defaults for anything unreadable', () => {
    expect(normalizePushSettings(null)).toEqual(defaultPushSettings());
    expect(normalizePushSettings('nonsense')).toEqual(defaultPushSettings());
    expect(normalizePushSettings({categories: 'nonsense'})).toEqual(defaultPushSettings());
  });
});
