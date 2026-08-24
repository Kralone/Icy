import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withXhr } from '@angular/common/http';
import { provideRouter } from '@angular/router';

import { HttpAuthInterceptor } from './http.interceptor';

describe('HttpAuthInterceptor', () => {
  let service: HttpAuthInterceptor;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withXhr()), provideRouter([]), HttpAuthInterceptor]
    });
    service = TestBed.inject(HttpAuthInterceptor);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
