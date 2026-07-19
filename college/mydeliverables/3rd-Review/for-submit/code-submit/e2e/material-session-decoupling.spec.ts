import { test, expect, type Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

const APP_URL = 'http://localhost:5173';

function testEmail(prefix: string): string {
  return `${prefix}+${Date.now()}@test.studytracker.app`;
}

async function createTestUser(email: string, password: string): Promise<void> {
  const supabaseUrl = process.env.SUPABASE_URL!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  await adminClient.auth.admin.createUser({ email, password, email_confirm: true });
}

async function signIn(page: Page, email: string, password: string): Promise<void> {
  await page.goto(`${APP_URL}/study/sign-in`);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.waitForURL(/\/study\/(home|onboarding)/, { timeout: 10000 });
}

async function userDbName(page: Page): Promise<string> {
  // The per-user Dexie DB is created in an effect after auth resolves, so poll.
  return page.evaluate(async () => {
    for (let attempt = 0; attempt < 60; attempt += 1) {
      const dbs = await indexedDB.databases();
      const userDb = dbs.find((db) => db.name?.startsWith('StudyTracker_'));
      if (userDb?.name) return userDb.name;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    throw new Error('No StudyTracker DB found');
  });
}

async function seedEvents(page: Page, events: Array<{ kind: string; payload: Record<string, unknown>; createdAt: string }>): Promise<void> {
  const dbName = await userDbName(page);
  await page.evaluate(async ({ dbName, events }) => {
    const request = indexedDB.open(dbName);
    await new Promise<void>((resolve, reject) => {
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction('events', 'readwrite');
        const store = tx.objectStore('events');
        for (const event of events) store.add(event);
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onerror = () => reject(tx.error);
      };
      request.onerror = () => reject(request.error);
    });
  }, { dbName, events });
}

async function readStoredEvents(page: Page): Promise<Array<{ kind: string; payload: Record<string, unknown>; createdAt: string }>> {
  const dbName = await userDbName(page);
  return page.evaluate(async (dbName) => {
    const request = indexedDB.open(dbName);
    return new Promise<Array<{ kind: string; payload: Record<string, unknown>; createdAt: string }>>((resolve, reject) => {
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction('events', 'readonly');
        const getAll = tx.objectStore('events').getAll();
        getAll.onsuccess = () => {
          db.close();
          resolve(getAll.result.map((row: any) => ({
            kind: row.kind,
            payload: row.payload,
            createdAt: row.createdAt,
          })));
        };
        getAll.onerror = () => reject(getAll.error);
      };
      request.onerror = () => reject(request.error);
    });
  }, dbName);
}

async function seedActiveSession(page: Page): Promise<void> {
  const dbName = await userDbName(page);
  await page.evaluate(async (dbName) => {
    const request = indexedDB.open(dbName);
    await new Promise<void>((resolve, reject) => {
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction('activeSession', 'readwrite');
        tx.objectStore('activeSession').put({
          id: 1,
          sessionId: crypto.randomUUID(),
          materialId: 'mat-1',
          sessionTitle: 'Linear Algebra Lecture 4',
          bookingId: 'booking-today',
          slotDate: new Date().toISOString().slice(0, 10),
          weekIndex: 0,
          plannedMinutes: 50,
          plannedSessionMinutes: 50,
          materialEstimatedMinutes: 120,
          startedAt: new Date().toISOString(),
          status: 'active',
          pauseIntervals: [],
          pomodoroConfig: { workMinutes: 50, breakMinutes: 10 },
          kind: 'manual',
        });
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onerror = () => reject(tx.error);
      };
      request.onerror = () => reject(request.error);
    });
  }, dbName);
}

async function seedOnboardingDraft(page: Page): Promise<void> {
  const dbName = await userDbName(page);
  await page.evaluate(async (dbName) => {
    const deadline = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const request = indexedDB.open(dbName);
    await new Promise<void>((resolve, reject) => {
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction('onboardingDraft', 'readwrite');
        tx.objectStore('onboardingDraft').put({
          id: 1,
          state: {
            deadline,
            purpose: 'Exam prep',
            weeklyHours: 6,
            weekdayHours: 1,
            weekendHours: 1,
            selectedStudyDays: ['Mon', 'Wed', 'Fri'],
            materials: [{
              id: 'mat-1',
              title: 'Linear Algebra Lecture 4',
              estimatedDuration: 120,
              role: 'anchor',
              additionOrder: 0,
              userOverrodeType: false,
              kind: 'manual',
              fetchStatus: 'success',
            }],
            playlists: [],
            previewEdits: [],
            stepReached: 3,
            nextAdditionOrder: 1,
          },
        });
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onerror = () => reject(tx.error);
      };
      request.onerror = () => reject(request.error);
    });
  }, dbName);
}

