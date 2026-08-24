import { TestBed } from '@angular/core/testing';

import { EventService } from './event.service';
import {coreTestProviders} from '@testing/test-providers';

describe('EventService', () => {
  let service: EventService;

  beforeEach(() => {
    TestBed.configureTestingModule({providers: coreTestProviders});
    service = TestBed.inject(EventService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
