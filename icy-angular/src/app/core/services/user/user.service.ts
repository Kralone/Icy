import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import {User} from '../../../model/user.model';
import {ApiResponse} from '../../../model/api-response.model';

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private apiUrl = '/api/users';

  constructor(private http: HttpClient) {}

  getAllUsers(): Observable<ApiResponse<User[]>> {
    return this.http.get<ApiResponse<User[]>>(`${this.apiUrl}/all`);
  }

  createUser(username: string, discordId: number, role: string): Observable<User> {
    return this.http.post<User>(`${this.apiUrl}/create`, { username, discordId, role });
  }

  deleteUser(id: string): Observable<void> {
    return this.http.delete<void>(`/api/users/by-id?id=${id}`);
  }

  updateUser(user: { id: string, username: string, discordId: number, role: string }): Observable<any> {
    return this.http.put('/api/users/update', user);
  }

}
