import {notificationIcon, notificationText, requestResultText, requestText} from "./notification-render";
import {ActionRequest, AppNotification} from "./notifications.models";
import {AppIcon} from "../ui/icons";

function makeRequest(type: string, payload: Record<string, unknown>): ActionRequest {
  return {
    id: 1,
    type,
    status: "accepted",
    initiator_id: 1,
    target_player_id: 42,
    team_id: null,
    game_id: null,
    payload,
    created_at: "2026-07-22T17:37:00Z",
    responded_at: "2026-07-22T17:37:20Z",
  };
}

function makeNotification(type: string, payload: Record<string, unknown>): AppNotification {
  return {
    id: 1,
    type,
    severity: "normal",
    payload,
    created_at: "2026-07-06T14:21:20+00:00",
    read: false,
    actor_id: null,
    request_id: null,
  };
}

describe("notificationText", () => {
  it("renders self-join and added-by-manager differently", () => {
    const selfJoin = makeNotification("player_joined_team", {
      player_name: "Вася", team_name: "Сова", by_self: true,
    });
    const added = makeNotification("player_joined_team", {
      player_name: "Вася", team_name: "Сова", by_self: false,
    });

    expect(notificationText(selfJoin)).toBe("Вася вступил(а) в команду «Сова»");
    expect(notificationText(added)).toBe("Вася добавлен(а) в команду «Сова»");
  });

  it("addresses the reader directly when they are the invited player", () => {
    const invite = makeNotification("team_join_invite", {
      inviter_name: "Капитан", inviter_id: 1, player_id: 42, player_name: "Вася", team_name: "Сова",
    });

    expect(notificationText(invite, 42)).toBe("Капитан приглашает вас в команду «Сова»");
    expect(notificationText(invite, 10)).toBe("Капитан приглашает Вася в команду «Сова»");
  });

  it("uses first person when the reader initiated the request", () => {
    const invite = makeNotification("team_join_invite", {
      inviter_name: "Капитан", inviter_id: 1, player_id: 42, player_name: "Вася", team_name: "Сова",
    });
    const ask = makeNotification("team_join_request", {
      player_id: 42, player_name: "Вася", team_name: "Сова",
    });

    expect(notificationText(invite, 1)).toBe("Вы приглашаете Вася в команду «Сова»");
    expect(notificationText(ask, 42)).toBe("Вы хотите вступить в команду «Сова»");
  });

  it("renders an ActionRequest through the same texts", () => {
    const request: ActionRequest = {
      id: 45,
      type: "org_invite",
      status: "pending",
      initiator_id: 1,
      target_player_id: 42,
      team_id: null,
      game_id: 5,
      payload: {author_id: 1, author_name: "Автор", player_id: 42, player_name: "Вася", game_name: "Ночная"},
      created_at: "2026-07-06T14:21:20+00:00",
      responded_at: null,
    };

    expect(requestText(request, 1)).toBe("Вы приглашаете Вася организовать игру «Ночная»");
    expect(requestText(request, 42)).toBe("Автор приглашает вас организовать игру «Ночная»");
  });

  it("renders request results with whatever context the payload has", () => {
    const accepted = makeNotification("request_accepted", {team_name: "Сова"});
    const declined = makeNotification("request_declined", {game_name: "Ночная"});
    const mergeAccepted = makeNotification("request_accepted", {primary_player_name: "harry"});
    const bare = makeNotification("request_accepted", {});

    expect(notificationText(accepted)).toBe("Запрос по команде «Сова» принят");
    expect(notificationText(declined)).toBe("Запрос по игре «Ночная» отклонён");
    expect(notificationText(mergeAccepted)).toBe("Запрос на объединение аккаунта «harry» принят");
    expect(notificationText(bare)).toBe("Запрос принят");
  });

  it("renders a player merge for the admin, the initiator and the primary player", () => {
    const payload = {
      primary_player_id: 3, primary_player_name: "harry",
      secondary_player_id: 8, secondary_player_name: "harry_forum",
      initiator_id: 3, initiator_name: "harry",
    };
    const notification = makeNotification("player_merge_request", payload);

    expect(notificationText(notification))
      .toBe("harry просит объединить аккаунт «harry_forum» с аккаунтом «harry»");
    expect(notificationText(notification, 3))
      .toBe("Вы просите объединить аккаунт «harry_forum» с аккаунтом «harry»");

    const byAdmin = makeNotification("player_merge_request", {...payload, initiator_id: 1, initiator_name: "админ"});
    expect(notificationText(byAdmin, 3))
      .toBe("админ предлагает объединить ваш аккаунт с «harry_forum» — ждёт подтверждения администратора");
  });

  it("renders a team merge and uses first person for the captain", () => {
    const payload = {
      primary_team_id: 5, primary_team_name: "Gryffindor",
      secondary_team_id: 9, secondary_team_name: "Gryffindor (forum)",
      captain_id: 1, captain_name: "cap",
    };
    const notification = makeNotification("team_merge_request", payload);

    expect(notificationText(notification))
      .toBe("cap просит объединить команду «Gryffindor» с форумной копией «Gryffindor (forum)»");
    expect(notificationText(notification, 1))
      .toBe("Вы просите объединить команду «Gryffindor» с форумной копией «Gryffindor (forum)»");
  });

  it("renders merge ActionRequests through the same texts as their notifications", () => {
    const request: ActionRequest = {
      id: 17,
      type: "player_merge",
      status: "pending",
      initiator_id: 3,
      target_player_id: 3,
      team_id: null,
      game_id: null,
      payload: {
        primary_player_id: 3, primary_player_name: "harry",
        secondary_player_id: 8, secondary_player_name: "harry_forum",
        initiator_id: 3, initiator_name: "harry",
      },
      created_at: "2026-07-20T15:44:00Z",
      responded_at: null,
    };

    expect(requestText(request)).toBe("harry просит объединить аккаунт «harry_forum» с аккаунтом «harry»");
    expect(requestText(request, 3)).toBe("Вы просите объединить аккаунт «harry_forum» с аккаунтом «harry»");
  });

  it("renders a promotion invite for the inviter, the target and a bystander", () => {
    const payload = {inviter_id: 1, inviter_name: "Автор", player_id: 42, player_name: "Вася"};
    const notification = makeNotification("promotion_invite", payload);

    expect(notificationText(notification, 1)).toBe("Вы приглашаете Вася стать автором");
    expect(notificationText(notification, 42)).toBe("Автор приглашает вас стать автором");
    expect(notificationText(notification)).toBe("Автор приглашает Вася стать автором");
  });

  it("renders a promotion ActionRequest through the same texts", () => {
    const request: ActionRequest = {
      id: 71,
      type: "promotion",
      status: "pending",
      initiator_id: 1,
      target_player_id: 42,
      team_id: null,
      game_id: null,
      payload: {inviter_id: 1, inviter_name: "Автор", player_id: 42, player_name: "Вася"},
      created_at: "2026-07-20T15:44:00Z",
      responded_at: null,
    };

    expect(requestText(request, 1)).toBe("Вы приглашаете Вася стать автором");
    expect(requestText(request, 42)).toBe("Автор приглашает вас стать автором");
  });

  it("does not crash on an unknown type (open enum)", () => {
    const unknown = makeNotification("brand_new_type", {team_name: "Сова"});
    const unknownBare = makeNotification("brand_new_type", {});

    expect(notificationText(unknown)).toBe("Уведомление по команде «Сова»");
    expect(notificationText(unknownBare)).toBe("Уведомление: brand_new_type");
  });

  it("survives a missing/garbage payload", () => {
    const broken = makeNotification("player_left_team", {by_self: "yes", player_name: 5});
    expect(() => notificationText(broken)).not.toThrow();
  });
});

