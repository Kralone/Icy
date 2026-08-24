import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ImageLibraryComponent } from './image-library.component';
import {coreTestProviders} from '@testing/test-providers';

describe('ImageLibraryComponent', () => {
  let component: ImageLibraryComponent;
  let fixture: ComponentFixture<ImageLibraryComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ImageLibraryComponent],
      providers: coreTestProviders
    })
    .compileComponents();

    fixture = TestBed.createComponent(ImageLibraryComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
