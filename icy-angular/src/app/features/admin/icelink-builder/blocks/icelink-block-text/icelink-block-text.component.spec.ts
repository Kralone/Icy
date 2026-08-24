import { ComponentFixture, TestBed } from '@angular/core/testing';

import { IceLinkBlockTextComponent } from './icelink-block-text.component';
import {coreTestProviders} from '@testing/test-providers';

describe('IceLinkBlockTextComponent', () => {
  let component: IceLinkBlockTextComponent;
  let fixture: ComponentFixture<IceLinkBlockTextComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [IceLinkBlockTextComponent],
      providers: coreTestProviders
    })
    .compileComponents();

    fixture = TestBed.createComponent(IceLinkBlockTextComponent);
    component = fixture.componentInstance;
    component.block = {
      name: 'Test',
      icon: '📝',
      headline: 'Bloc de test',
      content: 'Contenu de test',
    };
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
