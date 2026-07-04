import {inject} from '@angular/core';
import {CanActivateFn, Router} from '@angular/router';
import {UserService} from '../auth/user.service';

/**
 * Lets only admins into /admin routes. This is a UX convenience — the real
 * enforcement happens server-side on every /admin/* endpoint.
 */
export const adminGuard: CanActivateFn = async () => {
  const userService = inject(UserService);
  const router = inject(Router);

  if (!userService.isUserLoaded()) {
    await userService.loadMe();
  }

  return userService.isAdmin() ? true : router.parseUrl('/');
};
