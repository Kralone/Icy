import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';

import { CollectionsService } from './collection.service';

describe('CollectionsService', () => {
  let service: CollectionsService;

  beforeEach(() => {
    TestBed.configureTestingModule({providers: [provideHttpClient()]});
    service = TestBed.inject(CollectionsService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
