import { db } from "../firebase";
import { doc, updateDoc } from "firebase/firestore";

export type RetentionPeriod = '30_DAYS' | '90_DAYS' | '1_YEAR' | 'FOREVER';

export class DataRetentionRepository {
  static async updateRetentionPolicy(familyId: string, period: RetentionPeriod): Promise<void> {
    if (!db || !familyId) return;
    const ref = doc(db, "families", familyId);
    await updateDoc(ref, { "settings.dataRetention": period });
  }
}
