export class Player {
  constructor(
    public name_mention: string,
    public id: number,
    public can_be_author: boolean,
  ) {}
}

export class Team {
  constructor(
    public id: number,
    public name: string,
    public captain: Player,
    public description: string | null,
  ) {}
}

export enum HintType {
  text = "text",
  gps = "gps",
  venue = "venue",
  photo = "photo",
  audio = "audio",
  video = "video",
  document = "document",
  animation = "animation",
  voice = "voice",
  video_note = "video_note",
  contact = "contact",
  sticker = "sticker",
}

interface HintPartArgs {
  type: HintType
  text?: string | undefined
  latitude?: number | undefined
  longitude?: number | undefined
  title?: string | undefined
  address?: string | undefined
  foursquare_id?: string | undefined
  foursquare_type?: string | undefined
  caption?: string | undefined
  show_caption_above_media?: boolean | undefined
  /** Photo only: cover the image until the player reveals it. */
  has_spoiler?: boolean | null | undefined
  file_guid?: string | undefined
  thumb_guid?: string | undefined
  phone_number?: string | undefined
  first_name?: string | undefined
  last_name?: string | undefined
  vcard?: string | undefined
}

export class HintPart {
  constructor(
    public type: HintType,
    public text: string | undefined = undefined,
    public latitude: number | undefined = undefined,
    public longitude: number | undefined = undefined,
    public title: string | undefined = undefined,
    public address: string | undefined = undefined,
    public foursquare_id: string | undefined = undefined,
    public foursquare_type: string | undefined = undefined,
    public caption: string | undefined = undefined,
    public show_caption_above_media: boolean | undefined = undefined,
    public file_guid: string | undefined = undefined,
    public thumb_guid: string | undefined = undefined,
    public phone_number: string | undefined = undefined,
    public first_name: string | undefined = undefined,
    public last_name: string | undefined = undefined,
    public vcard: string | undefined = undefined,
    /** Photo only. `null`/absent means no spoiler — treat both as false. */
    public has_spoiler: boolean | null | undefined = undefined,
  ) {}

  public static create({
    type,
    text,
    latitude,
    longitude,
    title,
    address,
    foursquare_id,
    foursquare_type,
    caption,
    show_caption_above_media,
    file_guid,
    thumb_guid,
    phone_number,
    first_name,
    last_name,
    vcard,
    has_spoiler,
  }: HintPartArgs) {
    return new HintPart(
      type,
      text,
      latitude,
      longitude,
      title,
      address,
      foursquare_id,
      foursquare_type,
      caption,
      show_caption_above_media,
      file_guid,
      thumb_guid,
      phone_number,
      first_name,
      last_name,
      vcard,
      has_spoiler,
    );
  }

  /** A photo the author marked as a spoiler. `null`/absent reads as false. */
  static isSpoilered(hint: HintPart): boolean {
    return hint.type === HintType.photo && hint.has_spoiler === true;
  }
}

export class TimeHint {
  constructor(
    public time: number,
    public hint: HintPart[],
  ) {
  }
}

export enum ScenarioConditionType {
  winKey = "WIN_KEY",
  effectsKey = "EFFECTS_KEY",
  effectsTimer = "EFFECTS_TIMER",
}

export class Effect {
  constructor(
    public id: string,
    public hints_: HintPart[] = [],
    public bonus_minutes: number = 0,
    public level_up: boolean = false,
    public next_level: number | null = null,
  ) {
  }

  getHints(): HintPart[] {
    return Array.isArray(this.hints_) ? this.hints_ : [];
  }

  hasBonusMinutes(): boolean {
    return this.bonus_minutes !== 0;
  }

  hasLevelUp(): boolean {
    return this.level_up === true;
  }

  hasHints(): boolean {
    return this.getHints().length > 0;
  }

  hasVisiblePayload(): boolean {
    return this.hasBonusMinutes() || this.hasLevelUp() || this.hasHints();
  }
}

export type EffectLike = {
  id?: string;
  hints_?: HintPart[];
  hints?: HintPart[];
  bonus_minutes?: number;
  level_up?: boolean;
  next_level?: number | string | null;
};

export class Effects {
  static normalize(input: EffectLike[] | EffectLike | undefined): EffectLike[] {
    if (Array.isArray(input)) {
      return input;
    }

    if (!input) {
      return [];
    }

    return [input];
  }

  static hints(effect: EffectLike): HintPart[] {
    if (Array.isArray(effect.hints_)) {
      return effect.hints_;
    }

    if (Array.isArray(effect.hints)) {
      return effect.hints;
    }

    return [];
  }

  static hasVisiblePayload(effect: EffectLike): boolean {
    const bonusMinutes = typeof effect.bonus_minutes === 'number' ? effect.bonus_minutes : 0;
    return bonusMinutes !== 0 || effect.level_up === true || this.hints(effect).length > 0;
  }
}

export class ScenarioCondition {
  constructor(
    public type: ScenarioConditionType,
    public keys: string[] | undefined = undefined,
    public effects: Effect[] | Effect | undefined = undefined,
    public action_time: number | undefined = undefined,
  ) {
  }
}

export class Scenario {
  constructor(
    public id: string,
    public time_hints: TimeHint[],
    public conditions: ScenarioCondition[],
  ) {
  }
}

export class Level {
  constructor(
    public db_id: number,
    public name_id: string,
    public author: Player,
    public scenario: Scenario,
    public game_id: number | undefined,
    public number_in_game: number | undefined,
  ) {
  }
}

export class FullGame {
  constructor(
    public id: number,
    public author: Player,
    public name: string,
    public status: string,
    public start_at: string | undefined,
    public levels: Level[],
  ) {}
}

export enum KeyType {
  wrong = "wrong",
  simple = "simple",
  bonus = "bonus",
  effects = "effects"
}

export class KeyTime {
  constructor(
    public text: string,
    public type_: string,
    public is_duplicate: boolean,
    public at: string,
    public level_number: number,
    public player: Player,
    public team: Team,
  ) {
  }
}

export type Keys = Map<number, KeyTime[]>

export class LevelTime {
  constructor(
    public id: number,
    public game: FullGame,
    public team: Team,
    public level_number: number,
    public name_id: string | null,
    public start_at: Date,
    public is_finished: boolean,
  ) {
  }
}

/** What brought the team a bonus or a penalty. */
export enum BonusSource {
  key = "key",
  timer = "timer",
  unknown = "unknown",
}

/**
 * An event that changed a team's time, with the whole effects that caused it.
 * The bonus is `effects.bonus_minutes`: positive is subtracted from the result,
 * negative (a penalty) is added to it.
 */
export class BonusEvent {
  constructor(
    public at: string,
    public effects: EffectLike,
    public source: BonusSource,
    public key: string | null,
    public level_time_id: number | null,
    /** Level it was earned on. null means count it in the total only. */
    public level_number: number | null,
  ) {
  }

  static minutes(bonus: BonusEvent): number {
    const minutes = bonus.effects?.bonus_minutes;
    return typeof minutes === 'number' ? minutes : 0;
  }
}

export class GameStat {
  constructor(
    public level_times: Map<number, LevelTime[]>,
    /** {team_id: [...]} — only teams that actually have bonuses. */
    public bonuses: Map<number, BonusEvent[]> = new Map(),
  ) {
  }
}

/** A player who voted for a game (WaiversDto.waivers values). */
export interface VotedPlayer {
  player: Player;
}

/** Response of `GET /waivers/game/{id}` (WaiversDto). */
export class GameWaivers {
  constructor(
    public teams: Team[],
    public waivers: Record<string, VotedPlayer[]>,
  ) {
  }
}
