import {HttpErrorResponse} from '@angular/common/http';
import {of, throwError} from 'rxjs';
import {AuthService} from '../auth/auth.service';
import {UserData, UserService} from '../auth/user.service';
import {SnackbarService} from '../snackbar/snackbar.service';
import {ProfileIdentitiesComponent} from './profile-identities.component';

function me(overrides: Partial<UserData> = {}): UserData {
  return {
    id: 42,
    username: 'harry',
    name_mention: 'harry',
    can_be_author: true,
    tg: null,
    forum: null,
    email: null,
    is_admin: false,
    pending_email: null,
    ...overrides,
  } as UserData;
}

describe('ProfileIdentitiesComponent', () => {
  let authService: jasmine.SpyObj<AuthService>;
  let userService: jasmine.SpyObj<UserService>;
  let snackbar: jasmine.SpyObj<SnackbarService>;

  beforeEach(() => {
    authService = jasmine.createSpyObj<AuthService>('AuthService', ['linkEmail', 'showTgLinkForm']);
    userService = jasmine.createSpyObj<UserService>('UserService', ['getMe', 'loadMe']);
    snackbar = jasmine.createSpyObj<SnackbarService>('SnackbarService', ['success', 'error', 'info']);
    userService.loadMe.and.returnValue(Promise.resolve(undefined));
  });

  function component(user: UserData): ProfileIdentitiesComponent {
    userService.getMe.and.returnValue(user);
    return new ProfileIdentitiesComponent(authService, userService, snackbar);
  }

  it('asks for the code of an unverified linked email', () => {
    const identities = component(me({email: {email: 'h@example.com', is_verified: false}}));

    expect(identities.emailAwaitingCode).toBe('h@example.com');
    expect(identities.isEmailVerified).toBeFalse();
  });

  it('asks for the code of the address being moved to, not the old one', () => {
    const identities = component(me({
      email: {email: 'old@example.com', is_verified: true},
      pending_email: 'new@example.com',
    }));

    expect(identities.emailAwaitingCode).toBe('new@example.com');
    // the old address is still the linked one until the code lands
    expect(identities.linkedEmail?.email).toBe('old@example.com');
    expect(identities.isEmailVerified).toBeTrue();
  });

  it('asks for nothing when the linked email is verified and settled', () => {
    const identities = component(me({email: {email: 'h@example.com', is_verified: true}}));

    expect(identities.emailAwaitingCode).toBeNull();
  });

  it('does not bother the server with the address already verified', () => {
    const identities = component(me({email: {email: 'h@example.com', is_verified: true}}));
    identities.startEditingEmail();
    identities.email = ' H@Example.com ';

    identities.submitEmail();

    expect(authService.linkEmail).not.toHaveBeenCalled();
    expect(identities.emailError).toBe('Этот email уже привязан к аккаунту');
  });

  it('rejects a malformed address before sending it', () => {
    const identities = component(me());
    identities.email = 'not-an-email';

    identities.submitEmail();

    expect(authService.linkEmail).not.toHaveBeenCalled();
    expect(identities.emailError).toBe('Введите корректный email');
  });

  it('sends a normalized address and re-reads the account afterwards', () => {
    const identities = component(me({email: {email: 'old@example.com', is_verified: true}}));
    authService.linkEmail.and.returnValue(of({ok: true}));
    identities.startEditingEmail();
    identities.email = '  New@Example.COM ';

    identities.submitEmail();

    expect(authService.linkEmail).toHaveBeenCalledWith('new@example.com');
    expect(identities.isEditingEmail).toBeFalse();
    expect(identities.isSubmitting).toBeFalse();
    expect(userService.loadMe).toHaveBeenCalled();
  });

  it('keeps the form open with an error when the address is taken', () => {
    const identities = component(me());
    authService.linkEmail.and.returnValue(
      throwError(() => new HttpErrorResponse({status: 409})),
    );
    identities.startEditingEmail();
    identities.email = 'taken@example.com';

    identities.submitEmail();

    expect(identities.emailError).toBe('Этот email уже используется');
    expect(identities.isEditingEmail).toBeTrue();
  });

  it('names a telegram account by username, then by name, then by id', () => {
    expect(component(me({tg: {tg_id: 1, username: 'harry', first_name: 'H', last_name: null}}))
      .tgDisplayName()).toBe('@harry');
    expect(component(me({tg: {tg_id: 1, username: null, first_name: 'Harry', last_name: 'P'}}))
      .tgDisplayName()).toBe('Harry P');
    expect(component(me({tg: {tg_id: 1, username: null, first_name: null, last_name: null}}))
      .tgDisplayName()).toBe('ID 1');
  });
});
