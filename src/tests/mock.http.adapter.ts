import {Injectable} from "@angular/core";
import {Observable} from "rxjs";
import {UserData} from "../app/auth/user.service";
import {Game, Page} from "../app/games/games.service";
import {FullGame, HintPart, HintType, Keys, KeyTime, Level, Scenario, TimeHint} from "../app/game/game.service";

const team1 = {
  "id": 2,
  "name": "команда командиров",
  "captain": {
    "id": 3,
    "can_be_author": true,
    "is_dummy": false,
    "_user": {
      "tg_id": 32121,
      "db_id": 75,
      "username": null,
      "first_name": "капитан",
      "last_name": null,
      "is_bot": false
    },
    "_forum_user": null
  },
  "is_dummy": false,
  "description": null,
  "_chat": {
    "tg_id": -1001771824557,
    "type": 4,
    "db_id": 62,
    "username": null,
    "title": "команда командиров",
    "first_name": null,
    "last_name": null,
    "description": null
  },
  "_forum_team": null
};
const team42 = {
  "id": 1,
  "name": "Название команды",
  "captain": {
    "id": 2,
    "can_be_author": true,
    "is_dummy": false,
    "_user": {
      "tg_id": 12321,
      "db_id": 66,
      "username": null,
      "first_name": "Ivan",
      "last_name": "Ivanov",
      "is_bot": false
    },
    "_forum_user": null
  },
  "is_dummy": false,
  "description": null,
  "_chat": {
    "tg_id": -1001549956989,
    "type": 4,
    "db_id": 55,
    "username": null,
    "title": "Название команды",
    "first_name": null,
    "last_name": null,
    "description": null
  },
  "_forum_team": null
};
const player = {
  "id": 3,
  "can_be_author": true,
  "is_dummy": false,
  "_user": {
    "tg_id": 32121,
    "db_id": 75,
    "username": null,
    "first_name": "капитан",
    "last_name": null,
    "is_bot": false
  },
  "_forum_user": null
}
const player2 = {
  "id": 2,
    "can_be_author": true,
    "is_dummy": false,
    "_user": {
    "tg_id": 12321,
      "db_id": 66,
      "username": null,
      "first_name": "Ivan",
      "last_name": "Ivanov",
      "is_bot": false
  },
  "_forum_user": null
}
const keyResponse = {
  "2": [
    {
      "text": "SH1",
      "type_": "wrong",
      "is_duplicate": false,
      "at": "2024-02-27T07:22:43.030123+00:00",
      "level_number": 0,
      "player": {
        "id": 3,
        "can_be_author": true,
        "is_dummy": false,
        "_user": {
          "tg_id": 5778822859,
          "db_id": 75,
          "username": null,
          "first_name": "капитан",
          "last_name": null,
          "is_bot": false
        },
        "_forum_user": null
      },
      "team": {
        "id": 2,
        "name": "команда командиров",
        "captain": {
          "id": 3,
          "can_be_author": true,
          "is_dummy": false,
          "_user": {
            "tg_id": 5778822859,
            "db_id": 75,
            "username": null,
            "first_name": "капитан",
            "last_name": null,
            "is_bot": false
          },
          "_forum_user": null
        },
        "is_dummy": false,
        "description": null,
        "_chat": {
          "tg_id": -1001771824557,
          "type": 4,
          "db_id": 62,
          "username": null,
          "title": "команда командиров",
          "first_name": null,
          "last_name": null,
          "description": null
        },
        "_forum_team": null
      }
    },
    {
      "text": "SH2",
      "type_": "wrong",
      "is_duplicate": false,
      "at": "2024-02-27T07:22:46.772315+00:00",
      "level_number": 0,
      "player": {
        "id": 3,
        "can_be_author": true,
        "is_dummy": false,
        "_user": {
          "tg_id": 5778822859,
          "db_id": 75,
          "username": null,
          "first_name": "капитан",
          "last_name": null,
          "is_bot": false
        },
        "_forum_user": null
      },
      "team": {
        "id": 2,
        "name": "команда командиров",
        "captain": {
          "id": 3,
          "can_be_author": true,
          "is_dummy": false,
          "_user": {
            "tg_id": 5778822859,
            "db_id": 75,
            "username": null,
            "first_name": "капитан",
            "last_name": null,
            "is_bot": false
          },
          "_forum_user": null
        },
        "is_dummy": false,
        "description": null,
        "_chat": {
          "tg_id": -1001771824557,
          "type": 4,
          "db_id": 62,
          "username": null,
          "title": "команда командиров",
          "first_name": null,
          "last_name": null,
          "description": null
        },
        "_forum_team": null
      }
    },
    {
      "text": "СХ1",
      "type_": "wrong",
      "is_duplicate": false,
      "at": "2024-02-27T07:22:50.896739+00:00",
      "level_number": 0,
      "player": {
        "id": 3,
        "can_be_author": true,
        "is_dummy": false,
        "_user": {
          "tg_id": 5778822859,
          "db_id": 75,
          "username": null,
          "first_name": "капитан",
          "last_name": null,
          "is_bot": false
        },
        "_forum_user": null
      },
      "team": {
        "id": 2,
        "name": "команда командиров",
        "captain": {
          "id": 3,
          "can_be_author": true,
          "is_dummy": false,
          "_user": {
            "tg_id": 5778822859,
            "db_id": 75,
            "username": null,
            "first_name": "капитан",
            "last_name": null,
            "is_bot": false
          },
          "_forum_user": null
        },
        "is_dummy": false,
        "description": null,
        "_chat": {
          "tg_id": -1001771824557,
          "type": 4,
          "db_id": 62,
          "username": null,
          "title": "команда командиров",
          "first_name": null,
          "last_name": null,
          "description": null
        },
        "_forum_team": null
      }
    },
    {
      "text": "СХ123",
      "type_": "wrong",
      "is_duplicate": false,
      "at": "2024-02-27T07:22:55.361916+00:00",
      "level_number": 0,
      "player": {
        "id": 3,
        "can_be_author": true,
        "is_dummy": false,
        "_user": {
          "tg_id": 5778822859,
          "db_id": 75,
          "username": null,
          "first_name": "капитан",
          "last_name": null,
          "is_bot": false
        },
        "_forum_user": null
      },
      "team": {
        "id": 2,
        "name": "команда командиров",
        "captain": {
          "id": 3,
          "can_be_author": true,
          "is_dummy": false,
          "_user": {
            "tg_id": 5778822859,
            "db_id": 75,
            "username": null,
            "first_name": "капитан",
            "last_name": null,
            "is_bot": false
          },
          "_forum_user": null
        },
        "is_dummy": false,
        "description": null,
        "_chat": {
          "tg_id": -1001771824557,
          "type": 4,
          "db_id": 62,
          "username": null,
          "title": "команда командиров",
          "first_name": null,
          "last_name": null,
          "description": null
        },
        "_forum_team": null
      }
    },
    {
      "text": "SH123",
      "type_": "simple",
      "is_duplicate": false,
      "at": "2024-02-27T07:30:42.524332+00:00",
      "level_number": 0,
      "player": {
        "id": 3,
        "can_be_author": true,
        "is_dummy": false,
        "_user": {
          "tg_id": 5778822859,
          "db_id": 75,
          "username": null,
          "first_name": "капитан",
          "last_name": null,
          "is_bot": false
        },
        "_forum_user": null
      },
      "team": {
        "id": 2,
        "name": "команда командиров",
        "captain": {
          "id": 3,
          "can_be_author": true,
          "is_dummy": false,
          "_user": {
            "tg_id": 5778822859,
            "db_id": 75,
            "username": null,
            "first_name": "капитан",
            "last_name": null,
            "is_bot": false
          },
          "_forum_user": null
        },
        "is_dummy": false,
        "description": null,
        "_chat": {
          "tg_id": -1001771824557,
          "type": 4,
          "db_id": 62,
          "username": null,
          "title": "команда командиров",
          "first_name": null,
          "last_name": null,
          "description": null
        },
        "_forum_team": null
      }
    },
    {
      "text": "СХ543",
      "type_": "wrong",
      "is_duplicate": false,
      "at": "2024-02-27T08:04:54.599461+00:00",
      "level_number": 1,
      "player": {
        "id": 3,
        "can_be_author": true,
        "is_dummy": false,
        "_user": {
          "tg_id": 5778822859,
          "db_id": 75,
          "username": null,
          "first_name": "капитан",
          "last_name": null,
          "is_bot": false
        },
        "_forum_user": null
      },
      "team": {
        "id": 2,
        "name": "команда командиров",
        "captain": {
          "id": 3,
          "can_be_author": true,
          "is_dummy": false,
          "_user": {
            "tg_id": 5778822859,
            "db_id": 75,
            "username": null,
            "first_name": "капитан",
            "last_name": null,
            "is_bot": false
          },
          "_forum_user": null
        },
        "is_dummy": false,
        "description": null,
        "_chat": {
          "tg_id": -1001771824557,
          "type": 4,
          "db_id": 62,
          "username": null,
          "title": "команда командиров",
          "first_name": null,
          "last_name": null,
          "description": null
        },
        "_forum_team": null
      }
    },
    {
      "text": "SH543",
      "type_": "wrong",
      "is_duplicate": false,
      "at": "2024-02-27T08:05:10.413031+00:00",
      "level_number": 1,
      "player": {
        "id": 3,
        "can_be_author": true,
        "is_dummy": false,
        "_user": {
          "tg_id": 5778822859,
          "db_id": 75,
          "username": null,
          "first_name": "капитан",
          "last_name": null,
          "is_bot": false
        },
        "_forum_user": null
      },
      "team": {
        "id": 2,
        "name": "команда командиров",
        "captain": {
          "id": 3,
          "can_be_author": true,
          "is_dummy": false,
          "_user": {
            "tg_id": 5778822859,
            "db_id": 75,
            "username": null,
            "first_name": "капитан",
            "last_name": null,
            "is_bot": false
          },
          "_forum_user": null
        },
        "is_dummy": false,
        "description": null,
        "_chat": {
          "tg_id": -1001771824557,
          "type": 4,
          "db_id": 62,
          "username": null,
          "title": "команда командиров",
          "first_name": null,
          "last_name": null,
          "description": null
        },
        "_forum_team": null
      }
    },
    {
      "text": "SH123",
      "type_": "simple",
      "is_duplicate": false,
      "at": "2024-02-27T08:40:54.186750+00:00",
      "level_number": 1,
      "player": {
        "id": 3,
        "can_be_author": true,
        "is_dummy": false,
        "_user": {
          "tg_id": 5778822859,
          "db_id": 75,
          "username": null,
          "first_name": "капитан",
          "last_name": null,
          "is_bot": false
        },
        "_forum_user": null
      },
      "team": {
        "id": 2,
        "name": "команда командиров",
        "captain": {
          "id": 3,
          "can_be_author": true,
          "is_dummy": false,
          "_user": {
            "tg_id": 5778822859,
            "db_id": 75,
            "username": null,
            "first_name": "капитан",
            "last_name": null,
            "is_bot": false
          },
          "_forum_user": null
        },
        "is_dummy": false,
        "description": null,
        "_chat": {
          "tg_id": -1001771824557,
          "type": 4,
          "db_id": 62,
          "username": null,
          "title": "команда командиров",
          "first_name": null,
          "last_name": null,
          "description": null
        },
        "_forum_team": null
      }
    },
    {
      "text": "SH321",
      "type_": "simple",
      "is_duplicate": false,
      "at": "2024-02-27T08:47:50.269908+00:00",
      "level_number": 2,
      "player": {
        "id": 3,
        "can_be_author": true,
        "is_dummy": false,
        "_user": {
          "tg_id": 5778822859,
          "db_id": 75,
          "username": null,
          "first_name": "капитан",
          "last_name": null,
          "is_bot": false
        },
        "_forum_user": null
      },
      "team": {
        "id": 2,
        "name": "команда командиров",
        "captain": {
          "id": 3,
          "can_be_author": true,
          "is_dummy": false,
          "_user": {
            "tg_id": 5778822859,
            "db_id": 75,
            "username": null,
            "first_name": "капитан",
            "last_name": null,
            "is_bot": false
          },
          "_forum_user": null
        },
        "is_dummy": false,
        "description": null,
        "_chat": {
          "tg_id": -1001771824557,
          "type": 4,
          "db_id": 62,
          "username": null,
          "title": "команда командиров",
          "first_name": null,
          "last_name": null,
          "description": null
        },
        "_forum_team": null
      }
    },
    {
      "text": "SH123",
      "type_": "simple",
      "is_duplicate": false,
      "at": "2024-02-27T08:47:55.545393+00:00",
      "level_number": 2,
      "player": {
        "id": 3,
        "can_be_author": true,
        "is_dummy": false,
        "_user": {
          "tg_id": 5778822859,
          "db_id": 75,
          "username": null,
          "first_name": "капитан",
          "last_name": null,
          "is_bot": false
        },
        "_forum_user": null
      },
      "team": {
        "id": 2,
        "name": "команда командиров",
        "captain": {
          "id": 3,
          "can_be_author": true,
          "is_dummy": false,
          "_user": {
            "tg_id": 5778822859,
            "db_id": 75,
            "username": null,
            "first_name": "капитан",
            "last_name": null,
            "is_bot": false
          },
          "_forum_user": null
        },
        "is_dummy": false,
        "description": null,
        "_chat": {
          "tg_id": -1001771824557,
          "type": 4,
          "db_id": 62,
          "username": null,
          "title": "команда командиров",
          "first_name": null,
          "last_name": null,
          "description": null
        },
        "_forum_team": null
      }
    },
    {
      "text": "SH123",
      "type_": "simple",
      "is_duplicate": false,
      "at": "2024-02-27T08:48:06.224876+00:00",
      "level_number": 3,
      "player": {
        "id": 3,
        "can_be_author": true,
        "is_dummy": false,
        "_user": {
          "tg_id": 5778822859,
          "db_id": 75,
          "username": null,
          "first_name": "капитан",
          "last_name": null,
          "is_bot": false
        },
        "_forum_user": null
      },
      "team": {
        "id": 2,
        "name": "команда командиров",
        "captain": {
          "id": 3,
          "can_be_author": true,
          "is_dummy": false,
          "_user": {
            "tg_id": 5778822859,
            "db_id": 75,
            "username": null,
            "first_name": "капитан",
            "last_name": null,
            "is_bot": false
          },
          "_forum_user": null
        },
        "is_dummy": false,
        "description": null,
        "_chat": {
          "tg_id": -1001771824557,
          "type": 4,
          "db_id": 62,
          "username": null,
          "title": "команда командиров",
          "first_name": null,
          "last_name": null,
          "description": null
        },
        "_forum_team": null
      }
    }
  ],
  "1": [
    {
      "text": "SH123",
      "type_": "simple",
      "is_duplicate": false,
      "at": "2024-02-27T08:06:22.605183+00:00",
      "level_number": 0,
      "player": {
        "id": 2,
        "can_be_author": true,
        "is_dummy": false,
        "_user": {
          "tg_id": 487754183,
          "db_id": 66,
          "username": null,
          "first_name": "William",
          "last_name": "Murderface",
          "is_bot": false
        },
        "_forum_user": null
      },
      "team": {
        "id": 1,
        "name": "Название команды",
        "captain": {
          "id": 2,
          "can_be_author": true,
          "is_dummy": false,
          "_user": {
            "tg_id": 487754183,
            "db_id": 66,
            "username": null,
            "first_name": "William",
            "last_name": "Murderface",
            "is_bot": false
          },
          "_forum_user": null
        },
        "is_dummy": false,
        "description": null,
        "_chat": {
          "tg_id": -1001549956989,
          "type": 4,
          "db_id": 55,
          "username": null,
          "title": "Название команды",
          "first_name": null,
          "last_name": null,
          "description": null
        },
        "_forum_team": null
      }
    },
    {
      "text": "SH123",
      "type_": "simple",
      "is_duplicate": false,
      "at": "2024-02-27T08:40:26.074603+00:00",
      "level_number": 1,
      "player": {
        "id": 2,
        "can_be_author": true,
        "is_dummy": false,
        "_user": {
          "tg_id": 487754183,
          "db_id": 66,
          "username": null,
          "first_name": "William",
          "last_name": "Murderface",
          "is_bot": false
        },
        "_forum_user": null
      },
      "team": {
        "id": 1,
        "name": "Название команды",
        "captain": {
          "id": 2,
          "can_be_author": true,
          "is_dummy": false,
          "_user": {
            "tg_id": 487754183,
            "db_id": 66,
            "username": null,
            "first_name": "William",
            "last_name": "Murderface",
            "is_bot": false
          },
          "_forum_user": null
        },
        "is_dummy": false,
        "description": null,
        "_chat": {
          "tg_id": -1001549956989,
          "type": 4,
          "db_id": 55,
          "username": null,
          "title": "Название команды",
          "first_name": null,
          "last_name": null,
          "description": null
        },
        "_forum_team": null
      }
    },
    {
      "text": "SH123",
      "type_": "simple",
      "is_duplicate": false,
      "at": "2024-02-27T12:09:25.742597+00:00",
      "level_number": 2,
      "player": {
        "id": 2,
        "can_be_author": true,
        "is_dummy": false,
        "_user": {
          "tg_id": 487754183,
          "db_id": 66,
          "username": null,
          "first_name": "William",
          "last_name": "Murderface",
          "is_bot": false
        },
        "_forum_user": null
      },
      "team": {
        "id": 1,
        "name": "Название команды",
        "captain": {
          "id": 2,
          "can_be_author": true,
          "is_dummy": false,
          "_user": {
            "tg_id": 487754183,
            "db_id": 66,
            "username": null,
            "first_name": "William",
            "last_name": "Murderface",
            "is_bot": false
          },
          "_forum_user": null
        },
        "is_dummy": false,
        "description": null,
        "_chat": {
          "tg_id": -1001549956989,
          "type": 4,
          "db_id": 55,
          "username": null,
          "title": "Название команды",
          "first_name": null,
          "last_name": null,
          "description": null
        },
        "_forum_team": null
      }
    },
    {
      "text": "SH321",
      "type_": "simple",
      "is_duplicate": false,
      "at": "2024-02-27T12:09:29.417825+00:00",
      "level_number": 2,
      "player": {
        "id": 2,
        "can_be_author": true,
        "is_dummy": false,
        "_user": {
          "tg_id": 487754183,
          "db_id": 66,
          "username": null,
          "first_name": "William",
          "last_name": "Murderface",
          "is_bot": false
        },
        "_forum_user": null
      },
      "team": {
        "id": 1,
        "name": "Название команды",
        "captain": {
          "id": 2,
          "can_be_author": true,
          "is_dummy": false,
          "_user": {
            "tg_id": 487754183,
            "db_id": 66,
            "username": null,
            "first_name": "William",
            "last_name": "Murderface",
            "is_bot": false
          },
          "_forum_user": null
        },
        "is_dummy": false,
        "description": null,
        "_chat": {
          "tg_id": -1001549956989,
          "type": 4,
          "db_id": 55,
          "username": null,
          "title": "Название команды",
          "first_name": null,
          "last_name": null,
          "description": null
        },
        "_forum_team": null
      }
    },
    {
      "text": "SH123",
      "type_": "simple",
      "is_duplicate": false,
      "at": "2024-02-27T12:15:20.078393+00:00",
      "level_number": 3,
      "player": {
        "id": 2,
        "can_be_author": true,
        "is_dummy": false,
        "_user": {
          "tg_id": 487754183,
          "db_id": 66,
          "username": null,
          "first_name": "William",
          "last_name": "Murderface",
          "is_bot": false
        },
        "_forum_user": null
      },
      "team": {
        "id": 1,
        "name": "Название команды",
        "captain": {
          "id": 2,
          "can_be_author": true,
          "is_dummy": false,
          "_user": {
            "tg_id": 487754183,
            "db_id": 66,
            "username": null,
            "first_name": "William",
            "last_name": "Murderface",
            "is_bot": false
          },
          "_forum_user": null
        },
        "is_dummy": false,
        "description": null,
        "_chat": {
          "tg_id": -1001549956989,
          "type": 4,
          "db_id": 55,
          "username": null,
          "title": "Название команды",
          "first_name": null,
          "last_name": null,
          "description": null
        },
        "_forum_team": null
      }
    }
  ]
};

