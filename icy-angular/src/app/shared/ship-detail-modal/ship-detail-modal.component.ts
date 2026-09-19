import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface ShipDetail { name:string; brand?:string; brandImageUrl?:string; imageUrl?:string; focus?:string; crew?:string; cargo?:string; description?:string; owners?:string[]; }
@Component({selector:'app-ship-detail-modal', standalone:true, imports:[CommonModule], templateUrl:'./ship-detail-modal.component.html', styleUrls:['./ship-detail-modal.component.css']})
export class ShipDetailModalComponent {
 @Input() ship: ShipDetail|null = null; @Input() owners:string[]=[]; @Output() closed=new EventEmitter<void>();
 close(){this.closed.emit();}
}
