import {
  Component,
  ElementRef,
  EventEmitter,
  Input,
  Output,
  QueryList,
  ViewChildren,
  CUSTOM_ELEMENTS_SCHEMA,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  CdkDragDrop,
  CdkDragMove,
  DragDropModule,
  moveItemInArray,
  transferArrayItem,
} from '@angular/cdk/drag-drop';
import { IceLinkBlock } from '../../../../core/services/icelink/icelink-block.service';
import { FormsModule } from '@angular/forms';
import 'emoji-picker-element';

@Component({
  selector: 'app-icelink-dropzone',
  standalone: true,
  imports: [CommonModule, DragDropModule, FormsModule],
  templateUrl: './icelink-dropzone.component.html',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class IceLinkDropzoneComponent {
  @Input() blocks: IceLinkBlock[] = [];
  @Output() onBlockRemoved = new EventEmitter<IceLinkBlock>();
  @ViewChildren('blockEl') blockEls!: QueryList<ElementRef<HTMLElement>>;

  isActive = false;
  draggingIndex: number | null = null;
  positions: { top: number; left: number }[] = [];
  editingBlock: IceLinkBlock | null = null;
  editDraft: IceLinkBlock | null = null;
  emojiPickerOpen = false;

  onEnter() {
    this.isActive = true;
  }

  onLeave() {
    this.isActive = false;
  }

  onDragStart(index: number) {
    this.draggingIndex = index;
    this.storePositions();
  }

  storePositions() {
    this.positions = this.blockEls.map((ref) => {
      const rect = ref.nativeElement.getBoundingClientRect();
      return { top: rect.top, left: rect.left };
    });
  }

  onDragMove(event: CdkDragMove<IceLinkBlock>) {
    if (this.draggingIndex == null) return;

    const draggedRect =
      this.blockEls.toArray()[this.draggingIndex].nativeElement.getBoundingClientRect();
    const midX = draggedRect.left + draggedRect.width / 2;
    const midY = draggedRect.top + draggedRect.height / 2;

    this.blockEls.forEach((ref, i) => {
      const el = ref.nativeElement;
      if (i === this.draggingIndex) return;

      const rect = this.positions[i];
      const dx = midX - (rect.left + draggedRect.width / 2);
      const dy = midY - (rect.top + draggedRect.height / 2);
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Effet d’éloignement basé sur la proximité
      const push = dist < 160 ? (160 - dist) / 8 : 0;
      const angle = Math.atan2(dy, dx);
      const offsetX = -Math.cos(angle) * push;
      const offsetY = -Math.sin(angle) * push;

      el.style.transform = push
        ? `translate(${offsetX}px, ${offsetY}px)`
        : 'translate(0, 0)';
    });
  }

  onDragEnd() {
    this.blockEls.forEach((ref) => {
      ref.nativeElement.style.transform = 'translate(0, 0)';
    });
    this.draggingIndex = null;
  }

  drop(event: CdkDragDrop<IceLinkBlock[]>) {
    this.onDragEnd();

    if (event.previousContainer === event.container) {
      moveItemInArray(this.blocks, event.previousIndex, event.currentIndex);
    } else {
      const sourceBlock = event.previousContainer.data[event.previousIndex];
      if (sourceBlock?.isSystem) {
        if (this.hasBlockByName(sourceBlock.name)) return;
        this.blocks.splice(event.currentIndex, 0, { ...sourceBlock });
        return;
      }
      if (sourceBlock?.template) {
        const cloned = this.buildCustomBlock(sourceBlock);
        this.blocks.splice(event.currentIndex, 0, cloned);
        return;
      }
      transferArrayItem(
        event.previousContainer.data,
        event.container.data,
        event.previousIndex,
        event.currentIndex
      );
    }
  }

  removeBlock(index: number) {
    if (this.blocks[index]?.isSystem) return;
    const removed = this.blocks.splice(index, 1)[0];
    this.onBlockRemoved.emit(removed);
  }

  trackByIndex(index: number): number {
    return index;
  }

  openEdit(block: IceLinkBlock, event?: MouseEvent) {
    event?.stopPropagation();
    if (!block.isCustom) return;
    this.editingBlock = block;
    this.editDraft = { ...block };
  }

  cancelEdit() {
    this.editingBlock = null;
    this.editDraft = null;
  }

  saveEdit() {
    if (!this.editingBlock || !this.editDraft) return;
    const icon = this.editDraft.icon?.trim() || '✏️';
    const name = this.editDraft.name?.trim() || 'Bloc custom';

    this.editingBlock.icon = icon;
    this.editingBlock.name = name;
    this.editingBlock.description = '';
    this.editingBlock.content = this.editDraft.content || '';
    this.editingBlock.headline = `## ${icon} ${name}`;

    this.cancelEdit();
  }

  toggleEmojiPicker() {
    this.emojiPickerOpen = !this.emojiPickerOpen;
  }

  onEmojiPick(event: any) {
    if (!this.editDraft) return;
    const emoji = event?.detail?.unicode
      || event?.detail?.emoji?.unicode
      || event?.detail?.emoji?.native
      || event?.detail?.emoji
      || '';
    if (!emoji) return;
    this.editDraft.icon = emoji;
    this.emojiPickerOpen = false;
  }

  private buildCustomBlock(template: IceLinkBlock): IceLinkBlock {
    return {
      ...template,
      id: undefined,
      template: false,
      isCustom: true,
      name: 'Bloc custom',
      icon: '✏️',
      headline: '## ✏️ Bloc custom',
      description: '',
      content: '',
    };
  }

  private hasBlockByName(name: string): boolean {
    const target = name?.trim().toLowerCase();
    return this.blocks.some((block) => block.name?.trim().toLowerCase() === target);
  }
}
