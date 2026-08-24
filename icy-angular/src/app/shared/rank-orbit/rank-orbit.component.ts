import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-rank-orbit',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './rank-orbit.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './rank-orbit.component.css'
})
export class RankOrbitComponent {
  @Input() rank: string = 'JUNIOR';
  @Input() animateOrbits = false;
  @Input() animateWhole = false;
  @Input() glow = true;
  @Input() deploy = false;

  private roleAliases: Record<string, string> = {
    USER: 'JUNIOR',
    MEMBRE: 'JUNIOR',
    RECRUE: 'JUNIOR'
  };

  get normalizedRank(): string {
    const raw = (this.rank ?? 'JUNIOR').toUpperCase();
    return this.roleAliases[raw] ?? raw;
  }

  orbitClass(level: number): string | null {
    return this.animateOrbits ? `orbit-spin orbit-${level}` : null;
  }
}
