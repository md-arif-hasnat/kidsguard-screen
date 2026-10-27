import {GoogleAuth} from 'google-auth-library';

const ANDROID_PUBLISHER_SCOPE =
  'https://www.googleapis.com/auth/androidpublisher';

export type GooglePlaySubscriptionState =
  | 'SUBSCRIPTION_STATE_UNSPECIFIED'
  | 'SUBSCRIPTION_STATE_PENDING'
  | 'SUBSCRIPTION_STATE_ACTIVE'
  | 'SUBSCRIPTION_STATE_PAUSED'
  | 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD'
  | 'SUBSCRIPTION_STATE_ON_HOLD'
  | 'SUBSCRIPTION_STATE_CANCELED'
  | 'SUBSCRIPTION_STATE_EXPIRED'
  | 'SUBSCRIPTION_STATE_PENDING_PURCHASE_CANCELED';

export type GooglePlaySubscriptionPurchase = {
  startTime?: string;
  regionCode?: string;
  subscriptionState?: GooglePlaySubscriptionState;
  latestOrderId?: string;
  linkedPurchaseToken?: string;
  acknowledgementState?:
    | 'ACKNOWLEDGEMENT_STATE_UNSPECIFIED'
    | 'ACKNOWLEDGEMENT_STATE_PENDING'
    | 'ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED';
  testPurchase?: Record<string, never>;
  externalAccountIdentifiers?: {
    obfuscatedExternalAccountId?: string;
    obfuscatedExternalProfileId?: string;
  };
  lineItems?: Array<{
    productId?: string;
    expiryTime?: string;
    autoRenewingPlan?: {
      autoRenewEnabled?: boolean;
    };
    offerDetails?: {
      basePlanId?: string;
      offerId?: string;
      offerTags?: string[];
    };
  }>;
};

export type GooglePlayEntitlement = {
  providerStatus: GooglePlaySubscriptionState;
  status: 'PENDING' | 'ACTIVE' | 'PAST_DUE' | 'PAUSED' | 'CANCELED';
  entitlementActive: boolean;
  productId: string;
  basePlanId: string | null;
  offerId: string | null;
  billingInterval: 'MONTHLY' | 'YEARLY' | null;
  currentPeriodEndsAtMillis: number;
  cancelAtPeriodEnd: boolean;
  acknowledgementPending: boolean;
  latestOrderId: string | null;
  regionCode: string | null;
  testPurchase: boolean;
};

export class GooglePlayPublisherClient {
  private readonly auth = new GoogleAuth({
    scopes: [ANDROID_PUBLISHER_SCOPE]
  });

  constructor(private readonly packageName: string) {}

  async getSubscription(
    purchaseToken: string
  ): Promise<GooglePlaySubscriptionPurchase> {
    const client = await this.auth.getClient();
    const url =
      'https://androidpublisher.googleapis.com/androidpublisher/v3/' +
      `applications/${encodeURIComponent(this.packageName)}/` +
      'purchases/subscriptionsv2/tokens/' +
      encodeURIComponent(purchaseToken);
    const response = await client.request<GooglePlaySubscriptionPurchase>({
      url,
      method: 'GET'
    });
    return response.data;
  }

  async acknowledgeSubscription(
    productId: string,
    purchaseToken: string
  ): Promise<void> {
    const client = await this.auth.getClient();
    const url =
      'https://androidpublisher.googleapis.com/androidpublisher/v3/' +
      `applications/${encodeURIComponent(this.packageName)}/` +
      `purchases/subscriptions/${encodeURIComponent(productId)}/` +
      `tokens/${encodeURIComponent(purchaseToken)}:acknowledge`;
    await client.request({
      url,
      method: 'POST',
      data: {}
    });
  }
}

export function resolveGooglePlayEntitlement(
  purchase: GooglePlaySubscriptionPurchase,
  expectedProductId: string,
  nowMillis = Date.now()
): GooglePlayEntitlement {
  const lineItems = Array.isArray(purchase.lineItems)
    ? purchase.lineItems.filter((lineItem) =>
      lineItem.productId === expectedProductId
    )
    : [];
  if (lineItems.length === 0) {
    throw new Error('GOOGLE_PLAY_PRODUCT_MISMATCH');
  }

  const selectedLineItem = lineItems
    .map((lineItem) => ({
      lineItem,
      expiryMillis: Date.parse(lineItem.expiryTime || '')
    }))
    .filter((item) => Number.isFinite(item.expiryMillis))
    .sort((first, second) => second.expiryMillis - first.expiryMillis)[0];
  if (!selectedLineItem) {
    throw new Error('GOOGLE_PLAY_EXPIRY_MISSING');
  }

  const state = purchase.subscriptionState ||
    'SUBSCRIPTION_STATE_UNSPECIFIED';
  const notExpired = selectedLineItem.expiryMillis > nowMillis;
  const entitlementActive = notExpired && [
    'SUBSCRIPTION_STATE_ACTIVE',
    'SUBSCRIPTION_STATE_IN_GRACE_PERIOD',
    'SUBSCRIPTION_STATE_CANCELED'
  ].includes(state);
  const status = applicationStatus(state, entitlementActive);
  const basePlanId =
    selectedLineItem.lineItem.offerDetails?.basePlanId || null;
  const autoRenewEnabled =
    selectedLineItem.lineItem.autoRenewingPlan?.autoRenewEnabled === true;

  return {
    providerStatus: state,
    status,
    entitlementActive,
    productId: expectedProductId,
    basePlanId,
    offerId: selectedLineItem.lineItem.offerDetails?.offerId || null,
    billingInterval:
      basePlanId === 'monthly'
        ? 'MONTHLY'
        : basePlanId === 'annual'
          ? 'YEARLY'
          : null,
    currentPeriodEndsAtMillis: selectedLineItem.expiryMillis,
    cancelAtPeriodEnd:
      state === 'SUBSCRIPTION_STATE_CANCELED' || !autoRenewEnabled,
    acknowledgementPending:
      purchase.acknowledgementState === 'ACKNOWLEDGEMENT_STATE_PENDING',
    latestOrderId: purchase.latestOrderId || null,
    regionCode: purchase.regionCode || null,
    testPurchase: purchase.testPurchase != null
  };
}

function applicationStatus(
  state: GooglePlaySubscriptionState,
  entitlementActive: boolean
): GooglePlayEntitlement['status'] {
  if (entitlementActive && state === 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD') {
    return 'PAST_DUE';
  }
  if (entitlementActive) return 'ACTIVE';
  if (state === 'SUBSCRIPTION_STATE_PENDING') return 'PENDING';
  if (state === 'SUBSCRIPTION_STATE_ON_HOLD' ||
      state === 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD') {
    return 'PAST_DUE';
  }
  if (state === 'SUBSCRIPTION_STATE_PAUSED') return 'PAUSED';
  return 'CANCELED';
}
