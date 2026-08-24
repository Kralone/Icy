import { TestBed } from '@angular/core/testing';

import { ShipService } from './ship.service';
import {coreTestProviders} from '@testing/test-providers';

describe('ShipService', () => {
  let service: ShipService;

  beforeEach(() => {
    TestBed.configureTestingModule({providers: coreTestProviders});
    service = TestBed.inject(ShipService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
