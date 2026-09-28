const test = require('node:test');
const assert = require('node:assert/strict');

process.env.GCLOUD_PROJECT = 'kidsguard-retention-test';
process.env.FIREBASE_CONFIG = JSON.stringify({
  projectId: 'kidsguard-retention-test',
  storageBucket: 'kidsguard-retention-test.appspot.com'
});

const admin = require('firebase-admin');
const {
  cleanupFamilyRetentionData
} = require('../lib/index.js');

const db = admin.firestore();

test('retention cleanup deletes only expired history', async () => {
  const now = Date.now();
  const oldMillis = now - 60 * 24 * 60 * 60 * 1000;
  const recentMillis = now - 2 * 24 * 60 * 60 * 1000;
  const familyId = 'retention-family';
  const childId = 'retention-child';

  await db.collection('families').doc(familyId).set({
    ownerId: 'retention-owner',
    childDeviceIds: [childId],
    settings: { dataRetentionDays: 30 }
  });
  await db.collection('children').doc(childId).set({
    familyId
  });

  const locations = db
    .collection('children')
    .doc(childId)
    .collection('locations');
  await locations.doc('old').set({ timestamp: oldMillis });
  await locations.doc('recent').set({ timestamp: recentMillis });
  await locations.doc('latest').set({ timestamp: oldMillis });

  const restrictions = db
    .collection('children')
    .doc(childId)
    .collection('appRestrictionEvents');
  await restrictions.doc('old').set({
    occurredAt: admin.firestore.Timestamp.fromMillis(oldMillis)
  });
  await restrictions.doc('recent').set({
    occurredAt: admin.firestore.Timestamp.fromMillis(recentMillis)
  });

  const appUsageOld = db
    .collection('children')
    .doc(childId)
    .collection('appUsage')
    .doc('2020-01-01');
  await appUsageOld.set({ date: '2020-01-01' });
  await appUsageOld.collection('apps').doc('example').set({
    totalTimeMs: 100
  });

  const youtube = db
    .collection('families')
    .doc(familyId)
    .collection('children')
    .doc(childId)
    .collection('youtubeHistory');
  await youtube.doc('old').set({ capturedAt: oldMillis });
  await youtube.doc('recent').set({ capturedAt: recentMillis });

  await cleanupFamilyRetentionData.run({
    scheduleTime: new Date().toISOString()
  });

  assert.equal((await locations.doc('old').get()).exists, false);
  assert.equal((await locations.doc('recent').get()).exists, true);
  assert.equal((await locations.doc('latest').get()).exists, true);
  assert.equal((await restrictions.doc('old').get()).exists, false);
  assert.equal((await restrictions.doc('recent').get()).exists, true);
  assert.equal((await appUsageOld.get()).exists, false);
  assert.equal(
    (await appUsageOld.collection('apps').doc('example').get()).exists,
    false
  );
  assert.equal((await youtube.doc('old').get()).exists, false);
  assert.equal((await youtube.doc('recent').get()).exists, true);
});
