import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiResponse } from '../../../model/api-response.model';
import { WikeloShip } from '../../../model/wikelo-ship.model';

@Injectable({
  providedIn: 'root'
})
export class WikeloService {
  constructor(private http: HttpClient) {}

  getShips(): Observable<ApiResponse<WikeloShip[]>> {
    return this.http.get<ApiResponse<WikeloShip[]>>('/api/wikelo/ships');
  }

  rescrapeShips(): Observable<ApiResponse<WikeloShip[]>> {
    return this.http.post<ApiResponse<WikeloShip[]>>('/api/wikelo/ships/rescrape', {});
  }
}
