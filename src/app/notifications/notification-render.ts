import {AppIcon} from "../ui/icons";
import {ActionRequest, AppNotification, NotificationPayload, NotificationType, RequestType} from "./notifications.models";

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
  const primaryTeamName = str(payload, "primary_team_name");
  if (primaryTeamName) {
    return `на объединение команды «${primaryTeamName}»`;
  }
  const primaryPlayerName = str(payload, "primary_player_name");
  if (primaryPlayerName) {
    return `на объединение аккаунта «${primaryPlayerName}»`;
  }
  return "";
}

/**
 * Human-readable Russian line for a notification.
 * `currentPlayerId` lets invite texts address the reader directly
 * («Вас приглашают…») when the reader is the target.
 */
export function notificationText(notification: AppNotification, currentPlayerId?: number): string {
  return renderTypeText(notification.type, notification.payload ?? {}, currentPlayerId);
}

/** Same rendering for an ActionRequest (its payload mirrors the notification's). */
export function requestText(request: ActionRequest, currentPlayerId?: number): string {
  return renderTypeText(request.type, request.payload ?? {}, currentPlayerId);
}

function renderTypeText(type: string, payload: NotificationPayload, currentPlayerId?: number): string {
  const playerName = str(payload, "player_name");
  const teamName = str(payload, "team_name");
  const gameName = str(payload, "game_name");

  switch (type) {
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
      if (currentPlayerId !== undefined && payload["inviter_id"] === currentPlayerId) {
        return `Вы приглашаете ${playerName} в команду «${teamName}»`;
      }
      if (currentPlayerId !== undefined && payload["player_id"] === currentPlayerId) {
        return `${inviter} приглашает вас в команду «${teamName}»`;
      }
      return `${inviter} приглашает ${playerName} в команду «${teamName}»`;
    }
    case NotificationType.teamJoinRequest:
      if (currentPlayerId !== undefined && payload["player_id"] === currentPlayerId) {
        return `Вы хотите вступить в команду «${teamName}»`;
      }
      return `${playerName} хочет вступить в команду «${teamName}»`;
    case NotificationType.orgInvite: {
      const author = str(payload, "author_name");
      if (currentPlayerId !== undefined && payload["author_id"] === currentPlayerId) {
        return `Вы приглашаете ${playerName} организовать игру «${gameName}»`;
      }
      if (currentPlayerId !== undefined && payload["player_id"] === currentPlayerId) {
        return `${author} приглашает вас организовать игру «${gameName}»`;
      }
      return `${author} приглашает ${playerName} организовать игру «${gameName}»`;
    }
    // Merge requests: the ActionRequest type and the notification type that
    // announces it to superusers differ, but the payload is the same.
    case RequestType.playerMerge:
    case NotificationType.playerMergeRequest: {
      const primary = str(payload, "primary_player_name");
      const secondary = str(payload, "secondary_player_name");
      const initiator = str(payload, "initiator_name");
      if (currentPlayerId !== undefined && payload["initiator_id"] === currentPlayerId) {
        return `Вы просите объединить аккаунт «${secondary}» с аккаунтом «${primary}»`;
      }
      if (currentPlayerId !== undefined && payload["primary_player_id"] === currentPlayerId) {
        return `${initiator} предлагает объединить ваш аккаунт с «${secondary}» — ждёт подтверждения администратора`;
      }
      return `${initiator} просит объединить аккаунт «${secondary}» с аккаунтом «${primary}»`;
    }
    case RequestType.teamMerge:
    case NotificationType.teamMergeRequest: {
      const primary = str(payload, "primary_team_name");
      const secondary = str(payload, "secondary_team_name");
      const captain = str(payload, "captain_name");
      if (currentPlayerId !== undefined && payload["captain_id"] === currentPlayerId) {
        return `Вы просите объединить команду «${primary}» с форумной копией «${secondary}»`;
      }
      return `${captain} просит объединить команду «${primary}» с форумной копией «${secondary}»`;
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
      return context ? `Уведомление ${context}` : `Уведомление: ${type}`;
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
  [NotificationType.teamMergeRequest]: AppIcon.merge,
  [NotificationType.playerMergeRequest]: AppIcon.merge,
  [RequestType.teamMerge]: AppIcon.merge,
  [RequestType.playerMerge]: AppIcon.merge,
  [NotificationType.requestAccepted]: AppIcon.check,
  [NotificationType.requestDeclined]: AppIcon.cancel,
};

export function typeIcon(type: string): AppIcon {
  return TYPE_ICONS[type] ?? AppIcon.notifications;
}

export function notificationIcon(notification: AppNotification): AppIcon {
  return typeIcon(notification.type);
}
