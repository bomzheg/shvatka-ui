import {Component, OnInit} from '@angular/core';
import {AuthService} from './auth.service';
import {UserService} from './user.service';
import {MatSnackBar} from '@angular/material/snack-bar';
import {ActivatedRoute, Router} from '@angular/router';
import {HttpErrorResponse} from '@angular/common/http';

@Component({
  selector: 'app-one-time-token',
  standalone: true,
  templateUrl: './one-time-token.component.html',
  styleUrl: './one-time-token.component.scss'
})
export class OneTimeTokenComponent implements OnInit {
  constructor(
    private authService: AuthService,
    private userService: UserService,
    private route: ActivatedRoute,
    private router: Router,
    private snackBar: MatSnackBar,
  ) {
  }

  ngOnInit(): void {
    const token = this.route.snapshot.queryParamMap.get('token');
    const next = this.route.snapshot.queryParamMap.get('next') || '/';

    if (!token) {
      this.snackBar.open('Missing one-time token', 'ok');
      this.router.navigateByUrl('/');
      return;
    }

    this.authService.loginWithOneTimeToken(token)
      .subscribe({
        next: async () => {
          await this.userService.loadMe();
          await this.router.navigateByUrl(next);
        },
        error: (err) => {
          if (err instanceof HttpErrorResponse && err.status === 401) {
            this.snackBar.open('Invalid or expired one-time token', 'ok');
          } else {
            this.snackBar.open('Authentication failed', 'ok');
          }
          this.router.navigateByUrl('/');
        },
      });
  }
}
