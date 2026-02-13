import { Component, EventEmitter, Input, Output } from '@angular/core';
import { NgClass, NgIf } from '@angular/common';

@Component({
  selector: 'app-loading-overlay',
  imports: [
    NgClass,
    NgIf
  ],
  templateUrl: './loading-overlay.component.html',
  styleUrl: './loading-overlay.component.css'
})
export class LoadingOverlayComponent {
  @Input() minDurationMs = 0;
  @Input() fadeOutMs = 300;
  @Input() softFade = false;
  @Output() hidden = new EventEmitter<void>();

  visible = false;
  fading = false;

  private loading = false;
  private startedAt = 0;
  private hideTimer?: ReturnType<typeof setTimeout>;
  private fadeTimer?: ReturnType<typeof setTimeout>;

  @Input()
  set isLoading(value: boolean) {
    this.loading = value;
    if (value) {
      this.startedAt = Date.now();
      this.visible = true;
      this.fading = false;
      this.clearTimers();
      return;
    }
    this.scheduleHide();
  }

  get isLoading(): boolean {
    return this.loading;
  }

  private scheduleHide(): void {
    if (!this.visible) {
      return;
    }
    this.clearTimers();
    const elapsed = Date.now() - this.startedAt;
    const delay = Math.max(0, this.minDurationMs - elapsed);
    this.hideTimer = setTimeout(() => this.startFade(), delay);
  }

  private startFade(): void {
    if (this.loading || !this.visible) {
      return;
    }
    if (this.fadeOutMs > 0) {
      this.fading = true;
      this.fadeTimer = setTimeout(() => this.finishHide(), this.fadeOutMs);
      return;
    }
    this.finishHide();
  }

  private finishHide(): void {
    if (this.loading) {
      return;
    }
    this.visible = false;
    this.fading = false;
    this.hidden.emit();
  }

  private clearTimers(): void {
    if (this.hideTimer) {
      clearTimeout(this.hideTimer);
      this.hideTimer = undefined;
    }
    if (this.fadeTimer) {
      clearTimeout(this.fadeTimer);
      this.fadeTimer = undefined;
    }
  }
}
