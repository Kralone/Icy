import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { User } from '../../../../model/user.model';

@Component({
  standalone: true,
  selector: 'app-mining-sheets-create-modal',
  imports: [CommonModule, FormsModule],
  templateUrl: './mining-sheets-create-modal.component.html',
  styleUrl: './mining-sheets-create-modal.component.css'
})
export class MiningSheetsCreateModalComponent {
  @Input() visible = false;
  @Input() saving = false;
  @Input() actionError = '';
  @Input() form!: {
    sheetName: string;
    operationDate: string;
    refineryLocation: string;
    saleLocation: string;
    memberIds: string[];
    memberSearch: string;
  };
  @Input() saleLocationSuggestions: string[] = [];
  @Input() memberSuggestions: User[] = [];
  @Input() selectedMembers: User[] = [];

  @Output() close = new EventEmitter<void>();
  @Output() submit = new EventEmitter<void>();
  @Output() saleLocationSearchChange = new EventEmitter<string>();
  @Output() saleLocationSelected = new EventEmitter<string>();
  @Output() addMember = new EventEmitter<User>();
  @Output() removeMember = new EventEmitter<string>();
}
