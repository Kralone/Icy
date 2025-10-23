import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DragDropModule, CdkDragDrop, moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';
import {IceLinkBlock, IceLinkBlockService} from '../../../../core/services/icelink/icelink-block.service';

@Component({
  selector: 'app-icelink-block-panel',
  standalone: true,
  imports: [CommonModule, DragDropModule],
  templateUrl: './icelink-block-panel.component.html',
})
export class IceLinkBlockPanelComponent implements OnInit {
  availableBlocks: IceLinkBlock[] = [];

  constructor(private blockService: IceLinkBlockService) {}

  ngOnInit(): void {
    // ✅ On charge les blocs à l'init
    this.blockService.loadBlocks();

    // ✅ On s’abonne à la source réactive
    this.blockService.blocks$.subscribe((blocks) => {
      this.availableBlocks = [...blocks]; // on clone pour éviter la mutation
    });
  }

  drop(event: CdkDragDrop<IceLinkBlock[]>) {
    if (event.previousContainer === event.container) {
      moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);
    } else {
      transferArrayItem(
        event.previousContainer.data,
        event.container.data,
        event.previousIndex,
        event.currentIndex
      );
    }
  }

  addBlock(block: IceLinkBlock) {
    this.availableBlocks.push(block);
  }

  resetBlocks() {
    this.blockService.loadBlocks(); // ✅ recharge depuis la BDD
  }
}
