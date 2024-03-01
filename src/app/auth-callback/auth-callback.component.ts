import {Component, OnInit} from '@angular/core';
import {ActivatedRoute, convertToParamMap} from "@angular/router";
import {AuthCallbackService, UserTgAuth} from "./auth-callback.service";

@Component({
  selector: 'app-auth-callback',
  standalone: true,
  imports: [],
  template: '<div></div>',
})
export class AuthCallbackComponent implements OnInit{
  public constructor(
    private activatedRoute: ActivatedRoute,
    private authCallbackService: AuthCallbackService,
  ) {

  }
    ngOnInit(): void {
      this.activatedRoute.queryParams.subscribe(params => {
        console.log(params);
        let paramMap = convertToParamMap(params);
        const user = UserTgAuth.fromParams(paramMap);
        console.log(user)
        this.authCallbackService.authenticate(user)
      });
    }

}
