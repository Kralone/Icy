import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

type MemberToolNavItem = {
  label: string;
  route: string;
};

@Component({
  selector: 'app-member-tools-layout',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './member-tools-layout.component.html',
  styleUrl: './member-tools-layout.component.css',
  changeDetection: ChangeDetectionStrategy.Eager
})
export class MemberToolsLayoutComponent {
  readonly navItems: readonly MemberToolNavItem[] = [
    { label: 'Vue d’ensemble', route: '/icy/outils' },
    { label: 'Ressources', route: '/icy/outils/ressources-minage' },
    { label: 'Hangar exécutif', route: '/icy/outils/executive-hangar' },
    { label: 'Vaisseaux', route: '/icy/outils/achat-vaisseaux' },
    { label: 'Wikelo', route: '/icy/outils/wikelo' }
  ];
}
