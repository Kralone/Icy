import { TestBed } from '@angular/core/testing';
import { Router, UrlTree } from '@angular/router';
import { firstValueFrom, Observable, of } from 'rxjs';

import { roleGuard } from './role.guard';
import { UserService } from '../../core/services/user/user.service';

describe('roleGuard', () => {
  let profile: { roles: string[]; specialty?: string | null };

  const run = (roles: string[]) => TestBed.runInInjectionContext(() =>
    firstValueFrom(roleGuard({ data: { roles } } as any, {} as any) as Observable<boolean | UrlTree>));

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        { provide: UserService, useValue: { getMyProfile: () => of({ data: profile }) } },
        { provide: Router, useValue: { createUrlTree: (commands: string[]) => commands.join('/') } }
      ]
    });
  });

  it('lets a member with one of the required roles in, and sends the others home', async () => {
    profile = { roles: ['officier'] };
    expect(await run(['ADMIN', 'OFFICIER'])).toBe(true);
    profile = { roles: ['INGENIEUR'] };
    expect(await run(['ADMIN', 'OFFICIER'])).toBe('/icy');
  });

  it('treats a Specialist with a pole as a referent, and one without a pole as an ordinary member', async () => {
    profile = { roles: ['SPECIALISTE'], specialty: 'MILITAIRE' };
    expect(await run(['ADMIN', 'OFFICIER', 'REFERENT'])).toBe(true);
    expect(await run(['ADMIN', 'OFFICIER'])).toBe('/icy');
    profile = { roles: ['SPECIALISTE'], specialty: null };
    expect(await run(['ADMIN', 'OFFICIER', 'REFERENT'])).toBe('/icy');
  });
});
