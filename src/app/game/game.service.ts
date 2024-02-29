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

export class HintPart {
  constructor(
    public type: HintType,
    public text: string | undefined,
    public latitude: number | undefined,
    public longitude: number | undefined,
    public title: string | undefined,
    public address: string | undefined,
    public foursquare_id: string | undefined,
    public foursquare_type: string | undefined,
    public caption: string | undefined,
    public file_guid: string | undefined,
    public thumb_guid: string | undefined,
    public phone_number: string | undefined,
    public first_name: string | undefined,
    public last_name: string | undefined,
    public vcard: string | undefined,
  ) {
  }
}

export class TimeHint {
  constructor(
    public time: number,
    public hint: [HintPart],
  ) {
  }
}

export class Scenario {
  constructor(
    public id: string,
    public time_hints: [TimeHint],
    public keys: [string],
    public bonus_keys: [any],
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
  public levels: [Level],
) {}
}

@Injectable({
  providedIn: 'root'
})
export class GameService {
  private game: FullGame | undefined;

  constructor(private http: HttpAdapter) { }

  loadGame(id: number) {
    this.http.get<FullGame>(`/games/${id}`).subscribe(g => {
      this.game = g;
    })
  }

  getGame(): FullGame {
    return this.game!;
  }
}
