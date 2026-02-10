import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DragDropModule, CdkDragDrop, moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';
import {IceLinkBlock, IceLinkBlockService} from '../../../../core/services/icelink/icelink-block.service';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-icelink-block-panel',
  standalone: true,
  imports: [CommonModule, DragDropModule, FormsModule],
  templateUrl: './icelink-block-panel.component.html',
})
export class IceLinkBlockPanelComponent implements OnInit {
  availableBlocks: IceLinkBlock[] = [];
  searchTerm = '';
  private readonly customTemplate: IceLinkBlock = {
    id: -1,
    name: 'Bloc custom',
    icon: '✏️',
    headline: '## ✏️ Bloc custom',
    content: 'Écrivez votre texte ici...',
    description: '',
    template: true,
  };
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
    // ✅ On charge les blocs à l'init
    this.blockService.loadBlocks();

    // ✅ On s’abonne à la source réactive
    this.blockService.blocks$.subscribe((blocks) => {
      const normalized = blocks.map((block) => ({
        ...block,
        isSystem: this.isSystemBlock(block),
      }));
      const merged = this.mergeSystemBlocks(normalized);
      this.availableBlocks = [this.customTemplate, ...merged];
    });
  }

  drop(event: CdkDragDrop<IceLinkBlock[]>) {
    if (event.previousContainer === event.container) {
      return;
    }

    if (event.item.data?.isSystem) {
      return;
    }

    const fromIndex = this.availableBlocks.indexOf(event.item.data);
    if (fromIndex < 0) return;
    transferArrayItem(
      event.previousContainer.data,
      event.container.data,
      fromIndex,
      event.currentIndex
    );
  }

  addBlock(block: IceLinkBlock) {
    this.availableBlocks.push(block);
  }

  resetBlocks() {
    this.blockService.loadBlocks(); // ✅ recharge depuis la BDD
  }

  get filteredBlocks(): IceLinkBlock[] {
    const term = this.searchTerm.trim().toLowerCase();
    if (!term) return this.availableBlocks;
    return this.availableBlocks.filter((block) => {
      const haystack = [
        block.name,
        block.headline,
        block.description,
        block.content,
      ].filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(term);
    });
  }

  private isSystemBlock(block: IceLinkBlock): boolean {
    const name = block.name?.trim().toLowerCase();
    return this.systemBlocks.some((sys) => sys.name.toLowerCase() === name);
  }

  private mergeSystemBlocks(blocks: IceLinkBlock[]): IceLinkBlock[] {
    const result = [...blocks];
    this.systemBlocks.forEach((systemBlock) => {
      const exists = result.some(
        (block) => block.name?.trim().toLowerCase() === systemBlock.name.toLowerCase()
      );
      if (!exists) {
        result.unshift({ ...systemBlock });
      }
    });
    return result;
  }
}
