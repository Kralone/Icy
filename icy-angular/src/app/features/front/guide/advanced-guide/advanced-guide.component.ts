import { Component } from '@angular/core';
import { GuideTemplateComponent } from '../guide-template/guide-template.component';
import { GuideDocument } from '../guide-template/guide-template.types';

@Component({
  selector: 'front-advanced-guide',
  standalone: true,
  imports: [GuideTemplateComponent],
  template: `<front-guide-template [guide]="guide"></front-guide-template>`
})
export class AdvancedGuideComponent {
  readonly guide: GuideDocument = {
    slug: 'avance',
    title: 'Guide Avance',
    subtitle: 'Contenu en preparation',
    updatedAt: '23 fev. 2026',
    readTime: 'Bientot',
    difficulty: 'A definir',
    status: { label: 'Bientot', tone: 'soon' },
    tags: ['coming soon'],
    sections: [
      {
        id: 'coming-soon',
        title: 'Coming Soon',
        summary: 'Cette section avancee arrive prochainement.',
        blocks: [
          {
            type: 'paragraph',
            text: 'Nous preparons le guide avance avec les strategies, optimisations et workflows d equipe.'
          },
          {
            type: 'callout',
            callout: {
              title: 'En construction',
              text: 'Le contenu sera publie ici des qu il est valide.',
              tone: 'soon'
            }
          }
        ]
      }
    ]
  };
}
