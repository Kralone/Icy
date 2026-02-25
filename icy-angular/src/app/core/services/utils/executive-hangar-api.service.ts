import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiResponse } from '../../../model/api-response.model';
import { ExecutiveHangarConfig, ExecutiveHangarPlayerStatus } from '../../../model/executive-hangar.model';

@Injectable({ providedIn: 'root' })
export class ExecutiveHangarApiService {
  private readonly baseUrl = '/api/utils/executive-hangar';

  constructor(private http: HttpClient) {}

  getConfig(): Observable<ApiResponse<ExecutiveHangarConfig>> {
    return this.http.get<ApiResponse<ExecutiveHangarConfig>>(`${this.baseUrl}/config`);
  }

  setNextOnline(nextOnlineAtIso: string): Observable<ApiResponse<ExecutiveHangarConfig>> {
    return this.http.post<ApiResponse<ExecutiveHangarConfig>>(`${this.baseUrl}/next-online`, {
      nextOnlineAt: nextOnlineAtIso,
    });
  }

  resetConfig(): Observable<ApiResponse<ExecutiveHangarConfig>> {
    return this.http.post<ApiResponse<ExecutiveHangarConfig>>(`${this.baseUrl}/reset`, {});
  }

  getPlayerStatuses(): Observable<ApiResponse<ExecutiveHangarPlayerStatus[]>> {
    return this.http.get<ApiResponse<ExecutiveHangarPlayerStatus[]>>(`${this.baseUrl}/players`);
  }

  setPlayerStatus(userId: string, hasExecShip: boolean): Observable<ApiResponse<ExecutiveHangarPlayerStatus>> {
    return this.http.put<ApiResponse<ExecutiveHangarPlayerStatus>>(`${this.baseUrl}/players/${userId}`, {
      hasExecShip,
    });
  }
}
