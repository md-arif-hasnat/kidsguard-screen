import { auth, db } from "../firebase";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  Unsubscribe,
} from "firebase/firestore";

export type PromoCodeType =
  | "FREE_LIMITED"
  | "FREE_FOREVER"
  | "PERCENTAGE";

export type PromoCodeStatus = "ACTIVE" | "INACTIVE" | "DELETED";

export interface PromoCode {
  code: string;
  type: PromoCodeType;
  status: PromoCodeStatus;
  description?: string | null;
  percentage?: number | null;
  accessDays?: number | null;
  expiresAt?: unknown;
  usageLimit?: number | null;
  redemptionCount: number;
  recurringIntervals?: number | null;
  paddleDiscountId?: string | null;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface CreatePromoCodeInput {
  code: string;
  type: PromoCodeType;
  description?: string;
  percentage?: number;
  accessDays?: number;
  expiresAt?: string | null;
  usageLimit?: number | null;
  recurringIntervals?: number | null;
}

export type PromoRedemptionResult =
  | {
      success: true;
      kind: "PERCENTAGE";
      code: string;
      percentage: number;
      paddleDiscountId: string;
      recurringIntervals: number | null;
    }
  | {
      success: true;
      kind: "FREE";
      code: string;
      type: "FREE_LIMITED" | "FREE_FOREVER";
      accessEndsAt: number | null;
    };

async function callFunction<T>(
  functionName: string,
  data: Record<string, unknown>
): Promise<T> {
  const currentUser = auth?.currentUser;
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!currentUser || !projectId) {
    throw new Error("Please sign in again.");
  }

  const idToken = await currentUser.getIdToken(true);
  const response = await fetch(
    `https://us-central1-${projectId}.cloudfunctions.net/${functionName}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({ data }),
    }
  );
  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.error) {
    throw new Error(
      payload?.error?.message || "The secure coupon request failed."
    );
  }
  return payload.result as T;
}

export class PromoCodeRepository {
  static subscribe(
    callback: (codes: PromoCode[]) => void,
    onError: (error: Error) => void
  ): Unsubscribe {
    if (!db) {
      onError(new Error("Firestore is not configured."));
      return () => undefined;
    }

    return onSnapshot(
      query(collection(db, "promoCodes"), orderBy("createdAt", "desc")),
      (snapshot) => {
        callback(
          snapshot.docs.map((document) => ({
            ...(document.data() as Omit<PromoCode, "code">),
            code: document.id,
            redemptionCount: Number(document.data().redemptionCount || 0),
          }))
        );
      },
      (error) => onError(error)
    );
  }

  static create(input: CreatePromoCodeInput): Promise<{ success: boolean }> {
    return callFunction("createPromoCode", input as unknown as Record<string, unknown>);
  }

  static setStatus(
    code: string,
    status: PromoCodeStatus
  ): Promise<{ success: boolean; revokedAccessCount: number }> {
    return callFunction("setPromoCodeStatus", { code, status });
  }

  static redeem(code: string): Promise<PromoRedemptionResult> {
    return callFunction("redeemPromoCode", { code });
  }

  static sendEmail(code: string, email: string): Promise<{ success: boolean }> {
    return callFunction("sendPromoCodeEmail", { code, email });
  }
}
