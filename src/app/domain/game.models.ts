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
    public file_guid: string | undefined = undefined,
    public thumb_guid: string | undefined = undefined,
    public phone_number: string | undefined = undefined,
    public first_name: string | undefined = undefined,
    public last_name: string | undefined = undefined,
    public vcard: string | undefined = undefined,
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
    file_guid,
    thumb_guid,
    phone_number,
    first_name,
    last_name,
    vcard,
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
      file_guid,
      thumb_guid,
      phone_number,
      first_name,
      last_name,
      vcard,
    );
  }
}

export class TimeHint {
  constructor(
    public time: number,
    public hint: HintPart[],
  ) {
  }
}

export class Scenario {
  constructor(
    public id: string,
    public time_hints: TimeHint[],
    public keys: string[],
    public bonus_keys: any[],
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
    public start_at: Date,
    public is_finished: boolean,
  ) {
  }
}

export class GameStat {
  constructor(
    public level_times: Map<number, LevelTime[]>,
  ) {
  }
}
