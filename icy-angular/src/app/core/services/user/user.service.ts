import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import {User} from '../../../model/user.model';
import {ApiResponse} from '../../../model/api-response.model';
import { UserProfile, UserProfileUpdate } from '../../../model/user-profile.model';
import { UserOnline } from '../../../model/user-online.model';

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private apiUrl = '/api/users';
  private profileSubject = new BehaviorSubject<UserProfile | null>(null);
  profile$ = this.profileSubject.asObservable();
  private avatarCacheBuster: string | null = null;

  constructor(private http: HttpClient) {}

  getAllUsers(): Observable<ApiResponse<User[]>> {
    return this.http.get<ApiResponse<User[]>>(`${this.apiUrl}/all`);
  }

  createUser(username: string, discordId: string, role: string): Observable<User> {
    return this.http.post<User>(`${this.apiUrl}/create`, { username, discordId, role });
  }

  deleteUser(id: string): Observable<void> {
    return this.http.delete<void>(`/api/users/by-id?id=${id}`);
  }

  updateUser(user: { id: string, username: string, discordId: string, role: string }): Observable<any> {
    return this.http.put('/api/users/update', user);
  }

  getMyProfile(): Observable<ApiResponse<UserProfile>> {
    return this.http.get<ApiResponse<UserProfile>>(`${this.apiUrl}/me/profile`).pipe(
      tap((response) => {
        const data = this.applyAvatarCacheBuster(response.data);
        this.profileSubject.next(data);
      })
    );
  }

  updateMyProfile(payload: UserProfileUpdate): Observable<ApiResponse<UserProfile>> {
    return this.http.patch<ApiResponse<UserProfile>>(`${this.apiUrl}/me/profile`, payload).pipe(
      tap((response) => {
        const data = this.applyAvatarCacheBuster(response.data);
        this.profileSubject.next(data);
      })
    );
  }

  uploadMyAvatar(file: File): Observable<ApiResponse<UserProfile>> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<ApiResponse<UserProfile>>(`${this.apiUrl}/me/avatar`, formData).pipe(
      tap((response) => {
        this.avatarCacheBuster = Date.now().toString();
        const data = this.applyAvatarCacheBuster(response.data);
        this.profileSubject.next(data);
      })
    );
  }

  getOnlineUsers(): Observable<ApiResponse<UserOnline[]>> {
    return this.http.get<ApiResponse<UserOnline[]>>(`${this.apiUrl}/online`);
  }

  private applyAvatarCacheBuster(profile: UserProfile | null): UserProfile | null {
    if (!profile?.avatarUrl || !this.avatarCacheBuster) return profile;
    const [baseUrl, query] = profile.avatarUrl.split('?');
    const params = new URLSearchParams(query ?? '');
    params.set('v', this.avatarCacheBuster);
    return { ...profile, avatarUrl: `${baseUrl}?${params.toString()}` };
  }

}
