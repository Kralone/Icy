import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-icelink-header',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './icelink-header.component.html',
})
export class IceLinkHeaderComponent {
  @Output() onSave = new EventEmitter<void>();
  @Output() onReset = new EventEmitter<void>();

  handleSave() {
    this.onSave.emit();
  }

  handleReset() {
    this.onReset.emit();
  }
}
