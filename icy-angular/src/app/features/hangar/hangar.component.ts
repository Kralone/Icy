import { Component } from '@angular/core';
import {NgForOf, NgStyle} from '@angular/common';

@Component({
  selector: 'app-hangar',
  templateUrl: './hangar.component.html',
  imports: [
    NgStyle,
    NgForOf
  ],
  styleUrls: ['./hangar.component.css']
})
export class HangarComponent {
  ships = [
    { name: 'Anvil Carrack', manufacturer: 'Anvil Aerospace', role: 'Exploration', crew: '4-6', image: 'assets/ships/carrack.jpg' },
    { name: 'Drake Cutlass Black', manufacturer: 'Drake Interplanetary', role: 'Transport', crew: '2', image: 'assets/ships/cutlass.jpg' },
    { name: 'Aegis Vanguard Warden', manufacturer: 'Aegis Dynamics', role: 'Combat', crew: '2-3', image: 'assets/ships/vanguard.jpg' },
    { name: 'Origin 600i', manufacturer: 'Origin Jumpworks', role: 'Luxury Exploration', crew: '3-5', image: 'assets/ships/600i.jpg' },
    { name: 'RSI Constellation Andromeda', manufacturer: 'Roberts Space Industries', role: 'Multi-role', crew: '4-6', image: 'assets/ships/constellation.jpg' },
    { name: 'MISC Freelancer', manufacturer: 'Musashi Industrial', role: 'Freighter', crew: '2-4', image: 'assets/ships/freelancer.jpg' },
    { name: 'Drake Caterpillar', manufacturer: 'Drake Interplanetary', role: 'Heavy Cargo', crew: '4-6', image: 'assets/ships/caterpillar.jpg' },
    { name: 'Aegis Reclaimer', manufacturer: 'Aegis Dynamics', role: 'Salvage', crew: '5-6', image: 'assets/ships/reclaimer.jpg' },
    { name: 'Anvil Terrapin', manufacturer: 'Anvil Aerospace', role: 'Reconnaissance', crew: '1', image: 'assets/ships/terrapin.jpg' },
    { name: 'RSI Aurora MR', manufacturer: 'Roberts Space Industries', role: 'Starter Ship', crew: '1', image: 'assets/ships/aurora.jpg' },
    { name: 'Origin 85X', manufacturer: 'Origin Jumpworks', role: 'Personal Transport', crew: '1-2', image: 'assets/ships/85x.jpg' }
  ];
}
