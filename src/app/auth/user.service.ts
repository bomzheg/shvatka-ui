import {Injectable} from "@angular/core";
import {HttpAdapter} from "../http.adapter";
import {Observable} from "rxjs";

export class UserData {
  id: number | undefined;
  username: string | undefined;
}

@Injectable({
  providedIn: "root",
})
export class UserService {
  constructor(private http: HttpAdapter) {
  }
  public getMe(): Observable<UserData> {
    return this.http.get<UserData>('/users/me')
  }
}
