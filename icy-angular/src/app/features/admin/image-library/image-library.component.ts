import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ImageMetadata } from '../../../model/image-metadata.model';
import { ImageTag } from '../../../model/image-tag.model';
import { ImageLibraryService } from '../../../core/services/image/image-library.service';

@Component({
  selector: 'app-image-library',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './image-library.component.html'
})
export class ImageLibraryComponent implements OnInit {

  images: ImageMetadata[] = [];
  isLoading = false;
  query = '';
  selectedCategory = 'Toutes';
  selectedSubcategory = 'Toutes';
  selectedTag = 'Tous';
  uploadModalOpen = false;
  uploadFile: File | null = null;
  uploadPreviewUrl: string | null = null;
  uploadCategory = '';
  uploadSubcategory = '';
  categoriesDb: string[] = [];
  subcategoriesDb: string[] = [];
  useNewCategory = false;
  useNewSubcategory = false;
  newCategoryName = '';
  newSubcategoryName = '';
  uploadTags: string[] = [];
  uploadTagColors: Record<string, string> = {};
  newTagName = '';
  newTagColor = '#22d3ee';
  tagColorMap: Record<string, string> = {};
  toastMessage: string | null = null; // ✅ Pour feedback visuel

  editModalOpen = false;
  editingImage: ImageMetadata | null = null;
  editCategory = '';
  editSubcategory = '';
  editTags: string[] = [];
  editTagColors: Record<string, string> = {};
  editUseNewCategory = false;
  editUseNewSubcategory = false;
  editNewCategoryName = '';
  editNewSubcategoryName = '';
  editNewTagName = '';
  editNewTagColor = '#22d3ee';

  constructor(private svc: ImageLibraryService) {}

