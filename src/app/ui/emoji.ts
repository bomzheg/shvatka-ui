import {HintType} from "../domain/game.models";

/**
 * Central registry of every emoji used in the UI.
 *
 * Do not hardcode emoji in templates/components — always reference this enum.
 * The names (not the glyphs) are the stable contract: when we later replace
 * emoji with SVG icons, this is the single place to swap (e.g. by mapping the
 * same names to `MatIcon` svg ids).
 */
export enum AppEmoji {
  // game mechanics
  key = "🔑",
  timer = "⏱️",
  autoFinish = "⏰",
  bonusHint = "💡",
  bonus = "💰",
  penalty = "💸",
  jump = "🔀",
  levelUp = "✅",
  level = "🧩",
  // files
  files = "📁",
  upload = "📤",
  // hint part types
  text = "📝",
  gps = "📍",
  venue = "🏛️",
  photo = "📷",
  audio = "🎵",
  video = "🎬",
  document = "📄",
  animation = "🎞️",
  voice = "🎤",
  videoNote = "📹",
  contact = "👤",
  sticker = "🖼️",
}

export const HINT_TYPE_EMOJI: Record<HintType, AppEmoji> = {
  [HintType.text]: AppEmoji.text,
  [HintType.gps]: AppEmoji.gps,
  [HintType.venue]: AppEmoji.venue,
  [HintType.photo]: AppEmoji.photo,
  [HintType.audio]: AppEmoji.audio,
  [HintType.video]: AppEmoji.video,
  [HintType.document]: AppEmoji.document,
  [HintType.animation]: AppEmoji.animation,
  [HintType.voice]: AppEmoji.voice,
  [HintType.video_note]: AppEmoji.videoNote,
  [HintType.contact]: AppEmoji.contact,
  [HintType.sticker]: AppEmoji.sticker,
};

/** Emoji for the CDN `content_type` of an uploaded file. */
export const CONTENT_TYPE_EMOJI: Record<string, AppEmoji> = {
  photo: AppEmoji.photo,
  video: AppEmoji.video,
  audio: AppEmoji.audio,
  document: AppEmoji.document,
};