@Injectable({
  providedIn: "root",
})
export class HttpAdapter {
  private authorized: boolean = false;
  private readonly user: UserData;
  private readonly games: Page<Game>;
  private readonly first_game: FullGame;
  private readonly keys: Keys;
  constructor() {
    this.user = new UserData();
    this.user.username = "admin"
    this.games = new Page<Game>(
      [
        new Game(4, "Название игры", 4),
        new Game(3, "Весёлая игра", 3),
        new Game(2, "Ещё какая-то", 2),
        new Game(1, "Some English name", 1),
      ]
    );
    this.first_game = new FullGame(
      1,
      "admin",
      "Название игры",
      "complete",
      "2022-05-12T23:00:00",
      [new Level(
        5,
        "foo",
        "admin",
        new Scenario(
          "foo",
          [
            new TimeHint(
              0, [
                HintPart.create({type: HintType.text, text: "puzzle time"}),
              ]
            ),
            new TimeHint(
              5, [
                HintPart.create({type: HintType.text, text: "some hint"}),
                HintPart.create({type: HintType.photo, file_guid: "be9b08d4-1775-476b-87b6-e2219b9ecb01"}),
              ]
            ),
            new TimeHint(
              10, [
                HintPart.create({type: HintType.text, text: "SH123"}),
              ]
            ),
          ],
          ["SH123"],
          []
        ),
        1,
        0
      )]
    );
    this.keys = new Map([
      [1, [
        new KeyTime(
          "SH123",
          "wrong",
          false,
          new Date(Date.now()).toDateString(),
          0,
          player,
          team1
        ),
        new KeyTime(
          "SH124",
          "simple",
          false,
          new Date(Date.now()).toDateString(),
          0,
          player,
          team1
        ),
        new KeyTime(
          "SH125",
          "simple",
          false,
          new Date(Date.now()).toDateString(),
          1,
          player,
          team1
        ),
      ]],
      [2, [
        new KeyTime(
          "SH124",
          "simple",
          false,
          new Date(Date.now()).toDateString(),
          0,
          player2,
          team42
        ),
        new KeyTime(
          "SH125",
          "simple",
          false,
          new Date(Date.now()).toDateString(),
          1,
          player2,
          team42
        ),
      ]],
    ]);
  }

