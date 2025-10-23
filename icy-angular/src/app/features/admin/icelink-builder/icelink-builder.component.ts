import {Component, ViewChild} from '@angular/core';
import { CommonModule } from '@angular/common';
import { IceLinkHeaderComponent } from './icelink-header/icelink-header.component';
import { IceLinkDropzoneComponent } from './icelink-dropzone/icelink-dropzone.component';
import { IceLinkBlockPanelComponent } from './icelink-block-panel/icelink-block-panel.component';
import { IceLinkPreviewComponent } from './icelink-preview/icelink-preview.component';

export interface IceLinkBlock {
  id: string;
  title: string;
  icon: string;
  content: string;
  description?: string;
}

@Component({
  selector: 'app-icelink-builder',
  standalone: true,
  imports: [
    CommonModule,
    IceLinkHeaderComponent,
    IceLinkDropzoneComponent,
    IceLinkBlockPanelComponent,
    IceLinkPreviewComponent
  ],
  templateUrl: './icelink-builder.component.html',
})
export class IceLinkBuilderComponent {
  @ViewChild('blocksPanel') blocksPanel!: IceLinkBlockPanelComponent;
  icelinkBlocks: IceLinkBlock[] = [];

  reset() {
    this.icelinkBlocks = [];
    this.blocksPanel.resetBlocks(); // ✅ restaure la liste des blocs disponibles
  }

  save() {
    console.log('💾 IceLink sauvegardé !', this.generatedText);
  }

  get generatedText(): string {
    const header = `<@&1325528040322896025>\n\n# 🏔️ IceLink - ${new Date().toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    }).replace('2025', '2955')}\n\n`;

    if (this.icelinkBlocks.length === 0) {
      return header + '> _(Aucun contenu pour le moment)_';
    }

    return header + this.icelinkBlocks.map(b => b.content.trim()).join('\n\n---\n\n');
  }
}
