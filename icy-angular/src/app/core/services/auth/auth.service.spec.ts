import { TestBed } from '@angular/core/testing';

import { AuthService } from './auth.service';
import {coreTestProviders} from '@testing/test-providers';

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(() => {
    TestBed.configureTestingModule({providers: coreTestProviders});
    service = TestBed.inject(AuthService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
