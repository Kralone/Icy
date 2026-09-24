import { Component, ChangeDetectionStrategy, OnInit } from '@angular/core';
import { GuideTemplateComponent } from '../guide-template/guide-template.component';
import { GuideDocument } from '../guide-template/guide-template.types';
import { GuideService } from '../../../../core/services/guide/guide.service';
import { hideUnpublishedGuide, mergePublishedGuide } from '../guide-published.utils';

@Component({
  selector: 'front-salvage-guide',
  standalone: true,
  imports: [GuideTemplateComponent],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `<front-guide-template [guide]="guide"></front-guide-template>`
})
export class SalvageGuideComponent implements OnInit {
  guide: GuideDocument = {
    slug: 'salvage',
    title: 'Guide Salvage - IceForge',
    showTopbarTabs: false,
    subtitle: 'Workflow stylise type wiki pour une boucle salvage propre et rentable.',
    updatedAt: '22 fev. 2026',
    gameVersion: 'Alpha 4.9',
    readTime: '6-8 min',
    difficulty: 'Debutant a Intermediaire',
    status: { label: 'Disponible', tone: 'live' },
    tags: ['salvage', 'coque', 'tri', 'revente'],
    sections: [
      {
        id: 'setup',
        title: 'Setup de mission',
        summary: 'Preparation equipage, cargo libre et route de retour.',
        paragraphs: [
          'Un salvage efficace commence par un plan de tri: matiere, composants, et rebuts.',
          'Definis avant depart un point de depot et un seuil de retour pour securiser la marge.'
        ],
        imageUrl: 'assets/images/home/activities/cargo.jpg'
      },
      {
        id: 'cycle',
        title: 'Cycle operationnel',
        bullets: [
          'Detection de cible et validation du risque.',
          'Decoupe controlee puis tri direct en soute.',
          'Extraction priorisee des ressources a plus forte valeur.',
          'Rotation courte vers vente pour limiter exposition.'
        ],
        callout: {
          title: 'Priorite',
          text: 'Toujours vider le plus rentable en premier avant de completer au volume.',
          tone: 'writing'
        }
      },
      {
        id: 'securite',
        title: 'Securite et discipline',
        bullets: [
          'Scanner frequent et positionnement defensif.',
          'Communication equipage claire avec mots courts.',
          'Plan d extraction immediate en cas de contact hostile.'
        ],
        callout: {
          title: 'Risque',
          text: 'Un salvage long sans surveillance transforme vite une marge en perte.',
          tone: 'alert'
        }
      }
    ]
  };
  constructor(private readonly guideService: GuideService) {}
  ngOnInit(): void { this.guideService.getPublished('salvage').subscribe({ next: remote => this.guide = mergePublishedGuide(this.guide, remote), error: error => this.guide = hideUnpublishedGuide(this.guide, error) }); }
}

