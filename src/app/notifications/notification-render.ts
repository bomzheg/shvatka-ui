import {AppIcon} from "../ui/icons";
import {AppNotification, NotificationPayload, NotificationType} from "./notifications.models";

/**
 * Pure helpers that turn a notification (`type` + denormalized `payload`)
 * into a Russian display line and an icon. Kept free of Angular so they can
 * be unit-tested without TestBed.
 *
 * All payload reads are defensive: the backend may add types/keys at any
 * time, and unknown values must still render as something sensible.
 */

function str(payload: NotificationPayload, key: string): string {
  const value = payload[key];
  return typeof value === "string" ? value : "";
}

function bool(payload: NotificationPayload, key: string): boolean {
  return payload[key] === true;
}

/** Builds "запрос по команде «X»" style context from whatever keys exist. */
function requestContext(payload: NotificationPayload): string {
  const teamName = str(payload, "team_name");
  if (teamName) {
    return `по команде «${teamName}»`;
  }
  const gameName = str(payload, "game_name");
  if (gameName) {
    return `по игре «${gameName}»`;
  }
  return "";
}

/**
 * Human-readable Russian line for a notification.
 * `currentPlayerId` lets invite texts address the reader directly
 * («Вас приглашают…») when the reader is the target.
 */
export function notificationText(notification: AppNotification, currentPlayerId?: number): string {
  const payload = notification.payload ?? {};
  const playerName = str(payload, "player_name");
  const teamName = str(payload, "team_name");
  const gameName = str(payload, "game_name");

  switch (notification.type) {
    case NotificationType.playerJoinedTeam:
      return bool(payload, "by_self")
        ? `${playerName} вступил(а) в команду «${teamName}»`
        : `${playerName} добавлен(а) в команду «${teamName}»`;
    case NotificationType.playerLeftTeam:
      return bool(payload, "by_self")
        ? `${playerName} покинул(а) команду «${teamName}»`
        : `${playerName} исключён(а) из команды «${teamName}»`;
    case NotificationType.teamRenamed:
      return teamName ? `Команда «${teamName}» переименована` : "Команда переименована";
    case NotificationType.orgAdded:
      return `${str(payload, "org_name")} теперь организатор игры «${gameName}»`;
    case NotificationType.gameScheduleChanged:
      return gameName ? `Изменилось расписание игры «${gameName}»` : "Изменилось расписание игры";
    case NotificationType.seasonScheduleChanged:
      return "Изменилось расписание сезона";
    case NotificationType.teamJoinInvite: {
      const inviter = str(payload, "inviter_name");
      if (currentPlayerId !== undefined && payload["player_id"] === currentPlayerId) {
        return `${inviter} приглашает вас в команду «${teamName}»`;
      }
      return `${inviter} приглашает ${playerName} в команду «${teamName}»`;
    }
    case NotificationType.teamJoinRequest:
      return `${playerName} хочет вступить в команду «${teamName}»`;
    case NotificationType.orgInvite: {
      const author = str(payload, "author_name");
      if (currentPlayerId !== undefined && payload["player_id"] === currentPlayerId) {
        return `${author} приглашает вас организовать игру «${gameName}»`;
      }
      return `${author} приглашает ${playerName} организовать игру «${gameName}»`;
    }
    case NotificationType.requestAccepted: {
      const context = requestContext(payload);
      return context ? `Запрос ${context} принят` : "Запрос принят";
    }
    case NotificationType.requestDeclined: {
      const context = requestContext(payload);
      return context ? `Запрос ${context} отклонён` : "Запрос отклонён";
    }
    default: {
      // Unknown type: show whatever context we can extract instead of crashing.
      const context = requestContext(payload);
      return context ? `Уведомление ${context}` : `Уведомление: ${notification.type}`;
    }
  }
}

const TYPE_ICONS: Record<string, AppIcon> = {
  [NotificationType.playerJoinedTeam]: AppIcon.contact,
  [NotificationType.playerLeftTeam]: AppIcon.contact,
  [NotificationType.teamRenamed]: AppIcon.edit,
  [NotificationType.orgAdded]: AppIcon.key,
  [NotificationType.gameScheduleChanged]: AppIcon.clock,
  [NotificationType.seasonScheduleChanged]: AppIcon.clock,
  [NotificationType.teamJoinInvite]: AppIcon.add,
  [NotificationType.teamJoinRequest]: AppIcon.add,
  [NotificationType.orgInvite]: AppIcon.key,
  [NotificationType.requestAccepted]: AppIcon.check,
  [NotificationType.requestDeclined]: AppIcon.cancel,
};

export function notificationIcon(notification: AppNotification): AppIcon {
  return TYPE_ICONS[notification.type] ?? AppIcon.notifications;
}
