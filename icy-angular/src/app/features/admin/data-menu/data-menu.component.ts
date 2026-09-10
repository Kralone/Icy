import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink } from '@angular/router';

type CatalogShortcut = { label: string; family?: string; catalogGroup?: string };
type DataMenuItem = {
  label: string;
  imageUrl: string;
  route: string;
  queryParams?: Record<string, string>;
  shortcuts?: CatalogShortcut[];
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
  readonly menuItems: DataMenuItem[] = [
    {
      label: 'Vaisseaux', route: '/icy/admin/catalog', queryParams: {family: 'SHIP', catalogGroup: 'STANDARD'},
      imageUrl: 'https://media.starcitizen.tools/thumb/e/e2/SC_MultiShip_Roles.jpg/800px-SC_MultiShip_Roles.jpg.webp',
      shortcuts: [
        {label: 'Standard', family: 'SHIP', catalogGroup: 'STANDARD'},
        {label: 'Wikelo', family: 'SHIP', catalogGroup: 'WIKELO'},
        {label: 'PYAM Exec', family: 'SHIP', catalogGroup: 'PYAM_EXEC'},
        {label: 'Battaglia', family: 'SHIP', catalogGroup: 'BATTAGLIA'},
        {label: 'Véhicules terrestres', family: 'GROUND_VEHICLE'}
      ]
    },
    {
      label: 'Équipement', route: '/icy/admin/catalog', queryParams: {family: 'ITEM'},
      imageUrl: 'https://media.starcitizen.tools/6/6d/ItemBankRM.png',
      shortcuts: [
        {label: 'Armes FPS', family: 'FPS_WEAPON'}, {label: 'Armes de vaisseau', family: 'SHIP_WEAPON'},
        {label: 'Armures', family: 'ARMOR'}, {label: 'Composants', family: 'SHIP_COMPONENT'},
        {label: 'Modules', family: 'MODULE'}, {label: 'Outils', family: 'TOOL'},
        {label: 'Armures motorisées', family: 'POWER_SUIT'}, {label: 'Autres objets', family: 'ITEM'}
      ]
    },
    {
      label: 'Planètes et lunes', route: '/icy/admin/catalog', queryParams: {family: 'PLANET'},
      imageUrl: 'https://media.starcitizen.tools/e/e7/MicroTech-4.3.jpg',
      shortcuts: [{label: 'Planètes', family: 'PLANET'}, {label: 'Lunes', family: 'MOON'}, {label: 'Systèmes', family: 'SYSTEM'}]
    },
    {
      label: 'Stations et lieux', route: '/icy/admin/catalog', queryParams: {family: 'STATION'},
      imageUrl: 'https://media.starcitizen.tools/7/72/Hurston-everus-harbor-01.jpg',
      shortcuts: [{label: 'Stations', family: 'STATION'}, {label: 'Villes', family: 'CITY'},
        {label: 'Avant-postes', family: 'OUTPOST'}, {label: 'Points de saut', family: 'JUMP_POINT'}, {label: 'Autres lieux', family: 'LOCATION'}]
    },
    {label: 'Images', route: '/icy/admin/images', imageUrl: 'https://www.fredzone.org/wp-content/uploads/2017/12/starcitizen-proc%C3%A8s.jpg'},
    {label: 'CIG Watch', route: '/icy/admin/cig-watch', imageUrl: 'https://static.actugaming.net/media/2018/03/StarCitizen-1024x575.jpg'},
    {label: 'Minerais', route: '/icy/admin/ore-locations', imageUrl: 'https://static.wikia.nocookie.net/starcitizen/images/6/6d/Aphorite_vitrine.jpg/revision/latest/scale-to-width-down/300?cb=20210215061436'}
  ];
}
