import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

type DataMenuItem = {
  label: string;
  imageUrl: string;
  route: string;
};

@Component({
  selector: 'app-data-menu',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './data-menu.component.html',
  styleUrl: './data-menu.component.css'
})
export class DataMenuComponent {
  menuItems: DataMenuItem[] = [
    {
      label: 'Vaisseaux',
      imageUrl: 'https://media.starcitizen.tools/thumb/e/e2/SC_MultiShip_Roles.jpg/800px-SC_MultiShip_Roles.jpg.webp',
      route: '/icy/admin/ships'
    },
    {
      label: 'Items',
      imageUrl: 'https://images4.alphacoders.com/116/1166378.jpg',
      route: '/icy/admin/items'
    },
    {
      label: 'Images',
      imageUrl: 'https://www.fredzone.org/wp-content/uploads/2017/12/starcitizen-proc%C3%A8s.jpg',
      route: '/icy/admin/images'
    },
    {
      label: 'Planetes / Lunes',
      imageUrl: 'https://media.starcitizen.tools/e/e7/MicroTech-4.3.jpg',
      route: '/icy/admin/planets'
    },
    {
      label: 'Stations',
      imageUrl: 'https://media.starcitizen.tools/7/72/Hurston-everus-harbor-01.jpg',
      route: '/icy/admin/stations'
    },
    {
      label: 'UEX Cache',
      imageUrl: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRGL-rKIO_HjiN6cjSaLCWD8rdMftVK689z_Q&s',
      route: '/icy/admin/uex-cache'
    },
    {
      label: 'Ore Locations',
      imageUrl: 'https://images6.alphacoders.com/136/1361711.jpeg',
      route: '/icy/admin/ore-locations'
    }
  ];
}
