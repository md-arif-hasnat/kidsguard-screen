const assert = require('node:assert/strict');
const test = require('node:test');

const {
  resolveGooglePlayEntitlement,
} = require('../lib/googlePlayBilling.js');

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.parse('2026-10-27T00:00:00.000Z');

function purchase(overrides = {}) {
  return {
    subscriptionState: 'SUBSCRIPTION_STATE_ACTIVE',
    acknowledgementState: 'ACKNOWLEDGEMENT_STATE_PENDING',
    latestOrderId: 'GPA.1234-5678-9012-34567',
    regionCode: 'DE',
    lineItems: [{
      productId: 'kidsguard_family',
      expiryTime: new Date(NOW + 30 * DAY).toISOString(),
      autoRenewingPlan: {autoRenewEnabled: true},
      offerDetails: {basePlanId: 'monthly', offerId: 'trial-7-days'},
    }],
    ...overrides,
  };
}

test('active monthly purchase grants an acknowledged backend entitlement', () => {
  const entitlement = resolveGooglePlayEntitlement(
    purchase(),
    'kidsguard_family',
    NOW
  );

  assert.equal(entitlement.status, 'ACTIVE');
  assert.equal(entitlement.entitlementActive, true);
  assert.equal(entitlement.billingInterval, 'MONTHLY');
  assert.equal(entitlement.basePlanId, 'monthly');
  assert.equal(entitlement.acknowledgementPending, true);
  assert.equal(entitlement.cancelAtPeriodEnd, false);
});

test('canceled auto-renewal keeps access until the paid period ends', () => {
  const entitlement = resolveGooglePlayEntitlement(
    purchase({
      subscriptionState: 'SUBSCRIPTION_STATE_CANCELED',
      lineItems: [{
        productId: 'kidsguard_family',
        expiryTime: new Date(NOW + 10 * DAY).toISOString(),
        autoRenewingPlan: {autoRenewEnabled: false},
        offerDetails: {basePlanId: 'annual'},
      }],
    }),
    'kidsguard_family',
    NOW
  );

  assert.equal(entitlement.status, 'ACTIVE');
  assert.equal(entitlement.entitlementActive, true);
  assert.equal(entitlement.billingInterval, 'YEARLY');
  assert.equal(entitlement.cancelAtPeriodEnd, true);
});

test('grace period retains access but reports past due', () => {
  const entitlement = resolveGooglePlayEntitlement(
    purchase({subscriptionState: 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD'}),
    'kidsguard_family',
    NOW
  );

  assert.equal(entitlement.status, 'PAST_DUE');
  assert.equal(entitlement.entitlementActive, true);
});

test('expired purchase does not grant access', () => {
  const entitlement = resolveGooglePlayEntitlement(
    purchase({
      subscriptionState: 'SUBSCRIPTION_STATE_EXPIRED',
      lineItems: [{
        productId: 'kidsguard_family',
        expiryTime: new Date(NOW - DAY).toISOString(),
        autoRenewingPlan: {autoRenewEnabled: false},
        offerDetails: {basePlanId: 'monthly'},
      }],
    }),
    'kidsguard_family',
    NOW
  );

  assert.equal(entitlement.status, 'CANCELED');
  assert.equal(entitlement.entitlementActive, false);
});

test('a token for another product is rejected', () => {
  assert.throws(
    () => resolveGooglePlayEntitlement(
      purchase({
        lineItems: [{
          productId: 'another_product',
          expiryTime: new Date(NOW + DAY).toISOString(),
        }],
      }),
      'kidsguard_family',
      NOW
    ),
    /GOOGLE_PLAY_PRODUCT_MISMATCH/
  );
});
