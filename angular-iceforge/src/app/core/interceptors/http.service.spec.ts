import { TestBed } from '@angular/core/testing';

import { HttpInterceptor } from './http.interceptor';

describe('HttpService', () => {
  let service: HttpInterceptor;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(HttpInterceptor);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
