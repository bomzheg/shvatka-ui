import {Injectable} from '@angular/core';
import {HttpAdapter} from "../http.adapter";

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

const contentTypes: {[key in HintType]: string} = {
  [HintType.photo]: "image/jpg",
  [HintType.video]: "video/mpg4",
  [HintType.audio]: "audio/mpeg",
  [HintType.document]: "application/octet-stream",
  [HintType.animation]: "video/mp4",
  [HintType.voice]: "audio/ogg",
  [HintType.video_note]: "video/mp4",
  [HintType.sticker]: "image/webp",
  [HintType.text]: "text/plain",
  [HintType.gps]: "text/plain",
  [HintType.venue]: "text/plain",
  [HintType.contact]: "text/plain",
}

const haveFile: {[key in HintType]: boolean} = {
  [HintType.photo]: true,
  [HintType.video]: true,
  [HintType.audio]: true,
  [HintType.document]: true,
  [HintType.animation]: true,
  [HintType.voice]: true,
  [HintType.video_note]: true,
  [HintType.sticker]: true,
  [HintType.text]: false,
  [HintType.gps]: false,
  [HintType.venue]: false,
  [HintType.contact]: false,
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
    )
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
    public author: any,
    public scenario: Scenario,
    public game_id: number | undefined,
    public number_in_game: number | undefined,
  ) {
  }
}

export class FullGame {
constructor(
  public id: number ,
  public author: any,
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
    public player: any,
    public team: any,
  ) {
  }
}
export type Keys = Map<number, KeyTime[]>

export class LevelTime {
  constructor(
    public id: number,
    public game: FullGame,
    public team: any,
    public level_number: number,
    public start_at: Date,
    public is_finished: boolean,
  ) {
  }
}
type GameStat = Map<number, LevelTime[]>

@Injectable({
  providedIn: 'root'
})
export class GameService {
  private game: FullGame | undefined;
  private keys: Keys | undefined;

  constructor(private http: HttpAdapter) { }

  loadGame(id: number) {
    this.http.get<FullGame>(`/games/${id}`).subscribe(g => {
      this.game = g;
    })
    this.http.get<Keys>(`/games/${id}/keys`).subscribe(k => {
      this.keys = k;
    })
  }

  getGame(): FullGame {
    return this.game!;
  }
  getKeys() : Keys {
    return this.keys!;
  }
}