  postWithoutCookies<T>(url: string, body: any): Observable<T> {
    switch (url) {
      case "/auth/token":
        body = body as FormData;
        let username = body.get("username");
        let password = body.get("password");
        if (username === "admin" && password === "admin") {
          this.authorized = true;
          return new Observable<T>(o=> o.next());
        } else {
          return new Observable<T>(() => {throw new Error("403")});
        }
      default:
        return new Observable<T>(() => {throw new Error("Not implemented")});
    }
  }

  post<T>(url: string, body: any): Observable<T> {
    switch (url) {
      case "/auth/logout":
        this.authorized = false;
        return new Observable<T>(o=> o.next());
      default:
        return new Observable<T>(() => {throw new Error("Not implemented")});
    }
  }

  get<T>(url: string): Observable<T> {
    switch (url) {
      case "/users/me":
        if (this.authorized) {
          return new Observable<T>(o => o.next(this.user as T))
        }
        return new Observable<T>( () => {throw new Error("401")});
      case "/games":
        return new Observable<T>(o=> o.next(this.games as T));
      case "/games/1":
        if (!this.authorized) {
          return new Observable<T>(() => {throw new Error("401")})
        }
        return new Observable<T>(o=> o.next(this.first_game as T));
      case "/games/2":
        if (!this.authorized) {
          return new Observable<T>(() => {throw new Error("401")})
        }
        return new Observable<T>(o=> o.next(this.first_game as T));
      case "/games/3":
        if (!this.authorized) {
          return new Observable<T>(() => {throw new Error("401")})
        }
        return new Observable<T>(o=> o.next(this.first_game as T));
      case "/games/4":
        if (!this.authorized) {
          return new Observable<T>(() => {throw new Error("401")})
        }
        return new Observable<T>(o=> o.next(this.first_game as T));
      case "/games/4/keys":
        if (!this.authorized) {
          return new Observable<T>(() => {throw new Error("401")})
        }
        return new Observable<T>(o=> o.next(keyResponse as T));
      default:
        return new Observable<T>(() => {throw new Error("Not implemented")});
    }
  }


  getWithQuery<T>(
    url: string,
    query: any
  ): Observable<T> {

    switch (url) {
      case "/auth/login/data":
        return new Observable<T>(() => {throw new Error("Not implemented")});
      default:
        return new Observable<T>(() => {throw new Error("Not implemented")});
    }
  }

  getFileUrl(gameId: number, fileId: string): string {
    return `/assets/scenario/${fileId}`;
  }
}
