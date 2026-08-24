
import { Component, EventEmitter, Input, Output, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { User } from '../../../../model/user.model';
import { MiningSheet } from '../../../../core/services/mining/mining-sheet.service';

@Component({
  standalone: true,
  selector: 'app-mining-sheets-admin-modal',
  imports: [FormsModule],
  templateUrl: './mining-sheets-admin-modal.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './mining-sheets-admin-modal.component.css'
})
export class MiningSheetsAdminModalComponent {
  @Input() visible = false;
  @Input() saving = false;
  @Input() sheet: MiningSheet | null = null;
  @Input() form!: {
    sheetName: string;
    operationDate: string;
    refineryLocation: string;
    saleLocation: string;
    memberIds: string[];
    memberSearch: string;
  } | null;
  @Input() saleLocationSuggestions: string[] = [];
  @Input() memberSuggestions: User[] = [];
  @Input() selectedMembers: User[] = [];
  @Input() toDisplayDate!: (isoDate: string) => string;

  @Output() close = new EventEmitter<void>();
  @Output() save = new EventEmitter<void>();
  @Output() lock = new EventEmitter<void>();
  @Output() unlock = new EventEmitter<void>();
  @Output() finalize = new EventEmitter<void>();
  @Output() saleLocationSearchChange = new EventEmitter<string>();
  @Output() saleLocationSelected = new EventEmitter<string>();
  @Output() addMember = new EventEmitter<User>();
  @Output() removeMember = new EventEmitter<string>();
}