  ngOnInit(): void {
    this.load();
    this.loadCategoriesDb();
    this.loadTags();
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

  loadCategoriesDb(): void {
    this.svc.getCategories().subscribe({
      next: (cats: string[]) => {
        this.categoriesDb = cats;
      },
      error: () => {}
    });
  }

  loadSubcategoriesDb(category: string): void {
    if (!category) {
      this.subcategoriesDb = [];
      return;
    }
    this.svc.getSubcategories(category).subscribe({
      next: (subs: string[]) => {
        this.subcategoriesDb = subs;
      },
      error: () => (this.subcategoriesDb = [])
    });
  }

  loadTags(): void {
    this.svc.getTags().subscribe({
      next: (tags: ImageTag[]) => {
        this.tagColorMap = tags.reduce((acc, t) => {
          acc[t.name] = t.color;
          return acc;
        }, {} as Record<string, string>);
      },
      error: () => {}
    });
  }

  get filtered(): ImageMetadata[] {
    const q = this.query.trim().toLowerCase();
    return this.images.filter(img => {
      if (this.selectedCategory !== 'Toutes') {
        const cat = (img.category || 'Sans categorie').trim() || 'Sans categorie';
        if (cat !== this.selectedCategory) return false;
      }
      if (this.selectedSubcategory !== 'Toutes') {
        const sub = (img.subcategory || '').trim() || 'Sans sous-categorie';
        if (sub !== this.selectedSubcategory) return false;
      }
      if (this.selectedTag !== 'Tous') {
        if (!(img.tags || []).includes(this.selectedTag)) return false;
      }
      if (!q) return true;
      return img.name.toLowerCase().includes(q) ||
        (img.description || '').toLowerCase().includes(q) ||
        (img.category || '').toLowerCase().includes(q) ||
        (img.subcategory || '').toLowerCase().includes(q) ||
        (img.tags || []).some((t: string) => t.toLowerCase().includes(q));
    });
  }

  onFilePick(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    if (!input.files?.length) return;
    const file = input.files[0];
    this.openUploadModal(file);
    input.value = '';
  }

  onDrop(ev: DragEvent): void {
    ev.preventDefault();
    const file = ev.dataTransfer?.files?.[0];
    if (file) this.openUploadModal(file);
  }

  onDragOver(ev: DragEvent): void {
    ev.preventDefault();
  }

  confirmUpload(): void {
    if (!this.uploadFile) return;
    this.isLoading = true;
    const tagColors = this.buildTagColors();
    const category = this.resolveUploadCategory();
    const subcategory = this.resolveUploadSubcategory();
    this.svc.upload(this.uploadFile, {
      category,
      subcategory,
      tags: this.uploadTags,
      tagColors
    }).subscribe({
      next: (meta: ImageMetadata) => {
        this.images.unshift(meta);
        this.isLoading = false;
        if (Object.keys(tagColors).length) {
          Object.assign(this.tagColorMap, tagColors);
        }
        this.loadCategoriesDb();
        if (category) {
          this.loadSubcategoriesDb(category);
        }
        this.closeUploadModal();
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

  get categories(): { name: string; coverUrl: string | null; count: number }[] {
    const map = new Map<string, { coverUrl: string | null; count: number }>();
    for (const img of this.images) {
      const name = (img.category || 'Sans categorie').trim() || 'Sans categorie';
      if (!map.has(name)) {
        map.set(name, { coverUrl: this.urlOf(img), count: 1 });
      } else {
        map.get(name)!.count += 1;
      }
    }
    return Array.from(map.entries())
      .map(([name, data]) => ({ name, coverUrl: data.coverUrl, count: data.count }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  get availableTags(): string[] {
    const tags = new Set<string>();
    for (const img of this.images) {
      if (this.selectedCategory !== 'Toutes') {
        const cat = (img.category || 'Sans categorie').trim() || 'Sans categorie';
        if (cat !== this.selectedCategory) continue;
      }
      if (this.selectedSubcategory !== 'Toutes') {
        const sub = (img.subcategory || '').trim() || 'Sans sous-categorie';
        if (sub !== this.selectedSubcategory) continue;
      }
      for (const tag of img.tags || []) tags.add(tag);
    }
    return Array.from(tags).sort((a, b) => a.localeCompare(b));
  }

  get availableTagsForUpload(): string[] {
    const tags = new Set<string>(this.uploadTags);
    const category = this.resolveUploadCategory() || this.selectedCategory;
    const subcategory = this.resolveUploadSubcategory();
    for (const img of this.images) {
      if (category && category !== 'Toutes') {
        const cat = (img.category || 'Sans categorie').trim() || 'Sans categorie';
        if (cat !== category) continue;
      }
      if (subcategory) {
        const sub = (img.subcategory || '').trim();
        if (sub !== subcategory) continue;
      }
      for (const tag of img.tags || []) tags.add(tag);
    }
    return Array.from(tags).sort((a, b) => a.localeCompare(b));
  }

  selectCategory(name: string): void {
    this.selectedCategory = name;
    this.selectedSubcategory = 'Toutes';
    this.selectedTag = 'Tous';
  }

  selectSubcategory(name: string): void {
    this.selectedSubcategory = name;
    this.selectedTag = 'Tous';
  }

  selectTag(tag: string): void {
    this.selectedTag = tag;
  }

  openUploadModal(file: File): void {
    this.uploadFile = file;
    this.uploadPreviewUrl = URL.createObjectURL(file);
    this.uploadModalOpen = true;
    this.uploadCategory = this.selectedCategory !== 'Toutes' ? this.selectedCategory : '';
    this.uploadSubcategory = '';
    this.uploadTags = [];
    this.uploadTagColors = {};
    this.useNewCategory = false;
    this.useNewSubcategory = false;
    this.newCategoryName = '';
    this.newSubcategoryName = '';
    this.loadCategoriesDb();
    if (this.uploadCategory) {
      this.loadSubcategoriesDb(this.uploadCategory);
    }
  }

  closeUploadModal(): void {
    if (this.uploadPreviewUrl) {
      URL.revokeObjectURL(this.uploadPreviewUrl);
    }
    this.uploadPreviewUrl = null;
    this.uploadFile = null;
    this.uploadModalOpen = false;
    this.uploadCategory = '';
    this.uploadSubcategory = '';
    this.uploadTags = [];
    this.uploadTagColors = {};
    this.newTagName = '';
    this.newTagColor = '#22d3ee';
    this.useNewCategory = false;
    this.useNewSubcategory = false;
    this.newCategoryName = '';
    this.newSubcategoryName = '';
  }

  toggleUploadTag(tag: string): void {
    if (this.uploadTags.includes(tag)) {
      this.uploadTags = this.uploadTags.filter(t => t !== tag);
      delete this.uploadTagColors[tag];
      return;
    }
    this.uploadTags = [...this.uploadTags, tag];
    const color = this.tagColorMap[tag] || '#22d3ee';
    this.uploadTagColors[tag] = color;
  }

  addNewTag(): void {
    const name = this.newTagName.trim();
    if (!name) return;
    if (!this.uploadTags.includes(name)) {
      this.uploadTags = [...this.uploadTags, name];
    }
    this.uploadTagColors[name] = this.newTagColor;
    this.tagColorMap[name] = this.newTagColor;
    this.newTagName = '';
    this.newTagColor = '#22d3ee';
  }

  openEditModal(img: ImageMetadata): void {
    this.editingImage = img;
    this.editModalOpen = true;
    this.editCategory = img.category || '';
    this.editSubcategory = img.subcategory || '';
    this.editTags = [...(img.tags || [])];
    this.editTagColors = {};
    this.editUseNewCategory = false;
    this.editUseNewSubcategory = false;
    this.editNewCategoryName = '';
    this.editNewSubcategoryName = '';
    this.editNewTagName = '';
    this.editNewTagColor = '#22d3ee';
    this.loadCategoriesDb();
    if (this.editCategory) {
      this.loadSubcategoriesDb(this.editCategory);
    } else {
      this.subcategoriesDb = [];
    }
  }

  closeEditModal(): void {
    this.editModalOpen = false;
    this.editingImage = null;
    this.editCategory = '';
    this.editSubcategory = '';
    this.editTags = [];
    this.editTagColors = {};
    this.editUseNewCategory = false;
    this.editUseNewSubcategory = false;
    this.editNewCategoryName = '';
    this.editNewSubcategoryName = '';
    this.editNewTagName = '';
    this.editNewTagColor = '#22d3ee';
  }

  confirmEdit(): void {
    if (!this.editingImage?.id) return;
    this.isLoading = true;
    const category = this.resolveEditCategory();
    const subcategory = this.resolveEditSubcategory();
    const tagColors = this.buildEditTagColors();
    this.svc.updateImage(this.editingImage.id, {
      category,
      subcategory,
      tags: this.editTags,
      tagColors
    }).subscribe({
      next: (updated: ImageMetadata) => {
        this.images = this.images.map(img => img.id === updated.id ? updated : img);
        if (Object.keys(tagColors).length) {
          Object.assign(this.tagColorMap, tagColors);
        }
        this.isLoading = false;
        this.closeEditModal();
      },
      error: () => (this.isLoading = false)
    });
  }

  toggleEditTag(tag: string): void {
    if (this.editTags.includes(tag)) {
      this.editTags = this.editTags.filter(t => t !== tag);
      delete this.editTagColors[tag];
      return;
    }
    this.editTags = [...this.editTags, tag];
    const color = this.tagColorMap[tag] || '#22d3ee';
    this.editTagColors[tag] = color;
  }

  addNewEditTag(): void {
    const name = this.editNewTagName.trim();
    if (!name) return;
    if (!this.editTags.includes(name)) {
      this.editTags = [...this.editTags, name];
    }
    this.editTagColors[name] = this.editNewTagColor;
    this.tagColorMap[name] = this.editNewTagColor;
    this.editNewTagName = '';
    this.editNewTagColor = '#22d3ee';
  }

  tagColor(tag: string): string {
    return this.tagColorMap[tag] || '#22d3ee';
  }

  private buildTagColors(): Record<string, string> {
    const result: Record<string, string> = {};
    for (const tag of this.uploadTags) {
      if (this.uploadTagColors[tag]) {
        result[tag] = this.uploadTagColors[tag];
      }
    }
    return result;
  }

  onCategorySelectChange(value: string): void {
    this.uploadCategory = value;
    this.useNewCategory = false;
    this.useNewSubcategory = false;
    this.uploadSubcategory = '';
    this.subcategoriesDb = [];
    if (this.uploadCategory) {
      this.loadSubcategoriesDb(this.uploadCategory);
    }
  }

  enableNewCategory(): void {
    this.useNewCategory = true;
    this.uploadCategory = '';
    this.uploadSubcategory = '';
    this.useNewSubcategory = false;
    this.subcategoriesDb = [];
  }

  enableNewSubcategory(): void {
    this.useNewSubcategory = true;
    this.uploadSubcategory = '';
  }

  saveNewCategory(): void {
    const name = this.newCategoryName.trim();
    if (!name) return;
    this.svc.createCategory(name).subscribe({
      next: () => {
        this.useNewCategory = false;
        this.uploadCategory = name;
        this.newCategoryName = '';
        this.loadCategoriesDb();
        this.loadSubcategoriesDb(name);
      },
      error: () => {}
    });
  }

  saveNewSubcategory(): void {
    const category = this.resolveUploadCategory();
    const name = this.newSubcategoryName.trim();
    if (!category || !name) return;
    this.svc.createSubcategory(category, name).subscribe({
      next: () => {
        this.useNewSubcategory = false;
        this.uploadSubcategory = name;
        this.newSubcategoryName = '';
        this.loadSubcategoriesDb(category);
      },
      error: () => {}
    });
  }

  cancelNewCategory(): void {
    this.useNewCategory = false;
    this.newCategoryName = '';
  }

  cancelNewSubcategory(): void {
    this.useNewSubcategory = false;
    this.newSubcategoryName = '';
  }

  onEditCategorySelectChange(value: string): void {
    this.editCategory = value;
    this.editUseNewCategory = false;
    this.editUseNewSubcategory = false;
    this.editSubcategory = '';
    this.subcategoriesDb = [];
    if (this.editCategory) {
      this.loadSubcategoriesDb(this.editCategory);
    }
  }

  enableNewCategoryEdit(): void {
    this.editUseNewCategory = true;
    this.editCategory = '';
    this.editSubcategory = '';
    this.editUseNewSubcategory = false;
    this.subcategoriesDb = [];
  }

  enableNewSubcategoryEdit(): void {
    this.editUseNewSubcategory = true;
    this.editSubcategory = '';
  }

  saveNewCategoryEdit(): void {
    const name = this.editNewCategoryName.trim();
    if (!name) return;
    this.svc.createCategory(name).subscribe({
      next: () => {
        this.editUseNewCategory = false;
        this.editCategory = name;
        this.editNewCategoryName = '';
        this.loadCategoriesDb();
        this.loadSubcategoriesDb(name);
      },
      error: () => {}
    });
  }

  saveNewSubcategoryEdit(): void {
    const category = this.resolveEditCategory();
    const name = this.editNewSubcategoryName.trim();
    if (!category || !name) return;
    this.svc.createSubcategory(category, name).subscribe({
      next: () => {
        this.editUseNewSubcategory = false;
        this.editSubcategory = name;
        this.editNewSubcategoryName = '';
        this.loadSubcategoriesDb(category);
      },
      error: () => {}
    });
  }

  cancelNewCategoryEdit(): void {
    this.editUseNewCategory = false;
    this.editNewCategoryName = '';
  }

  cancelNewSubcategoryEdit(): void {
    this.editUseNewSubcategory = false;
    this.editNewSubcategoryName = '';
  }

  private resolveEditCategory(): string | undefined {
    if (this.editUseNewCategory) {
      const name = this.editNewCategoryName.trim();
      return name || undefined;
    }
    const name = this.editCategory.trim();
    return name || undefined;
  }

  private resolveEditSubcategory(): string | undefined {
    if (this.editUseNewSubcategory) {
      const name = this.editNewSubcategoryName.trim();
      return name || undefined;
    }
    const name = this.editSubcategory.trim();
    return name || undefined;
  }

  private buildEditTagColors(): Record<string, string> {
    const result: Record<string, string> = {};
    for (const tag of this.editTags) {
      if (this.editTagColors[tag]) {
        result[tag] = this.editTagColors[tag];
      }
    }
    return result;
  }

  get availableTagsForEdit(): string[] {
    const tags = new Set<string>(this.editTags);
    const category = this.resolveEditCategory() || this.selectedCategory;
    const subcategory = this.resolveEditSubcategory();
    for (const img of this.images) {
      if (category && category !== 'Toutes') {
        const cat = (img.category || 'Sans categorie').trim() || 'Sans categorie';
        if (cat !== category) continue;
      }
      if (subcategory) {
        const sub = (img.subcategory || '').trim();
        if (sub !== subcategory) continue;
      }
      for (const tag of img.tags || []) tags.add(tag);
    }
    return Array.from(tags).sort((a, b) => a.localeCompare(b));
  }

  private resolveUploadCategory(): string | undefined {
    if (this.useNewCategory) {
      const name = this.newCategoryName.trim();
      return name || undefined;
    }
    const name = this.uploadCategory.trim();
    return name || undefined;
  }

  private resolveUploadSubcategory(): string | undefined {
    if (this.useNewSubcategory) {
      const name = this.newSubcategoryName.trim();
      return name || undefined;
    }
    const name = this.uploadSubcategory.trim();
    return name || undefined;
  }

  subcategoryCards(category: string): { name: string; coverUrl: string | null; count: number }[] {
    const map = new Map<string, { coverUrl: string | null; count: number }>();
    for (const img of this.images) {
      const cat = (img.category || 'Sans categorie').trim() || 'Sans categorie';
      if (cat !== category) continue;
      const sub = (img.subcategory || 'Sans sous-categorie').trim() || 'Sans sous-categorie';
      if (!map.has(sub)) {
        map.set(sub, { coverUrl: this.urlOf(img), count: 1 });
      } else {
        map.get(sub)!.count += 1;
      }
    }
    return Array.from(map.entries())
      .map(([name, data]) => ({ name, coverUrl: data.coverUrl, count: data.count }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }
}
