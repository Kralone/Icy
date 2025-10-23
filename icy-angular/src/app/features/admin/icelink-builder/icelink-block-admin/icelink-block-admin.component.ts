import { Component, EventEmitter, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IceLinkBlockService, IceLinkBlock } from '../../../../core/services/icelink/icelink-block.service';

@Component({
  selector: 'app-icelink-block-admin',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './icelink-block-admin.component.html',
})
export class IceLinkBlockAdminComponent implements OnInit {
  @Output() onBlockDeleted = new EventEmitter<number>();

  blocks: IceLinkBlock[] = []; // ✅ Nom cohérent avec ton template
  isLoading = false;
  isSubmitting = false;
  isUpdating = false;

  newBlock: IceLinkBlock = {
    name: '',
    icon: '',
    headline: '',
    content: '',
    description: '',
  };

  editingBlock: IceLinkBlock | null = null;

  constructor(private blockService: IceLinkBlockService) {}

  ngOnInit(): void {
    this.isLoading = true;

    // ✅ écoute réactive de la liste des blocs
    this.blockService.blocks$.subscribe({
      next: (blocks: IceLinkBlock[]) => {
        this.blocks = blocks;
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Erreur chargement blocs', err);
        this.isLoading = false;
      },
    });

    // ✅ chargement initial
    this.blockService.loadBlocks();
  }

  /** 🔹 Création d’un bloc */
  createBlock() {
    if (!this.newBlock.name?.trim() || !this.newBlock.content?.trim()) return;
    this.isSubmitting = true;

    // 🧊 Formattage automatique du headline
    this.newBlock.headline = `## ${this.newBlock.icon || '❄️'} ${this.newBlock.name.trim()}`;

    this.blockService.createBlock(this.newBlock).subscribe({
      next: () => {
        this.newBlock = { name: '', icon: '', headline: '', content: '', description: '' };
        this.isSubmitting = false;
      },
      error: (err) => {
        console.error('Erreur création bloc', err);
        this.isSubmitting = false;
      },
    });
  }

  /** 🔹 Edition */
  editBlock(block: IceLinkBlock) {
    this.editingBlock = { ...block };
  }

  cancelEdit() {
    this.editingBlock = null;
  }

  /** 🔹 Mise à jour */
  updateBlock() {
    if (!this.editingBlock) return;
    this.isUpdating = true;

    // 🧊 Reformattage automatique du headline
    this.editingBlock.headline = `## ${this.editingBlock.icon || '❄️'} ${this.editingBlock.name.trim()}`;

    this.blockService.updateBlock(this.editingBlock.id!, this.editingBlock).subscribe({
      next: () => {
        this.isUpdating = false;
        this.editingBlock = null;
      },
      error: (err) => {
        console.error('Erreur mise à jour bloc', err);
        this.isUpdating = false;
      },
    });
  }

  /** 🔹 Suppression */
  deleteBlock(id: number) {
    if (!confirm('Supprimer ce bloc ?')) return;

    this.blockService.deleteBlock(id).subscribe({
      next: () => {
        console.log('Bloc supprimé avec succès');
        this.onBlockDeleted.emit(id); // 🔹 pour prévenir le builder
      },
      error: (err) => console.error('Erreur de suppression :', err),
    });
  }
}
