import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  ItemCatalogItem,
  ItemCatalogService,
  ItemCategory,
  ItemUpsertPayload
} from '../../../core/services/item/item-catalog.service';

@Component({
  selector: 'app-item-management',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './item-management.component.html',
  styleUrl: './item-management.component.css'
})
export class ItemManagementComponent implements OnInit {
  items: ItemCatalogItem[] = [];
  categories: ItemCategory[] = [];
  selectedCategoryId: number | null = null;
  isSubmitting = false;
  isCategorySubmitting = false;
  loading = false;
  errorMessage = '';
  editingItem: ItemCatalogItem | null = null;
  newCategoryName = '';

  form: ItemUpsertPayload = this.defaultForm();

  constructor(private readonly itemCatalogService: ItemCatalogService) {}

  ngOnInit(): void {
    this.loadAll();
  }

  loadAll(): void {
    this.loading = true;
    this.errorMessage = '';
    this.itemCatalogService.listItems().subscribe({
      next: (itemsResponse) => {
        this.items = [...(itemsResponse?.data ?? [])];
        this.itemCatalogService.listCategories().subscribe({
          next: (categoriesResponse) => {
            this.categories = [...(categoriesResponse?.data ?? [])];
            if (
              this.selectedCategoryId !== null &&
              !this.categories.some((category) => category.id === this.selectedCategoryId)
            ) {
              this.selectedCategoryId = null;
            }
            this.loading = false;
          },
          error: () => {
            this.loading = false;
            this.errorMessage = 'Impossible de charger les categories.';
          }
        });
      },
      error: () => {
        this.loading = false;
        this.errorMessage = 'Impossible de charger les items.';
      }
    });
  }

  setCategoryFilter(categoryId: number | null): void {
    this.selectedCategoryId = categoryId;
  }

  isCategorySelected(categoryId: number | null): boolean {
    return this.selectedCategoryId === categoryId;
  }

  get filteredItems(): ItemCatalogItem[] {
    if (this.selectedCategoryId === null) {
      return this.items;
    }
    return this.items.filter((item) => item.category?.id === this.selectedCategoryId);
  }

  createOrUpdateItem(): void {
    if (this.isSubmitting) {
      return;
    }
    const payload: ItemUpsertPayload = {
      name: this.form.name.trim(),
      manufacturer: this.trimToNull(this.form.manufacturer),
      imageUrl: this.trimToNull(this.form.imageUrl),
      description: this.trimToNull(this.form.description),
      stats: this.trimToNull(this.form.stats),
      categoryId: this.form.categoryId ?? null
    };
    if (!payload.name) {
      this.errorMessage = 'Le nom est requis.';
      return;
    }

    this.isSubmitting = true;
    const request$ = this.editingItem
      ? this.itemCatalogService.updateItem(this.editingItem.id, payload)
      : this.itemCatalogService.createItem(payload);

    request$.subscribe({
      next: () => {
        this.isSubmitting = false;
        this.resetForm();
        this.loadAll();
      },
      error: () => {
        this.isSubmitting = false;
        this.errorMessage = 'Operation impossible sur cet item.';
      }
    });
  }

  createCategory(): void {
    if (this.isCategorySubmitting) {
      return;
    }
    const name = this.newCategoryName.trim();
    if (!name) {
      this.errorMessage = 'Le nom de categorie est requis.';
      return;
    }

    this.isCategorySubmitting = true;
    this.itemCatalogService.createCategory(name).subscribe({
      next: (response) => {
        const created = response?.data;
        this.newCategoryName = '';
        this.isCategorySubmitting = false;
        this.itemCatalogService.listCategories().subscribe({
          next: (categoriesResponse) => {
            this.categories = [...(categoriesResponse?.data ?? [])];
            if (created?.id) {
              this.form.categoryId = created.id;
            }
          },
          error: () => {
            this.errorMessage = 'Categorie creee, mais rechargement impossible.';
          }
        });
      },
      error: () => {
        this.isCategorySubmitting = false;
        this.errorMessage = 'Creation de categorie impossible.';
      }
    });
  }

  editItem(item: ItemCatalogItem): void {
    this.editingItem = item;
    this.errorMessage = '';
    this.form = {
      name: item.name ?? '',
      manufacturer: item.manufacturer,
      imageUrl: item.imageUrl,
      description: item.description,
      stats: item.stats,
      categoryId: item.category?.id ?? null
    };
  }

  deleteItem(item: ItemCatalogItem): void {
    if (!confirm(`Supprimer l'item "${item.name}" ?`)) {
      return;
    }
    this.itemCatalogService.deleteItem(item.id).subscribe({
      next: () => {
        if (this.editingItem?.id === item.id) {
          this.resetForm();
        }
        this.loadAll();
      },
      error: () => {
        this.errorMessage = 'Suppression impossible.';
      }
    });
  }

  resetForm(): void {
    this.editingItem = null;
    this.form = this.defaultForm();
    this.errorMessage = '';
  }

  private trimToNull(value: string | null): string | null {
    if (value === null || value === undefined) {
      return null;
    }
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }

  private defaultForm(): ItemUpsertPayload {
    return {
      name: '',
      manufacturer: null,
      imageUrl: null,
      description: null,
      stats: null,
      categoryId: null
    };
  }
}
