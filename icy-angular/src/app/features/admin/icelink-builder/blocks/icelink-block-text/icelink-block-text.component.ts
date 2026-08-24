import { Component, EventEmitter, Input, Output, ChangeDetectionStrategy } from '@angular/core';

import {IceLinkBlock} from '../../../../../core/services/icelink/icelink-block.service';

@Component({
  selector: 'app-icelink-block-text',
  standalone: true,
  imports: [],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './icelink-block-text.component.html',
})
export class IceLinkBlockTextComponent {
  @Input() block!: IceLinkBlock;
  @Output() blockChanged = new EventEmitter<IceLinkBlock>();

  isEditing = false;

  startEditing() {
    this.isEditing = true;
  }

  stopEditing() {
    this.isEditing = false;
    this.blockChanged.emit(this.block);
  }

  onInput(event: Event) {
    this.block.content = (event.target as HTMLElement).innerText;
  }
}
