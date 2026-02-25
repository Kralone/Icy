import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { GuideTopbarComponent } from '../guide-topbar/guide-topbar.component';
import { ResourcesMiningPanelComponent } from './components/resources-mining-panel/resources-mining-panel.component';
import { ResourcesRefiningPanelComponent } from './components/resources-refining-panel/resources-refining-panel.component';
import { ResourcesSalesPanelComponent } from './components/resources-sales-panel/resources-sales-panel.component';
import { ResourcesFitPanelComponent } from './components/resources-fit-panel/resources-fit-panel.component';

interface ResourceLine {
  id: string;
  ribbon: string;
  title: string;
  description: string;
  imageUrl: string;
  imagePosition?: string;
  bandHeight?: number;
}

@Component({
  selector: 'front-resources-guide',
  standalone: true,
  imports: [CommonModule, GuideTopbarComponent, ResourcesSalesPanelComponent, ResourcesMiningPanelComponent, ResourcesRefiningPanelComponent, ResourcesFitPanelComponent],
  templateUrl: './resources-guide.component.html',
  styleUrl: './resources-guide.component.css'
})
export class ResourcesGuideComponent implements OnInit, OnDestroy {
  readonly lines: ResourceLine[] = [
    {
      id: 'planning',
      ribbon: 'Prix de vente',
      title: 'Prix de vente',
      description: 'Reference rapide des valeurs de vente pour prioriser les materiaux les plus rentables.',
      imageUrl: 'https://i.redd.it/thfwwhr9m4a71.png',
      imagePosition: 'center 20%',
      bandHeight: 176
    },
    {
      id: 'refining',
      ribbon: 'Raffinage',
      title: 'Raffinage',
      description: 'Tableaux informatifs sur les methodes, rendements, capacites et audits des raffineries.',
      imageUrl: 'https://sibyllasc.fr/wp-content/uploads/2025/09/Refinery_01_V2-Min.jpg.webp',
      imagePosition: 'center 40%',
      bandHeight: 176
    },
    {
      id: 'locations',
      ribbon: 'Planètes et minerais',
      title: 'Planètes et minerais',
      description: 'Vue par ore location pour le minage. Recherche par code location ou minerai, puis clique pour ouvrir le detail.',
      imageUrl: 'https://i.imgur.com/OOjqT8P.jpg',
      imagePosition: 'center 40%',
      bandHeight: 176
    },
    {
      id: 'fit',
      ribbon: 'Vaisseaux, Modules, Outils',
      title: 'Vaisseaux, Modules, Outils',
      description: 'Base operationnelle pour preparer un fit minage complet: vaisseau, tête de minage, modules et equipement.',
      imageUrl: 'assets/images/home/activities/mining.jpg',
      imagePosition: 'center 0%',
      bandHeight: 176
    }
  ];

  selectedLineId = '';
  contentVisible = false;
  private revealTimer?: ReturnType<typeof setTimeout>;
  private preloadedImages: HTMLImageElement[] = [];

  ngOnInit(): void {
    this.preloadLineImages();
  }

  ngOnDestroy(): void {
    if (this.revealTimer) {
      clearTimeout(this.revealTimer);
      this.revealTimer = undefined;
    }
    this.preloadedImages = [];
  }

  trackLine(_: number, line: ResourceLine): string {
    return line.id;
  }

  get selectedLine(): ResourceLine | undefined {
    return this.lines.find((line) => line.id === this.selectedLineId);
  }

  selectLine(line: ResourceLine): void {
    if (this.selectedLineId === line.id) {
      this.clearSelection();
      return;
    }

    if (this.revealTimer) {
      clearTimeout(this.revealTimer);
      this.revealTimer = undefined;
    }

    this.scrollToTopOfPage();
    this.contentVisible = false;

    requestAnimationFrame(() => {
      this.selectedLineId = line.id;
      this.revealTimer = setTimeout(() => {
        if (this.selectedLineId === line.id) {
          this.contentVisible = true;
        }
      }, 420);
    });
  }

  clearSelection(): void {
    if (this.revealTimer) {
      clearTimeout(this.revealTimer);
      this.revealTimer = undefined;
    }
    this.contentVisible = false;
    this.scrollToTopOfPage();
    setTimeout(() => {
      this.selectedLineId = '';
    }, 220);
  }

  private scrollToTopOfPage(): void {
    if (typeof window === 'undefined') {
      return;
    }
    window.scrollTo({ top: 0, behavior: 'auto' });
  }

  private preloadLineImages(): void {
    if (typeof window === 'undefined') {
      return;
    }
    for (const line of this.lines) {
      const img = new Image();
      img.src = line.imageUrl;
      this.preloadedImages.push(img);
    }
  }

}
