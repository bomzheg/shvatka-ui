import {of} from 'rxjs';
import {AdminGamesComponent} from './admin-games.component';
import {AdminGame} from './admin.models';
import {AdminService} from './admin.service';
import {SnackbarService} from '../snackbar/snackbar.service';
import {Page} from '../games/games.service';

function game(overrides: Partial<AdminGame> = {}): AdminGame {
  return {
    id: 7,
    author: {id: 1, can_be_author: true, name_mention: 'author', username: 'author'},
    name: 'игра',
    status: 'getting_waivers',
    start_at: null,
    number: null,
    ...overrides,
  };
}

describe('AdminGamesComponent', () => {
  let adminService: jasmine.SpyObj<AdminService>;
  let snackbar: jasmine.SpyObj<SnackbarService>;

  beforeEach(() => {
    adminService = jasmine.createSpyObj<AdminService>(
      'AdminService', ['listAdminGames', 'changeGameStatus'],
    );
    snackbar = jasmine.createSpyObj<SnackbarService>('SnackbarService', ['success', 'error', 'info']);
  });

  function component(games: AdminGame[]): AdminGamesComponent {
    adminService.listAdminGames.and.returnValue(of(new Page(games)));
    const c = new AdminGamesComponent(adminService, snackbar);
    c.ngOnInit();
    return c;
  }

  it('shows the active games apart from the archive', () => {
    const c = component([
      game({id: 1, status: 'complete', number: 3}),
      game({id: 2, status: 'started'}),
      game({id: 3, status: 'complete', number: 5}),
      game({id: 4, status: 'getting_waivers'}),
    ]);

    // waivers first — the reason the page is usually opened
    expect(c.activeGames.map(g => g.id)).toEqual([4, 2]);
    // the archive, newest first
    expect(c.completedGames.map(g => g.id)).toEqual([3, 1]);
  });

  it('saves nothing while the picked status is the current one', () => {
    const c = component([game()]);

    expect(c.canSave(c.games[0])).toBeFalse();
    c.targets[7] = 'getting_waivers';
    expect(c.canSave(c.games[0])).toBeFalse();
    c.targets[7] = 'underconstruction';
    expect(c.canSave(c.games[0])).toBeTrue();
  });

  it('drops the game from the panel once it is handed back to its author', () => {
    const c = component([game()]);
    c.targets[7] = 'underconstruction';
    adminService.changeGameStatus.and.returnValue(of(game({status: 'underconstruction'})));
    spyOn(window, 'confirm').and.returnValue(true);

    c.save(c.games[0]);

    expect(adminService.changeGameStatus).toHaveBeenCalledWith(7, 'underconstruction');
    // the admin cannot walk it back: the game is gone from the list
    expect(c.games).toEqual([]);
    expect(snackbar.success).toHaveBeenCalled();
  });

  it('keeps a game that only moved between statuses an admin may see', () => {
    const c = component([game({status: 'started'})]);
    c.targets[7] = 'finished';
    adminService.changeGameStatus.and.returnValue(of(game({status: 'finished'})));
    spyOn(window, 'confirm').and.returnValue(true);

    c.save(c.games[0]);

    expect(c.games.map(g => g.status)).toEqual(['finished']);
  });

  it('does not change anything when the confirmation is declined', () => {
    const c = component([game()]);
    c.targets[7] = 'underconstruction';
    spyOn(window, 'confirm').and.returnValue(false);

    c.save(c.games[0]);

    expect(adminService.changeGameStatus).not.toHaveBeenCalled();
    expect(c.games.length).toBe(1);
  });
});
