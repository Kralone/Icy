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
import { EventDTO, EventService } from '../../../../core/services/event/event.service';
import 'emoji-picker-element';

interface ActivityEventOption {
  id: string;
  title: string;
  description: string;
  typeName: string;
  startDateTime: string;
  selected: boolean;
  emoji: string;
}

interface NewMemberOption {
  username: string;
  joinedAt: string;
  selected: boolean;
}

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
  activityConfigBlock: IceLinkBlock | null = null;
  activityEvents: ActivityEventOption[] = [];
  isActivityLoading = false;
  activityLoadError = '';
  activityEmojiPickerIndex: number | null = null;
  membersConfigBlock: IceLinkBlock | null = null;
  memberOptions: NewMemberOption[] = [];

  constructor(private eventService: EventService) {}

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
        const inserted = this.blocks[event.currentIndex];
        if (inserted) {
          this.openSystemBlockConfig(inserted);
        }
        return;
      }
      if (sourceBlock?.template) {
        const cloned = this.buildCustomBlock(sourceBlock);
        this.blocks.splice(event.currentIndex, 0, cloned);
        this.openEdit(cloned);
        return;
      }
      transferArrayItem(
        event.previousContainer.data,
        event.container.data,
        event.previousIndex,
        event.currentIndex
      );
      const dropped = this.blocks[event.currentIndex];
      if (dropped && !dropped.isSystem) {
        this.openEdit(dropped);
      }
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
    if (block.isSystem) return;
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

  openActivityConfig(block: IceLinkBlock, event?: MouseEvent) {
    event?.stopPropagation();
    if (!this.isActivityBlock(block)) return;

    this.activityConfigBlock = block;
    this.activityLoadError = '';
    this.isActivityLoading = true;

    this.eventService.getUpcomingEvents().subscribe({
      next: (response) => {
        const now = new Date();
        const twoWeeksLater = new Date();
        twoWeeksLater.setDate(now.getDate() + 14);
        const selectedIds = new Set(block.selectedEventIds ?? []);
        const selectedEmojis = block.selectedEventEmojis ?? {};

        this.activityEvents = (response?.data ?? [])
          .filter((event) => this.isWithinNextTwoWeeks(event.startDateTime, now, twoWeeksLater))
          .sort((a, b) => new Date(a.startDateTime).getTime() - new Date(b.startDateTime).getTime())
          .map((event) => ({
            id: event.id,
            title: event.title || 'Événement',
            description: event.description || '',
            typeName: event.type?.name || '',
            startDateTime: event.startDateTime,
            selected: selectedIds.size > 0 ? selectedIds.has(event.id) : true,
            emoji: selectedEmojis[event.id] || '📌',
          }));

        this.isActivityLoading = false;
      },
      error: () => {
        this.activityLoadError = 'Impossible de charger les activités pour le moment.';
        this.activityEvents = [];
        this.isActivityLoading = false;
      },
    });
  }

  cancelActivityConfig() {
    this.activityConfigBlock = null;
    this.activityEvents = [];
    this.activityLoadError = '';
    this.isActivityLoading = false;
    this.activityEmojiPickerIndex = null;
  }

  saveActivityConfig() {
    if (!this.activityConfigBlock) return;

    const selectedEvents = this.activityEvents.filter((event) => event.selected);
    this.activityConfigBlock.selectedEventIds = selectedEvents.map((event) => event.id);
    this.activityConfigBlock.selectedEventEmojis = selectedEvents.reduce((acc, event) => {
      acc[event.id] = event.emoji || '📌';
      return acc;
    }, {} as Record<string, string>);
    this.activityConfigBlock.content = this.formatActivityContent(selectedEvents);
    this.cancelActivityConfig();
  }

  toggleAllActivities(checked: boolean) {
    this.activityEvents = this.activityEvents.map((event) => ({
      ...event,
      selected: checked,
    }));
    if (!checked) {
      this.activityEmojiPickerIndex = null;
    }
  }

  toggleActivityEmojiPicker(index: number, event: MouseEvent) {
    event.stopPropagation();
    this.activityEmojiPickerIndex = this.activityEmojiPickerIndex === index ? null : index;
  }

  onActivityEmojiPick(event: any, index: number) {
    const emoji = event?.detail?.unicode
      || event?.detail?.emoji?.unicode
      || event?.detail?.emoji?.native
      || event?.detail?.emoji
      || '';
    if (!emoji) return;
    this.activityEvents[index].emoji = emoji;
    this.activityEmojiPickerIndex = null;
  }

  onActivitySelectionChange(index: number, selected: boolean) {
    if (!selected && this.activityEmojiPickerIndex === index) {
      this.activityEmojiPickerIndex = null;
    }
  }

  openMembersConfig(block: IceLinkBlock, event?: MouseEvent) {
    event?.stopPropagation();
    if (!this.isNewMembersBlock(block)) return;

    this.membersConfigBlock = block;
    const selectedNames = new Set(block.selectedMemberNames ?? []);
    const parsedMembers = this.parseMembersFromContent(block.content);

    this.memberOptions = parsedMembers.map((member) => ({
      ...member,
      selected: selectedNames.size > 0 ? selectedNames.has(member.username) : true,
    }));
  }

  cancelMembersConfig() {
    this.membersConfigBlock = null;
    this.memberOptions = [];
  }

  saveMembersConfig() {
    if (!this.membersConfigBlock) return;
    const selectedMembers = this.memberOptions.filter((member) => member.selected);
    this.membersConfigBlock.selectedMemberNames = selectedMembers.map((member) => member.username);
    this.membersConfigBlock.content = this.formatMembersContent(selectedMembers);
    this.cancelMembersConfig();
  }

  toggleAllMembers(checked: boolean) {
    this.memberOptions = this.memberOptions.map((member) => ({
      ...member,
      selected: checked,
    }));
  }

  formatEventDate(dateValue: string): string {
    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) return dateValue;
    return date.toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  get selectedActivityCount(): number {
    return this.activityEvents.filter((event) => event.selected).length;
  }

  get selectedMembersCount(): number {
    return this.memberOptions.filter((member) => member.selected).length;
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

  private isActivityBlock(block: IceLinkBlock): boolean {
    const name = block.name?.trim().toLowerCase();
    return name === 'activité' || name === 'activités';
  }

  private isNewMembersBlock(block: IceLinkBlock): boolean {
    const name = block.name?.trim().toLowerCase();
    return name === 'nouveaux membres' || name === 'nouveaux';
  }

  private openSystemBlockConfig(block: IceLinkBlock) {
    if (this.isActivityBlock(block)) {
      this.openActivityConfig(block);
      return;
    }
    if (this.isNewMembersBlock(block)) {
      this.openMembersConfig(block);
    }
  }

  private isWithinNextTwoWeeks(dateValue: string, now: Date, twoWeeksLater: Date): boolean {
    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) return false;
    return date >= now && date <= twoWeeksLater;
  }

  private formatActivityContent(events: ActivityEventOption[]): string {
    if (events.length === 0) {
      return '> _Aucune activité sélectionnée pour les deux prochaines semaines._';
    }

    return events.map((event) => {
      const typePrefix = event.typeName?.trim() ? `${event.typeName} - ` : '';
      const description = event.description?.trim() || '_Pas de description disponible._';
      const schedule = this.formatEventSchedule(event.startDateTime);
      const quotedDescription = description
        .split('\n')
        .map((line) => `> ${line}`)
        .join('\n');
      return [
        `## <:SCIceforgelogo:1337019956524744767> **${event.emoji || '📌'} Event - ${typePrefix}${event.title}**`,
        `> 📅 **${schedule}**`,
        '>',
        quotedDescription,
      ].join('\n');
    }).join('\n\n');
  }

  private formatEventSchedule(dateValue: string): string {
    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) return dateValue;

    const weekdayRaw = date.toLocaleDateString('fr-FR', { weekday: 'long' });
    const weekday = weekdayRaw.charAt(0).toUpperCase() + weekdayRaw.slice(1);
    const dayMonth = date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
    const time = date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    return `${weekday} ${dayMonth} - ${time}`;
  }

  private parseMembersFromContent(content: string): NewMemberOption[] {
    if (!content) return [];

    const lines = content.split('\n');
    const parsed: NewMemberOption[] = [];
    const regex = /\*\*(.+?)\*\*\s*·\s*arrivé le\s*(\d{2}\/\d{2})/i;

    lines.forEach((line) => {
      const match = line.match(regex);
      if (!match) return;
      parsed.push({
        username: match[1].trim(),
        joinedAt: match[2].trim(),
        selected: true,
      });
    });

    return parsed;
  }

  private formatMembersContent(members: NewMemberOption[]): string {
    if (members.length === 0) {
      return '> _Aucun nouveau membre sélectionné._';
    }

    return members.map((member) => [
      `## <:SCIceforgelogo:1337019956524744767> **Nouveau membre - ${member.username}**`,
      `> 📅 **Arrivé le ${member.joinedAt}**`,
    ].join('\n')).join('\n\n');
  }
}
