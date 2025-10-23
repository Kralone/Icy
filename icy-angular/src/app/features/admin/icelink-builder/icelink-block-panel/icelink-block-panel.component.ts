import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DragDropModule, CdkDragDrop, moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';
import { IceLinkBlock } from '../icelink-builder.component';

@Component({
  selector: 'app-icelink-block-panel',
  standalone: true,
  imports: [CommonModule, DragDropModule],
  templateUrl: './icelink-block-panel.component.html',
})
export class IceLinkBlockPanelComponent {
  // 🔹 Liste initiale — source immuable
  private readonly initialBlocks: IceLinkBlock[] = [
    { id: 'citizencon', title: 'CitizenCon', icon: '🎉', content: '### <:SCLogo:1188265603534958662> CitizenCon 2955\n> ' },
    { id: 'farming', title: 'Farming list', icon: '🚀', content: '### <:SCIceforgelogo:1337019956524744767> Farming list\n> ' },
    { id: 'recruitment', title: 'Recrutement', icon: '📎', content: '## 📎 On recrute !!\n> ' },
    { id: 'events', title: 'Activités', icon: '📅', content: '## 🏔️ Activités de la semaine\n> ' },
    { id: 'appel', title: 'Appel à la communauté', icon: '👀', content: '## 👀 Appel à la communauté\n> Merci de **réagir**...' },
  ];

  // 🔹 Liste affichée — modifiable
  availableBlocks: IceLinkBlock[] = structuredClone(this.initialBlocks);

  drop(event: CdkDragDrop<IceLinkBlock[]>) {
    if (event.previousContainer === event.container) {
      moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);
    } else {
      transferArrayItem(
        event.previousContainer.data,
        event.container.data,
        event.previousIndex,
        event.currentIndex
      );
    }
  }

  addBlock(block: IceLinkBlock) {
    this.availableBlocks.push(block);
  }

  // ✅ Réinitialiser la liste
  resetBlocks() {
    this.availableBlocks = structuredClone(this.initialBlocks);
  }
}
