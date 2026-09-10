import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiResponse } from '../../../model/api-response.model';
import { WikeloEquipment } from '../../../model/wikelo-equipment.model';
import { WikeloShip } from '../../../model/wikelo-ship.model';

@Injectable({
  providedIn: 'root'
})
export class WikeloService {
  constructor(private http: HttpClient) {}

  getShips(): Observable<ApiResponse<WikeloShip[]>> {
    return this.http.get<ApiResponse<WikeloShip[]>>('/api/wikelo/ships');
  }

  getEquipment(): Observable<{ data: WikeloEquipment[] }> {
    return this.http.get<{ data: WikeloEquipment[] }>('/api/wikelo/equipment');
  }
}