function todayEvents() {
  const now = new Date().toISOString();
  const today = now.slice(0, 10);
  return [
    { kind: 'OnboardingCompleted', payload: {}, createdAt: now },
    {
      kind: 'MaterialAdded',
      payload: {
        materialId: 'mat-1',
        title: 'Linear Algebra Lecture 4',
        estimatedDuration: 120,
        kind: 'manual',
        role: 'anchor',
      },
      createdAt: now,
    },
    {
      kind: 'RoadmapCreated',
      payload: {
        startDate: today,
        deadline: today,
        weeks: 1,
        selectedStudyDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
        weekdayHours: 2,
        weekendHours: 0,
        weeklyHours: 10,
        materialIds: ['mat-1'],
      },
      createdAt: now,
    },
    {
      kind: 'SessionBooked',
      payload: {
        roadmapCreatedAt: now,
        bookingId: 'booking-today',
        date: today,
        estimatedDuration: 50,
      },
      createdAt: now,
    },
  ];
}

function roadmapBookingEvents() {
  const now = new Date().toISOString();
  const today = now.slice(0, 10);
  const deadline = new Date(Date.now() + 21 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  return [
    { kind: 'OnboardingCompleted', payload: {}, createdAt: now },
    {
      kind: 'MaterialAdded',
      payload: {
        materialId: 'mat-1',
        title: 'Linear Algebra Lecture 4',
        estimatedDuration: 120,
        kind: 'manual',
        role: 'anchor',
      },
      createdAt: now,
    },
    {
      kind: 'RoadmapCreated',
      payload: {
        startDate: today,
        deadline,
        weeks: 4,
        selectedStudyDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
        weekdayHours: 2,
        weekendHours: 0,
        weeklyHours: 10,
        materialIds: ['mat-1'],
      },
      createdAt: now,
    },
    {
      kind: 'SessionBooked',
      payload: {
        roadmapCreatedAt: now,
        bookingId: 'booking-editable',
        date: today,
        estimatedDuration: 60,
        materialId: 'mat-1',
      },
      createdAt: now,
    },
  ];
}

test.describe('Material/session decoupling', () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== 'app', 'app project only');
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) test.skip();
  });

  test('Onboarding 3 new-roadmap URL renders booking summary without slot tie UI', async ({ page }) => {
    const email = testEmail('decoupled-onboarding');
    const password = 'TestPassword123!';
    await createTestUser(email, password);
    await signIn(page, email, password);
    await seedOnboardingDraft(page);

    await page.goto(`${APP_URL}/study/onboarding/3?new=1`);
    await expect(page.getByText('Projected finish')).toBeVisible();
    await expect(page.getByText('Your backlog fits your time')).toBeVisible();
    await expect(page.getByText('Linear Algebra Lecture 4').first()).toBeVisible();
    await expect(page.getByText('Pick one')).not.toBeVisible();
    await expect(page.getByText('Rest day')).not.toBeVisible();
  });

  test('Onboarding 3 preview shows study-day tint and booked-style session chip', async ({ page }) => {
    const email = testEmail('decoupled-onboarding-studyday');
    const password = 'TestPassword123!';
    await createTestUser(email, password);
    await signIn(page, email, password);
    await seedOnboardingDraft(page);

    await page.goto(`${APP_URL}/study/onboarding/3?new=1`);
    await page.getByText('Projected finish').click();

    await expect(page.locator('.onboarding-mini-calendar .roadmap-day-studyday').first()).toBeVisible();
    await expect(page.locator('.onboarding-mini-calendar .roadmap-chip-booked').first()).toBeVisible();
    await expect(page.getByText('study day')).toBeVisible();
  });

  test('Home starts at pre-session, then interrupt logs partial progress', async ({ page }) => {
    const email = testEmail('decoupled-session');
    const password = 'TestPassword123!';
    await createTestUser(email, password);
    await signIn(page, email, password);
    await seedEvents(page, todayEvents());

    await page.goto(`${APP_URL}/study/home`);
    await expect(page.getByText(/Suggested material/)).toBeVisible();
    await expect(page.getByText('Linear Algebra Lecture 4')).toBeVisible();

    await page.getByRole('button', { name: 'Start session' }).click();
    await expect(page.getByText('Ready to start')).toBeVisible();
    await page.getByRole('slider', { name: 'Planned session length' }).evaluate((element) => {
      const input = element as HTMLInputElement;
      input.value = '35';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await page.getByRole('button', { name: 'Start session' }).click();
    await expect(page.locator('.session-timer-display')).toBeVisible();

    await page.getByRole('button', { name: 'End session' }).click();
    await page.getByRole('button', { name: '75%' }).click();
    await page.getByRole('button', { name: 'Log session' }).click();

    const logged = await page.evaluate(async () => {
      const dbName = (await indexedDB.databases()).find((db) => db.name?.startsWith('StudyTracker_'))?.name;
      if (!dbName) return null;
      const request = indexedDB.open(dbName);
      return new Promise<Record<string, unknown> | null>((resolve, reject) => {
        request.onsuccess = () => {
          const db = request.result;
          const tx = db.transaction('events', 'readonly');
          const getAll = tx.objectStore('events').getAll();
          getAll.onsuccess = () => {
            const event = getAll.result.find((row: any) => row.kind === 'SessionLogged');
            db.close();
            resolve(event?.payload ?? null);
          };
          getAll.onerror = () => reject(getAll.error);
        };
        request.onerror = () => reject(request.error);
      });
    });

    expect(logged?.resolution).toBe('interrupted');
    expect(logged?.bookingId).toBe('booking-today');
    expect(logged?.materialPosition).toMatchObject({ kind: 'percent', value: 75 });
  });

  test('Continue bypasses pre-session setup when activeSession exists', async ({ page }) => {
    const email = testEmail('decoupled-continue');
    const password = 'TestPassword123!';
    await createTestUser(email, password);
    await signIn(page, email, password);
    await seedEvents(page, [{ kind: 'OnboardingCompleted', payload: {}, createdAt: new Date().toISOString() }]);
    await seedActiveSession(page);

    await page.goto(`${APP_URL}/study/session`);
    await expect(page.getByText('Ready to start')).not.toBeVisible();
    await expect(page.locator('.session-timer-display')).toBeVisible();
  });

  test('Roadmap can add, edit, and remove bookings with booking events', async ({ page }) => {
    const email = testEmail('decoupled-roadmap');
    const password = 'TestPassword123!';
    await createTestUser(email, password);
    await signIn(page, email, password);
    await seedEvents(page, roadmapBookingEvents());

    await page.goto(`${APP_URL}/study/roadmap`);
    await expect(page.getByLabel('Projected finish')).toContainText('provisional');

    // Add a session on an empty day via the radio-list material picker (D21).
    await page.getByRole('button', { name: '+ add session' }).first().click();
    const addDialog = page.getByRole('dialog', { name: 'Add session' });
    await expect(addDialog).toBeVisible();
    await addDialog.getByRole('button', { name: /Attach/ }).click();
    const addPicker = page.getByRole('dialog', { name: 'Choose material' });
    await addPicker.getByRole('button', { name: /Linear Algebra Lecture 4/ }).click();
    await addPicker.getByRole('button', { name: 'Use this material' }).click();
    await addDialog.getByRole('button', { name: 'Increase new session duration' }).click();
    await addDialog.getByRole('button', { name: 'Add session' }).click();

    // Edit the seeded booking: detach the material via the picker + bump the length.
    await page.getByRole('button', { name: /Booked: Linear Algebra Lecture 4, 1h/ }).first().click();
    const editDialog = page.getByRole('dialog', { name: 'Edit booking' });
    await expect(editDialog).toBeVisible();
    await editDialog.getByRole('button', { name: 'Change material' }).click();
    const editPicker = page.getByRole('dialog', { name: 'Choose material' });
    await editPicker.getByRole('button', { name: /No material · pick at start/ }).click();
    await editPicker.getByRole('button', { name: 'Use this material' }).click();
    await editDialog.getByRole('button', { name: 'Increase booking duration' }).click();
    await editDialog.getByRole('button', { name: 'Done' }).click();

    // Remove the now-blank booking.
    await page.getByRole('button', { name: /Booked: Session .*pick at start, 1h 15m/ }).first().click();
    await page.getByRole('dialog', { name: 'Edit booking' }).getByRole('button', { name: 'Remove booking' }).click();

    // Mark material progress from the directory → MaterialProgressMarked (no SessionLogged).
    await page.getByRole('button', { name: 'Mark progress' }).first().click();
    const progressDialog = page.getByRole('dialog', { name: 'Mark material progress' });
    await progressDialog.getByLabel('Material progress percent').evaluate((element) => {
      const input = element as HTMLInputElement;
      input.value = '50';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await progressDialog.getByRole('button', { name: 'Save progress' }).click();

    const events = await readStoredEvents(page);
    expect(events.some((event) => event.kind === 'SessionBooked' && event.payload.bookingId !== 'booking-editable')).toBeTruthy();
    expect(events.some((event) =>
      event.kind === 'BookingEdited' &&
      event.payload.bookingId === 'booking-editable' &&
      event.payload.materialId === null &&
      event.payload.estimatedDuration === 75,
    )).toBeTruthy();
    expect(events.some((event) =>
      event.kind === 'BookingCleared' &&
      event.payload.bookingId === 'booking-editable',
    )).toBeTruthy();
    expect(events.some((event) =>
      event.kind === 'MaterialProgressMarked' &&
      event.payload.materialId === 'mat-1' &&
      event.payload.source === 'directory',
    )).toBeTruthy();
    expect(events.some((event) => event.kind === 'SessionLogged')).toBeFalsy();
  });

  test('Roadmap compact calendar can add a booking from an empty day sheet', async ({ page }) => {
    const email = testEmail('decoupled-roadmap-compact-add');
    const password = 'TestPassword123!';
    await createTestUser(email, password);
    await signIn(page, email, password);
    await seedEvents(page, roadmapBookingEvents());
    await page.setViewportSize({ width: 390, height: 844 });

    await page.goto(`${APP_URL}/study/roadmap`);
    await page
      .locator('.roadmap-day-in-month .roadmap-mobile-day-button[aria-label*="day options"]')
      .first()
      .click();
    await expect(page.getByRole('dialog', { name: 'Roadmap day sheet' })).toBeVisible();
    await page.getByRole('button', { name: '+ Add session' }).click();

    const addDialog = page.getByRole('dialog', { name: 'Add session' });
    await expect(addDialog).toBeVisible();
    await addDialog.getByRole('button', { name: 'Add session' }).click();

    const events = await readStoredEvents(page);
    expect(events.some((event) =>
      event.kind === 'SessionBooked' &&
      event.payload.bookingId !== 'booking-editable' &&
      typeof event.payload.date === 'string',
    )).toBeTruthy();
  });

  test('Replan levers UI: extend deadline → emit RoadmapReplanned with no slots + BookingCleared + SessionBooked', async ({ page }) => {
    const email = testEmail('decoupled-replan');
    const password = 'TestPassword123!';
    await createTestUser(email, password);
    await signIn(page, email, password);
    await seedEvents(page, todayEvents());

    // Navigate to /replan
    await page.goto(`${APP_URL}/study/replan`);
    await expect(page.getByText('Adjust your plan')).toBeVisible();
    await expect(page.getByText('Extend the deadline')).toBeVisible();

    // Select +1 week deadline extension preset
    await page.getByRole('button', { name: '+1 week' }).click();
    await expect(page.getByRole('button', { name: '+1 week' })).toHaveAttribute('aria-pressed', 'true');

    // The outcome panel should show a new finish date
    const outcomeLive = page.locator('.rp-big');
    await expect(outcomeLive).not.toBeEmpty();

    // Apply the changes
    await page.getByRole('button', { name: 'Apply changes' }).click();
    await page.waitForURL(/\/study\/roadmap/, { timeout: 10000 });

    // Verify the emitted events
    const events = await readStoredEvents(page);
    // RoadmapReplanned with no slots and updated deadline
    const replanEvent = events.find((e) => e.kind === 'RoadmapReplanned');
    expect(replanEvent).toBeDefined();
    expect(replanEvent!.payload.slots).toBeUndefined();
    expect(typeof replanEvent!.payload.deadline).toBe('string');
    // BookingCleared for old future bookings
    expect(events.some((e) => e.kind === 'BookingCleared')).toBeTruthy();
    // SessionBooked for new bookings
    expect(events.some((e) => e.kind === 'SessionBooked' && e.payload.roadmapCreatedAt === replanEvent!.payload.roadmapCreatedAt)).toBeTruthy();
  });

  test('Replan Keep current navigates back without emitting events', async ({ page }) => {
    const email = testEmail('decoupled-replan-keep');
    const password = 'TestPassword123!';
    await createTestUser(email, password);
    await signIn(page, email, password);
    await seedEvents(page, todayEvents());

    await page.goto(`${APP_URL}/study/replan`);
    await expect(page.getByText('Adjust your plan')).toBeVisible();

    const eventsBefore = await readStoredEvents(page);
    await page.getByRole('button', { name: 'Keep current' }).click();
    await page.waitForURL(/\/study\/roadmap/, { timeout: 10000 });

    const eventsAfter = await readStoredEvents(page);
    // No new events were emitted
    expect(eventsAfter.length).toBe(eventsBefore.length);
  });
});
