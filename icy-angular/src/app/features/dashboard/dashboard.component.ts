import {Component} from '@angular/core';
import {ShipService} from '../../core/services/ship/ship.service';
import {CommonModule} from '@angular/common';
import {WebSocketService} from '../../core/services/websocket/websocket.service';
import {LoadingOverlayComponent} from '../../shared/loading-overlay/loading-overlay.component';

@Component({
  selector: 'app-dashboard',
  imports: [
    CommonModule,
    LoadingOverlayComponent
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css'
})
export class DashboardComponent {
  isLoading = true;

  fleetSummary: { [focus: string]: string[] } = {};

  objectKeys = Object.keys;

  constructor(private shipService: ShipService, private wsService: WebSocketService) {

  }

  ngOnInit(): void {
    this.isLoading = true;
    this.wsService.connectFleetUpdate();
    this.loadFleetSummary();
  }

  loadFleetSummary() {
    this.shipService.getFleetSummary().subscribe(response => {
      this.fleetSummary = JSON.parse(response).fleet;
      console.log('📦 Fleet update');
      this.isLoading = false;
    });
  }

}
