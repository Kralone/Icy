import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ImageMetadata } from '../../../model/image-metadata.model';
import { ImageLibraryService } from '../../../core/services/image/image-library.service';

@Component({
  selector: 'app-image-library',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './image-library.component.html'
})
export class ImageLibraryComponent implements OnInit {

  images: ImageMetadata[] = [];
  isLoading = false;
  query = '';
  toastMessage: string | null = null; // ✅ Pour feedback visuel

  constructor(private svc: ImageLibraryService) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.isLoading = true;
    this.svc.getAll().subscribe({
      next: (res: ImageMetadata[]) => {
        this.images = res;
        this.isLoading = false;
      },
      error: () => (this.isLoading = false)
    });
  }

  get filtered(): ImageMetadata[] {
    const q = this.query.trim().toLowerCase();
    if (!q) return this.images;
    return this.images.filter(img =>
      img.name.toLowerCase().includes(q) ||
      (img.description || '').toLowerCase().includes(q) ||
      (img.tags || []).some((t: string) => t.toLowerCase().includes(q))
    );
  }

  onFilePick(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    if (!input.files?.length) return;
    const file = input.files[0];
    this.doUpload(file);
    input.value = '';
  }

  onDrop(ev: DragEvent): void {
    ev.preventDefault();
    const file = ev.dataTransfer?.files?.[0];
    if (file) this.doUpload(file);
  }

  onDragOver(ev: DragEvent): void {
    ev.preventDefault();
  }

  private doUpload(file: File): void {
    this.isLoading = true;
    this.svc.upload(file).subscribe({
      next: (meta: ImageMetadata) => {
        this.images.unshift(meta);
        this.isLoading = false;
      },
      error: () => (this.isLoading = false)
    });
  }

  delete(meta: ImageMetadata): void {
    if (!confirm(`Supprimer l'image "${meta.name}" ?`)) return;
    this.svc.delete(meta.name).subscribe(() => {
      this.images = this.images.filter(x => x.name !== meta.name);
    });
  }

  urlOf(m: ImageMetadata): string {
    return this.svc.getImageUrl(m);
  }

  // ✅ Nouveau : copie du lien + toast
  copyLink(img: ImageMetadata): void {
    const link = this.urlOf(img);
    navigator.clipboard.writeText(link).then(() => {
      this.showToast(`Lien copié : ${link}`);
    }).catch(() => {
      this.showToast('Erreur lors de la copie du lien.');
    });
  }

  private showToast(message: string): void {
    this.toastMessage = message;
    setTimeout(() => this.toastMessage = null, 2500); // disparaît après 2.5s
  }
}
