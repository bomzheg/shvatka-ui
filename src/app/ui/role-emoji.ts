/**
 * Default member emoji by role, used when a member has no custom emoji set.
 * Roles are matched case-insensitively after trimming.
 */
const EMOJI_BY_ROLE: Record<string, string> = {
  'капитан': '👑',
  'водитель': '🚗',
  'мозг': '🧠',
  'стационарный мозг': '🧠',
  'мобильный мозг': '📝',
  'полевой': '🔦',
};

const DEFAULT_EMOJI = '🔦';

/**
 * Returns the emoji to show for a team member: the custom one if set,
 * otherwise a role-based default, falling back to {@link DEFAULT_EMOJI}.
 */
export function memberEmoji(emoji: string | null | undefined, role: string | null | undefined): string {
  if (emoji) return emoji;
  const key = (role ?? '').trim().toLowerCase();
  return EMOJI_BY_ROLE[key] ?? DEFAULT_EMOJI;
}
