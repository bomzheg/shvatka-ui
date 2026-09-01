import {of, throwError} from 'rxjs';
import {HttpErrorResponse} from '@angular/common/http';
import {AdminWaiversComponent} from './admin-waivers.component';
import {AdminService} from './admin.service';
import {TeamService} from '../team/team.service';
import {SnackbarService} from '../snackbar/snackbar.service';
import {GameWaivers, TeamWaivers} from './admin.models';
import {Game, Page} from '../games/games.service';
import {TeamDetails, TeamMember} from '../team/team.models';

function team(id: number, name: string): TeamDetails {
  return {id, name, description: null, captain: null};
}

function member(id: number, username: string): TeamMember {
  return {
    team_player_id: id,
    id,
    username,
    can_be_author: false,
    emoji: null,
    role: 'полевой',
    permissions: {
      can_manage_waivers: false,
      can_manage_players: false,
      can_change_team_name: false,
      can_add_players: false,
      can_remove_players: false,
    },
    date_joined: '2025-04-01T00:00:00+00:00',
    played_games_count: 0,
  };
}

const gryffindor = team(3, 'Гриффиндор');
const harry = member(9, 'harry');
const ron = member(10, 'ron');

function roster(): GameWaivers {
  return {
    teams: [gryffindor],
    waivers: {'3': [{player: {id: harry.id, can_be_author: false, name_mention: 'harry'}}]},
  };
}

function game(): Game {
  return new Game(4, 'игра', 5);
}

describe('AdminWaiversComponent', () => {
  let adminService: jasmine.SpyObj<AdminService>;
  let teamService: jasmine.SpyObj<TeamService>;
  let snackbar: jasmine.SpyObj<SnackbarService>;

  beforeEach(() => {
    adminService = jasmine.createSpyObj<AdminService>(
      'AdminService', ['listGames', 'getGameWaivers', 'addWaiver', 'removeWaiver'],
    );
    teamService = jasmine.createSpyObj<TeamService>('TeamService', ['getTeamPlayers', 'listTeams']);
    snackbar = jasmine.createSpyObj<SnackbarService>('SnackbarService', ['success', 'error', 'info']);
    adminService.listGames.and.returnValue(of(new Page([game()])));
    adminService.getGameWaivers.and.returnValue(of(roster()));
    teamService.getTeamPlayers.and.returnValue(of({items: [harry, ron]}));
  });

  function component(): AdminWaiversComponent {
    const c = new AdminWaiversComponent(adminService, teamService, snackbar);
    c.ngOnInit();
    c.selectedGameId = 4;
    c.onGameChange();
    return c;
  }

  it('offers only the team members who are not in the roster yet', () => {
    const c = component();
    c.toggleAddForm(gryffindor);

    expect(teamService.getTeamPlayers).toHaveBeenCalledWith(gryffindor.id);
    // harry already has a waiver; ron is the one worth adding
    expect(c.addableMembers(gryffindor).map(m => m.id)).toEqual([ron.id]);
  });

  it('signs the picked player up and re-reads the roster', () => {
    const c = component();
    c.toggleAddForm(gryffindor);
    c.selectedMemberId = ron.id;
    const answer: TeamWaivers = {team: gryffindor, players: []};
    adminService.addWaiver.and.returnValue(of(answer));

    c.add(gryffindor);

    expect(adminService.addWaiver).toHaveBeenCalledWith(4, gryffindor.id, ron.id);
    // once, on picking the game, and again after the change
    expect(adminService.getGameWaivers).toHaveBeenCalledTimes(2);
    expect(c.addingTo).toBeNull();
  });

  it('removes a waiver only after the confirmation', () => {
    const c = component();
    const entry = c.teamWaivers(gryffindor)[0];
    spyOn(window, 'confirm').and.returnValue(false);

    c.remove(gryffindor, entry);

    expect(adminService.removeWaiver).not.toHaveBeenCalled();
  });

  it('keeps a team on the page after its last waiver goes', () => {
    const c = component();
    const entry = c.teamWaivers(gryffindor)[0];
    spyOn(window, 'confirm').and.returnValue(true);
    adminService.removeWaiver.and.returnValue(of(undefined));
    // the team is out of the roster now, so the answer no longer carries it
    adminService.getGameWaivers.and.returnValue(of({teams: [], waivers: {}}));

    c.remove(gryffindor, entry);

    expect(adminService.removeWaiver).toHaveBeenCalledWith(4, gryffindor.id, entry.player.id);
    // otherwise the admin would have to search for it again to fix the mistake
    expect(c.displayTeams.map(t => t.id)).toEqual([gryffindor.id]);
  });

  it('brings a team with no waivers onto the page', () => {
    const c = component();
    const slytherin = team(4, 'Слизерин');

    c.pickTeam(slytherin);

    expect(c.displayTeams.map(t => t.id)).toEqual([gryffindor.id, slytherin.id]);
    expect(c.addingTo).toBe(slytherin.id);
  });

  it('says what the engine refused rather than a generic failure', () => {
    const c = component();
    c.toggleAddForm(gryffindor);
    c.selectedMemberId = ron.id;
    adminService.addWaiver.and.returnValue(throwError(() => new HttpErrorResponse({
      status: 422,
      error: {type: 'PlayerNotInTeam', description: 'Игрок не в команде'},
    })));

    c.add(gryffindor);

    expect(snackbar.error).toHaveBeenCalledWith('Игрок не в команде');
  });
});
