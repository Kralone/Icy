import { Component, ChangeDetectionStrategy } from '@angular/core';

import { RouterLink } from '@angular/router';

type DataMenuItem = {
  label: string;
  imageUrl: string;
  route: string;
};

@Component({
  selector: 'app-data-menu',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './data-menu.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
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
      imageUrl: 'https://media.starcitizen.tools/6/6d/ItemBankRM.png',
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
      label: 'CIG Watch',
      imageUrl: 'https://static.actugaming.net/media/2018/03/StarCitizen-1024x575.jpg',
      route: '/icy/admin/cig-watch'
    },
    {
      label: 'Ore Locations',
      imageUrl: 'https://static.wikia.nocookie.net/starcitizen/images/6/6d/Aphorite_vitrine.jpg/revision/latest/scale-to-width-down/300?cb=20210215061436',
      route: '/icy/admin/ore-locations'
    }
  ];
}
