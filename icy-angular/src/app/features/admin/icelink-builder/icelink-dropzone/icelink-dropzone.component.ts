import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CdkDragDrop, moveItemInArray, transferArrayItem, DragDropModule } from '@angular/cdk/drag-drop';
import { IceLinkBlock } from '../icelink-builder.component';

@Component({
  selector: 'app-icelink-dropzone',
  standalone: true,
  imports: [CommonModule, DragDropModule],
  templateUrl: './icelink-dropzone.component.html',
})
export class IceLinkDropzoneComponent {
  @Input() blocks: IceLinkBlock[] = [];
  @Output() onBlockRemoved = new EventEmitter<IceLinkBlock>();
  isActive = false;

  onEnter() {
    this.isActive = true;
  }

  onLeave() {
    this.isActive = false;
  }

  drop(event: CdkDragDrop<IceLinkBlock[]>) {
    this.isActive = false;

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

  removeBlock(index: number) {
    const removed = this.blocks.splice(index, 1)[0];
    this.onBlockRemoved.emit(removed);
  }
}
