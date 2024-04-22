import {Injectable} from '@angular/core';
import {HttpAdapter} from "../http/http.adapter";
import {HttpErrorResponse} from "@angular/common/http";
import {MatSnackBar} from "@angular/material/snack-bar";

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
    public author: Player,
    public scenario: Scenario,
    public game_id: number | undefined,
    public number_in_game: number | undefined,
  ) {
  }
}

export class FullGame {
constructor(
  public id: number ,
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

@Injectable({
  providedIn: 'root'
})
export class GameService {
  private game: FullGame | undefined;
  private keys: Keys | undefined;
  private stat: GameStat | undefined;

  constructor(private http: HttpAdapter, private snackBar: MatSnackBar) { }

  loadGame(id: number) {
    this.http.get<FullGame>(`/games/${id}`)
      .subscribe({
        next: g => {this.game = g;},
        error: error => {
          if (error instanceof HttpErrorResponse && error.status === 401) {
            console.log("game id 401 response: " + JSON.stringify(error));
            this.snackBar.open("Сценарии игр доступны только авторизованным пользователям", 'Закрыть', {duration: 3000});
          } else {
            throw error;
          }
        }
      })
    this.http.get<Keys>(`/games/${id}/keys`)
      .subscribe({
        next: k => { this.keys = k;},
        error: error => {
          if (error instanceof HttpErrorResponse && error.status === 401) {
            console.log("keys auth error")
          } else {
            throw error;
          }
        }
    })
    this.http.get<GameStat>(`/games/${id}/stat`)
      .subscribe({
        next: s => { this.stat = s;},
        error: error => {
          if (error instanceof HttpErrorResponse && error.status === 401) {
            console.log("stat auth error")
          } else {
            throw error;
          }
        }
    })
  }

  getGame(): FullGame {
    return this.game!;
  }
  getKeys() : Keys {
    return this.keys!;
  }
  getStat(): GameStat {
    return this.stat!;
  }
}
