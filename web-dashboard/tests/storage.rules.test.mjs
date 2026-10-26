import test, { after, before } from 'node:test';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment
} from '@firebase/rules-unit-testing';
import { doc, setDoc } from 'firebase/firestore';
import { getBytes, listAll, ref, uploadBytes } from 'firebase/storage';
import { readFileSync } from 'node:fs';

const PROJECT_ID = 'kidsguard-rules-test';
const ACTIVE_AUTH_TIME = Math.floor(Date.now() / 1000);
let testEnv;

const verifiedContext = (uid, email) => testEnv.authenticatedContext(uid, {
  email,
  email_verified: true,
  auth_time: ACTIVE_AUTH_TIME
});

const verifiedAdminContext = (uid, email) => testEnv.authenticatedContext(uid, {
  email,
  email_verified: true,
  auth_time: ACTIVE_AUTH_TIME,
  firebase: {
    sign_in_second_factor: 'totp'
  }
});

before(async () => {
  const firestoreRules = readFileSync(
    new URL('../../firestore.rules.production', import.meta.url),
    'utf8'
  );
  const storageRules = readFileSync(
    new URL('../../storage.rules', import.meta.url),
    'utf8'
  );

  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      host: '127.0.0.1',
      port: 8085,
      rules: firestoreRules
    },
    storage: {
      host: '127.0.0.1',
      port: 9199,
      rules: storageRules
    }
  });

  await testEnv.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await setDoc(doc(db, 'supportTickets', 'TICKET01'), {
      ticketId: 'TICKET01',
      parentUid: 'parent-uid',
      parentEmail: 'parent@example.com',
      status: 'OPEN'
    });
    await setDoc(doc(db, 'platformAdmins', 'admin-uid'), {
      uid: 'admin-uid',
      email: 'admin@example.com',
      role: 'PLATFORM_ADMIN',
      active: true
    });
    await setDoc(doc(db, 'platformAdmins', 'employee-uid'), {
      uid: 'employee-uid',
      email: 'employee@example.com',
      role: 'EMPLOYEE',
      active: true
    });
    await setDoc(doc(db, 'platformAdmins', 'accounting-uid'), {
      uid: 'accounting-uid',
      email: 'accounting@example.com',
      role: 'ACCOUNTING',
      active: true
    });
    for (const [uid, email, role] of [
      ['admin-uid', 'admin@example.com', 'PLATFORM_ADMIN'],
      ['employee-uid', 'employee@example.com', 'EMPLOYEE'],
      ['accounting-uid', 'accounting@example.com', 'ACCOUNTING']
    ]) {
      await setDoc(doc(db, 'internalAdminSessions', uid), {
        uid,
        email,
        role,
        sessionId: `session-${uid}`,
        state: 'ACTIVE',
        authTime: ACTIVE_AUTH_TIME,
        expiresAt: new Date(ACTIVE_AUTH_TIME * 1000 + 8 * 60 * 60 * 1000)
      });
    }
  });
});

after(async () => {
  await testEnv?.cleanup();
});

test('ticket owner can upload a valid screenshot', async () => {
  const storage = verifiedContext(
    'parent-uid',
    'parent@example.com'
  ).storage();
  const attachment = ref(
    storage,
    'supportTickets/parent-uid/TICKET01/screenshot.png'
  );

  await assertSucceeds(uploadBytes(
    attachment,
    new Uint8Array([1, 2, 3]),
    { contentType: 'image/png' }
  ));
});

test('ticket owner cannot upload executable content', async () => {
  const storage = verifiedContext(
    'parent-uid',
    'parent@example.com'
  ).storage();
  const attachment = ref(
    storage,
    'supportTickets/parent-uid/TICKET01/payload.exe'
  );

  await assertFails(uploadBytes(
    attachment,
    new Uint8Array([1, 2, 3]),
    { contentType: 'application/octet-stream' }
  ));
});

test('outsider cannot read a support attachment', async () => {
  const storage = verifiedContext(
    'outsider-uid',
    'outsider@example.com'
  ).storage();
  const attachment = ref(
    storage,
    'supportTickets/parent-uid/TICKET01/screenshot.png'
  );

  await assertFails(getBytes(attachment));
});

test('active platform admin can read a support attachment', async () => {
  const storage = verifiedAdminContext(
    'admin-uid',
    'admin@example.com'
  ).storage();
  const attachment = ref(
    storage,
    'supportTickets/parent-uid/TICKET01/screenshot.png'
  );

  await assertSucceeds(getBytes(attachment));
  await assertSucceeds(listAll(ref(
    storage,
    'supportTickets/parent-uid/TICKET01'
  )));
});

test('platform admin without TOTP cannot read a support attachment', async () => {
  const storage = verifiedContext(
    'admin-uid',
    'admin@example.com'
  ).storage();
  const attachment = ref(
    storage,
    'supportTickets/parent-uid/TICKET01/screenshot.png'
  );

  await assertFails(getBytes(attachment));
});

test('platform admin with a stale session cannot read a support attachment', async () => {
  const storage = testEnv.authenticatedContext('admin-uid', {
    email: 'admin@example.com',
    email_verified: true,
    auth_time: ACTIVE_AUTH_TIME + 1,
    firebase: {sign_in_second_factor: 'totp'}
  }).storage();
  const attachment = ref(
    storage,
    'supportTickets/parent-uid/TICKET01/screenshot.png'
  );

  await assertFails(getBytes(attachment));
});

test('employee without TOTP can read support attachments', async () => {
  const storage = verifiedContext(
    'employee-uid',
    'employee@example.com'
  ).storage();
  const attachment = ref(
    storage,
    'supportTickets/parent-uid/TICKET01/screenshot.png'
  );

  await assertSucceeds(getBytes(attachment));
});

test('accounting role cannot read support attachments', async () => {
  const storage = verifiedAdminContext(
    'accounting-uid',
    'accounting@example.com'
  ).storage();
  const attachment = ref(
    storage,
    'supportTickets/parent-uid/TICKET01/screenshot.png'
  );

  await assertFails(getBytes(attachment));
});

test('ticket owner can list their own attachments', async () => {
  const storage = verifiedContext(
    'parent-uid',
    'parent@example.com'
  ).storage();

  await assertSucceeds(listAll(ref(
    storage,
    'supportTickets/parent-uid/TICKET01'
  )));
});
