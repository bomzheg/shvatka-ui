import {Component, OnInit} from '@angular/core';
import {ActivatedRoute, convertToParamMap, Router} from "@angular/router";
import {AuthCallbackService, UserTgAuth} from "./auth-callback.service";

@Component({
  selector: 'app-auth-callback',
  standalone: true,
  imports: [],
  template: '<div>Входим, подождите...</div>',
})
export class AuthCallbackComponent implements OnInit{
  public constructor(
    private activatedRoute: ActivatedRoute,
    private authCallbackService: AuthCallbackService,
    private router: Router,
  ) {

  }
    ngOnInit(): void {
      this.activatedRoute.queryParams.subscribe(async params => {
        let paramMap = convertToParamMap(params);
        const user = UserTgAuth.fromParams(paramMap);
        console.log(user)
        this.authCallbackService.authenticate(user);
        await this.router.navigate(["/"])
      });
    }

}
