import {Component} from '@angular/core';
import {ShipService} from '../../core/services/ship/ship.service';
import {CommonModule} from '@angular/common';
import {WebSocketService} from '../../core/services/websocket/websocket.service';

@Component({
  selector: 'app-dashboard',
  imports: [
    CommonModule
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css'
})
export class DashboardComponent {
  fleetSummary: { [focus: string]: string[] } = {};

  objectKeys = Object.keys;

  constructor(private shipService: ShipService, private wsService: WebSocketService) {

  }

  ngOnInit(): void {
    this.wsService.connectFleetUpdate();
    this.loadFleetSummary();
  }

  loadFleetSummary() {
    this.shipService.getFleetSummary().subscribe(response => {
      this.fleetSummary = JSON.parse(response).fleet;
      console.log('📦 Fleet update');
    });
  }

}
