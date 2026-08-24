import { Component, EventEmitter, Output, ChangeDetectionStrategy } from '@angular/core';


@Component({
  selector: 'app-icelink-header',
  standalone: true,
  imports: [],
  changeDetection: ChangeDetectionStrategy.Eager,
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
