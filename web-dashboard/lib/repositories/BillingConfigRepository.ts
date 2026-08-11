import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";

export interface BillingConfig {
  baseChildSlots: number;
  basePriceCents: number;
  extraChildPriceCents: number;
  trialDays: number;
  currency: "EUR";
  billingInterval: "MONTHLY";
  enabled: boolean;
}

export class BillingConfigRepository {
  static async getConfig(): Promise<BillingConfig | null> {
    if (!db) return null;

    const ref = doc(db, "billingConfig", "current");
    const snap = await getDoc(ref);

    if (!snap.exists()) return null;

    return snap.data() as BillingConfig;
  }

  static listenToConfig(
    onUpdate: (config: BillingConfig | null) => void
  ) {
    if (!db) return () => {};

    const ref = doc(db, "billingConfig", "current");

    return onSnapshot(
      ref,
      (snap) => {
        onUpdate(
          snap.exists()
            ? (snap.data() as BillingConfig)
            : null
        );
      },
      (error) => {
        console.error(
          "Error listening to billing config:",
          error
        );
        onUpdate(null);
      }
    );
  }

  static calculateMonthlyPriceCents(
    childCount: number,
    config: BillingConfig
  ): number {
    const extraChildren = Math.max(
      0,
      childCount - config.baseChildSlots
    );

    return (
      config.basePriceCents +
      extraChildren * config.extraChildPriceCents
    );
  }
}