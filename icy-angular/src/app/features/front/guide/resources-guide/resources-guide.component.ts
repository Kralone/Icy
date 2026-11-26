
import { Component, OnDestroy, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { ActivatedRoute, ParamMap, Router } from '@angular/router';
import { CatalogIconComponent, CatalogIconKey } from '../../../../shared/catalog-icon/catalog-icon.component';
import { Subscription } from 'rxjs';
import { ResourcesMiningPanelComponent } from './components/resources-mining-panel/resources-mining-panel.component';
import { ResourcesRefiningPanelComponent } from './components/resources-refining-panel/resources-refining-panel.component';
import { ResourcesSalesPanelComponent } from './components/resources-sales-panel/resources-sales-panel.component';
import { ResourcesFitPanelComponent } from './components/resources-fit-panel/resources-fit-panel.component';
import {
  FitTabId,
  ModuleFilterId,
  ResourceLineId,
  normalizeFitTabId,
  normalizeModuleFilterId,
  normalizeResourceLineId
} from './resources-guide-link.utils';

interface ResourceLine {
  id: ResourceLineId;
  icon: CatalogIconKey;
  title: string;
  /** Sous-titre court de l'onglet. */
  hint: string;
}

@Component({
  selector: 'front-resources-guide',
  standalone: true,
  imports: [ResourcesSalesPanelComponent, ResourcesMiningPanelComponent, ResourcesRefiningPanelComponent, ResourcesFitPanelComponent, CatalogIconComponent],
  templateUrl: './resources-guide.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './resources-guide.component.css'
})
export class ResourcesGuideComponent implements OnInit, OnDestroy {
  readonly lines: ResourceLine[] = [
    {
      id: 'locations',
      icon: 'planet',
      title: 'Planètes et minerais',
      hint: 'Où miner'
    },
    {
      id: 'planning',
      icon: 'price',
      title: 'Prix de vente',
      hint: 'Où vendre'
    },
    {
      id: 'refining',
      icon: 'refinery',
      title: 'Raffinage',
      hint: 'Où raffiner'
    },
    {
      id: 'fit',
      icon: 'pickaxe',
      title: 'Équipement',
      hint: 'Vaisseaux, têtes, modules'
    }
  ];

  selectedLineId: ResourceLineId = 'locations';
  fitRequestedTab: FitTabId | null = null;
  fitRequestedModuleFilter: ModuleFilterId | null = null;

  private routeQuerySubscription?: Subscription;

  constructor(private readonly route: ActivatedRoute, private readonly router: Router) {}

  ngOnInit(): void {
    this.applyRouteQueryState(this.route.snapshot.queryParamMap);
    this.routeQuerySubscription = this.route.queryParamMap.subscribe((queryMap) => this.applyRouteQueryState(queryMap));
  }

  ngOnDestroy(): void {
    this.routeQuerySubscription?.unsubscribe();
  }

  get selectedLine(): ResourceLine | undefined {
    return this.lines.find((line) => line.id === this.selectedLineId);
  }

  /** Change d'onglet et garde la rubrique dans l'adresse, pour qu'un lien partagé l'ouvre directement. */
  selectLine(line: ResourceLine): void {
    if (this.selectedLineId === line.id) return;
    this.selectedLineId = line.id;
    this.router.navigate([], { relativeTo: this.route, queryParams: { line: line.id, fitTab: null, fitFilter: null }, queryParamsHandling: 'merge', replaceUrl: true });
  }

  private applyRouteQueryState(queryMap: ParamMap): void {
    const requestedTab = normalizeFitTabId(queryMap.get('fitTab'));
    const requestedFilter = normalizeModuleFilterId(queryMap.get('fitFilter'));
    const explicitLine = normalizeResourceLineId(queryMap.get('line'));
    const inferredLine: ResourceLineId | null = requestedTab || requestedFilter ? 'fit' : null;

    this.fitRequestedTab = requestedTab;
    this.fitRequestedModuleFilter = requestedFilter;
    const target = explicitLine ?? inferredLine;
    if (target) this.selectedLineId = target;
  }
}
