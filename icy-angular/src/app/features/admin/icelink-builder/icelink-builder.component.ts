import {Component, OnInit, ViewChild} from '@angular/core';
import { CommonModule } from '@angular/common';
import { IceLinkHeaderComponent } from './icelink-header/icelink-header.component';
import { IceLinkDropzoneComponent } from './icelink-dropzone/icelink-dropzone.component';
import { IceLinkBlockPanelComponent } from './icelink-block-panel/icelink-block-panel.component';
import { IceLinkPreviewComponent } from './icelink-preview/icelink-preview.component';
import {IceLinkBlock, IceLinkBlockService} from '../../../core/services/icelink/icelink-block.service';
import {IceLinkBlockAdminComponent} from './icelink-block-admin/icelink-block-admin.component';

@Component({
  selector: 'app-icelink-builder',
  standalone: true,
  imports: [
    CommonModule,
    IceLinkHeaderComponent,
    IceLinkDropzoneComponent,
    IceLinkBlockPanelComponent,
    IceLinkPreviewComponent,
    IceLinkBlockAdminComponent
  ],
  templateUrl: './icelink-builder.component.html',
})
export class IceLinkBuilderComponent implements OnInit {
  @ViewChild('blocksPanel') blocksPanel!: IceLinkBlockPanelComponent;
  icelinkBlocks: IceLinkBlock[] = [];
  private readonly systemBlocks: IceLinkBlock[] = [
    {
      id: -2,
      name: 'Nouveaux membres',
      icon: '🆕',
      headline: '## 🆕 Nouveaux membres',
      content: 'Auto',
      description: '',
      isSystem: true,
    },
    {
      id: -3,
      name: 'Nouveaux vaisseaux',
      icon: '🚀',
      headline: '## 🚀 Nouveaux vaisseaux',
      content: 'Auto',
      description: '',
      isSystem: true,
    },
    {
      id: -4,
      name: 'Activité',
      icon: '📅',
      headline: '## 📅 Activités à venir',
      content: 'Auto',
      description: '',
      isSystem: true,
    },
  ];

  constructor(private blockService: IceLinkBlockService) {}

  ngOnInit(): void {
    this.blockService.blocks$.subscribe((blocks) => {
      this.ensureSystemBlocks(blocks);
    });
    this.blockService.loadBlocks();
  }

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

    return header + this.icelinkBlocks.map(b => this.formatBlockText(b)).join('\n\n---\n\n');
  }

  private formatBlockText(block: IceLinkBlock): string {
    const content = block.content?.trim() || '';
    return content;
  }

  handleBlockDeleted(blockId: number) {
    // ✅ Retire de la dropzone s’il est présent
    this.icelinkBlocks = this.icelinkBlocks.filter(b => b.id !== blockId);
  }

  private ensureSystemBlocks(blocks: IceLinkBlock[]) {
    this.systemBlocks.forEach((fallback) => {
      const name = fallback.name.toLowerCase();
      const systemBlock = blocks.find(
        (block) => block.name?.trim().toLowerCase() === name
      ) || fallback;

      systemBlock.isSystem = true;
      const existingIndex = this.icelinkBlocks.findIndex(
        (block) => block.name?.trim().toLowerCase() === name
      );
      if (existingIndex >= 0) {
        this.icelinkBlocks[existingIndex] = { ...this.icelinkBlocks[existingIndex], ...systemBlock };
      } else {
        this.icelinkBlocks.push({ ...systemBlock });
      }
    });
  }

}
