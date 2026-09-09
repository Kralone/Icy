import { TestBed } from '@angular/core/testing';

import { UserService } from './user.service';
import {coreTestProviders} from '@testing/test-providers';
import { HttpTestingController } from '@angular/common/http/testing';

describe('UserService', () => {
  let service: UserService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({providers: coreTestProviders});
    service = TestBed.inject(UserService);
    http = TestBed.inject(HttpTestingController);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('loads inactive users and reactivates one', () => {
    service.getInactiveUsers().subscribe();
    const inactive = http.expectOne('/api/users/inactive');
    expect(inactive.request.method).toBe('GET');
    inactive.flush({ data: [] });

    service.reactivateUser('user id').subscribe();
    const reactivate = http.expectOne('/api/users/reactivate?id=user%20id');
    expect(reactivate.request.method).toBe('PUT');
    reactivate.flush({ data: null });
  });
});
