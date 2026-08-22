import {MatIconRegistry} from "@angular/material/icon";
import {DomSanitizer} from "@angular/platform-browser";
import {HintType} from "../domain/game.models";

/**
 * Central registry of every icon used in the UI.
 *
 * Do not hardcode emoji/glyphs in templates/components — always reference this
 * enum and render it through `<mat-icon [svgIcon]="...">`. The names are the
 * stable contract; each value is the id under which the SVG is registered in
 * `MatIconRegistry` (see {@link registerAppIcons}) and the file name under
 * `assets/svg-icons/<id>.svg`.
 */
export enum AppIcon {
  // game mechanics
  key = "key",
  timer = "timer",
  autoFinish = "alarm",
  bonusHint = "lightbulb",
  bonus = "paid",
  penalty = "money-off",
  jump = "shuffle",
  levelUp = "check-circle",
  level = "extension",
  remove = "delete",
  add = "add",
  // files
  files = "folder",
  upload = "upload",
  download = "download",
  // hint part types
  text = "description",
  gps = "location-on",
  venue = "account-balance",
  photo = "photo-camera",
  audio = "music-note",
  video = "movie",
  document = "article",
  animation = "animation",
  voice = "mic",
  videoNote = "videocam",
  contact = "person",
  sticker = "image",
  phone = "call",
  play = "play-arrow",
  pause = "pause",
  copy = "content-copy",
  // generic UI
  search = "search",
  close = "close",
  check = "check",
  cancel = "cancel",
  menu = "menu",
  edit = "edit",
  back = "arrow-back",
  up = "arrow-upward",
  down = "arrow-downward",
  duplicate = "snooze",
  openInFull = "open-in-full",
  unknown = "help",
  effects = "auto-awesome",
  clock = "schedule",
  notifications = "notifications",
  share = "share",
  merge = "call-merge",
  // rich-text toolbar (Telegram message entities)
  bold = "format-bold",
  italic = "format-italic",
  underline = "format-underlined",
  strikethrough = "format-strikethrough",
  quote = "format-quote",
  code = "code",
  link = "link",
  spoiler = "visibility-off",
  clearFormat = "format-clear",
}

/** A label line decorated with a leading icon (used for effect tags). */
export interface IconTag {
  icon: AppIcon;
  text: string;
  /** Optional sign rendered before the icon, e.g. "+" / "-". */
  prefix?: string;
}

export const HINT_TYPE_ICON: Record<HintType, AppIcon> = {
  [HintType.text]: AppIcon.text,
  [HintType.gps]: AppIcon.gps,
  [HintType.venue]: AppIcon.venue,
  [HintType.photo]: AppIcon.photo,
  [HintType.audio]: AppIcon.audio,
  [HintType.video]: AppIcon.video,
  [HintType.document]: AppIcon.document,
  [HintType.animation]: AppIcon.animation,
  [HintType.voice]: AppIcon.voice,
  [HintType.video_note]: AppIcon.videoNote,
  [HintType.contact]: AppIcon.contact,
  [HintType.sticker]: AppIcon.sticker,
};

/** Icon for the CDN `content_type` of an uploaded file. */
export const CONTENT_TYPE_ICON: Record<string, AppIcon> = {
  photo: AppIcon.photo,
  video: AppIcon.video,
  audio: AppIcon.audio,
  document: AppIcon.document,
};

/**
 * Registers every {@link AppIcon} as an SVG icon in `MatIconRegistry` so it can
 * be rendered with `<mat-icon [svgIcon]="AppIcon.x">`. Call once on app start.
 */
export function registerAppIcons(registry: MatIconRegistry, sanitizer: DomSanitizer): void {
  const ids = new Set<string>(Object.values(AppIcon));
  ids.forEach(id => {
    registry.addSvgIcon(
      id,
      sanitizer.bypassSecurityTrustResourceUrl(`/assets/svg-icons/${id}.svg`),
    );
  });
}