describe("requestResultText", () => {
  it("names the request kind and the other party for invite outcomes", () => {
    const promotion = makeRequest("promotion", {
      inviter_id: 1, inviter_name: "Автор", player_id: 42, player_name: "Вася",
    });
    expect(requestResultText(promotion, true)).toBe("Вася принял(а) приглашение стать автором");
    expect(requestResultText(promotion, false)).toBe("Вася отклонил(а) приглашение стать автором");

    const teamInvite = makeRequest("team_join_invite", {
      inviter_name: "Капитан", player_name: "Вася", team_name: "Сова",
    });
    expect(requestResultText(teamInvite, true)).toBe("Вася принял(а) приглашение в команду «Сова»");

    const orgInvite = makeRequest("org_invite", {
      author_name: "Автор", player_name: "Вася", game_name: "Ночная",
    });
    expect(requestResultText(orgInvite, true)).toBe("Вася принял(а) приглашение организовать игру «Ночная»");
  });

  it("phrases an ask-to-join outcome as the reader's own request", () => {
    const ask = makeRequest("team_join_request", {player_name: "Вася", team_name: "Сова"});
    expect(requestResultText(ask, true)).toBe("Ваш запрос на вступление в команду «Сова» принят");
    expect(requestResultText(ask, false)).toBe("Ваш запрос на вступление в команду «Сова» отклонён");
  });

  it("falls back to context or the bare result for other/unknown types", () => {
    const merge = makeRequest("player_merge", {primary_player_name: "harry"});
    expect(requestResultText(merge, true)).toBe("Запрос на объединение аккаунта «harry» принят");

    const bare = makeRequest("brand_new_type", {});
    expect(requestResultText(bare, true)).toBe("Запрос принят");
    expect(requestResultText(bare, false)).toBe("Запрос отклонён");
  });
});

describe("notificationIcon", () => {
  it("maps known types and falls back to the bell for unknown ones", () => {
    expect(notificationIcon(makeNotification("request_accepted", {}))).toBe(AppIcon.check);
    expect(notificationIcon(makeNotification("game_schedule_changed", {}))).toBe(AppIcon.clock);
    expect(notificationIcon(makeNotification("player_merge_request", {}))).toBe(AppIcon.merge);
    expect(notificationIcon(makeNotification("team_merge_request", {}))).toBe(AppIcon.merge);
    expect(notificationIcon(makeNotification("promotion_invite", {}))).toBe(AppIcon.key);
    expect(notificationIcon(makeNotification("brand_new_type", {}))).toBe(AppIcon.notifications);
  });
});
