import { Observable, of, Subject, throwError } from 'rxjs';
import { DraftAutosave } from './operation-autosave';

interface Payload { briefing: string; }
type SaveResult = { revision?: number | null };

describe('DraftAutosave', () => {
  let requests: Array<{ payload: Payload; revision: number | null; keepalive: boolean; response: Subject<SaveResult> }>;
  let autosave: DraftAutosave<Payload>;
  let changes: number;

  beforeEach(() => {
    vi.useFakeTimers();
    requests = [];
    changes = 0;
    autosave = new DraftAutosave<Payload>({
      delayMs: 1500,
      save: (payload, revision, options): Observable<SaveResult> => {
        const response = new Subject<SaveResult>();
        requests.push({ payload, revision, keepalive: options.keepalive, response });
        return response;
      },
      describeError: error => (error as { status?: number })?.status === 0 ? 'Serveur injoignable.' : 'Refusé.',
      onChange: () => changes++
    });
    autosave.reset({ briefing: '' }, 3, null);
  });

  afterEach(() => vi.useRealTimers());

  function confirm(index: number, revision: number): void {
    requests[index].response.next({ revision });
    requests[index].response.complete();
  }

  it('waits for a pause in typing and sends only the latest content', () => {
    autosave.update({ briefing: 'a' });
    vi.advanceTimersByTime(1000);
    autosave.update({ briefing: 'ab' });
    vi.advanceTimersByTime(1000);
    autosave.update({ briefing: 'abc' });
    expect(autosave.status).toBe('dirty');
    expect(requests.length).toBe(0);

    vi.advanceTimersByTime(1500);

    expect(requests.length).toBe(1);
    expect(requests[0]).toMatchObject({ payload: { briefing: 'abc' }, revision: 3, keepalive: false });
    expect(autosave.status).toBe('saving');
  });

  it('reports saved only once the server has confirmed', () => {
    autosave.update({ briefing: 'abc' });
    vi.advanceTimersByTime(1500);
    expect(autosave.status).toBe('saving');
    expect(autosave.hasUnsavedChanges).toBe(true);

    confirm(0, 4);

    expect(autosave.status).toBe('saved');
    expect(autosave.savedAt).not.toBeNull();
  });

  it('never runs two writes at once: edits made during a save go next, with the confirmed revision', () => {
    autosave.update({ briefing: 'v1' });
    vi.advanceTimersByTime(1500);
    autosave.update({ briefing: 'v2' });
    vi.advanceTimersByTime(1500);
    autosave.update({ briefing: 'v3' });
    vi.advanceTimersByTime(1500);
    expect(requests.length).toBe(1);

    confirm(0, 4);

    expect(requests.length).toBe(2);
    expect(requests[1]).toMatchObject({ payload: { briefing: 'v3' }, revision: 4 });
    expect(autosave.status).toBe('saving');
    confirm(1, 5);
    expect(autosave.status).toBe('saved');
  });

  it('keeps the status unsaved when a confirmation arrives for older content', () => {
    autosave.update({ briefing: 'v1' });
    autosave.flush();
    autosave.update({ briefing: 'v2' });

    confirm(0, 4);

    expect(autosave.status).toBe('dirty');
    expect(requests.length).toBe(1);
    vi.advanceTimersByTime(1500);
    expect(requests[1].payload.briefing).toBe('v2');
  });

  it('shows an error on network failure, keeps the content and retries it', () => {
    autosave.update({ briefing: 'abc' });
    autosave.flush();

    requests[0].response.error({ status: 0 });

    expect(autosave.status).toBe('error');
    expect(autosave.errorMessage).toBe('Serveur injoignable.');
    expect(autosave.hasUnsavedChanges).toBe(true);

    autosave.retry();
    expect(requests[1]).toMatchObject({ payload: { briefing: 'abc' }, revision: 3 });
    confirm(1, 4);
    expect(autosave.status).toBe('saved');
  });

  it('retries with the newest content when the user keeps typing after a failure', () => {
    autosave.update({ briefing: 'v1' });
    autosave.flush();
    autosave.update({ briefing: 'v2' });
    requests[0].response.error({ status: 0 });
    expect(autosave.status).toBe('error');

    vi.advanceTimersByTime(1500);

    expect(requests[1].payload.briefing).toBe('v2');
  });

  it('stops writing on a conflict until the user decides', () => {
    autosave.update({ briefing: 'mine' });
    autosave.flush();
    requests[0].response.error({ status: 409 });
    expect(autosave.status).toBe('conflict');

    autosave.update({ briefing: 'mine, suite' });
    vi.advanceTimersByTime(5000);
    autosave.flush();
    expect(requests.length).toBe(1);

    autosave.overwriteFrom(9);
    expect(requests[1]).toMatchObject({ payload: { briefing: 'mine, suite' }, revision: 9 });
  });

  it('goes back to saved without a request when the content returns to the saved version', () => {
    autosave.update({ briefing: 'x' });
    autosave.update({ briefing: '' });
    vi.advanceTimersByTime(5000);

    expect(autosave.status).toBe('saved');
    expect(requests.length).toBe(0);
  });

  it('only tracks changes when automatic saving is off', () => {
    autosave.auto = false;
    autosave.update({ briefing: 'publié' });
    vi.advanceTimersByTime(5000);
    expect(requests.length).toBe(0);
    expect(autosave.status).toBe('dirty');

    autosave.flush();
    expect(requests.length).toBe(1);
  });

  it('forces the latest content out when the page closes during a save', () => {
    autosave.update({ briefing: 'v1' });
    autosave.flush();
    autosave.update({ briefing: 'v2' });

    autosave.flush({ keepalive: true });

    expect(requests[1]).toMatchObject({ payload: { briefing: 'v2' }, revision: null, keepalive: true });
  });

  it('works with a synchronous server answer', () => {
    const immediate = new DraftAutosave<Payload>({
      delayMs: 1500,
      save: payload => payload.briefing === 'ko' ? throwError(() => ({ status: 500 })) : of({ revision: 2 }),
      describeError: () => 'Refusé.',
      onChange: () => undefined
    });
    immediate.reset({ briefing: '' }, 1, null);
    immediate.update({ briefing: 'ko' });
    immediate.flush();
    expect(immediate.status).toBe('error');
    immediate.update({ briefing: 'ok' });
    immediate.flush();
    expect(immediate.status).toBe('saved');
    expect(changes).toBeGreaterThanOrEqual(0);
  });
});
