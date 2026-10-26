import { db } from "../firebase";
import { doc, getDoc, setDoc, serverTimestamp, onSnapshot, Timestamp, query, collection, orderBy, limit, getDocs, runTransaction, deleteField } from "firebase/firestore";
import { AuditRepository, AuditAction, AuditSeverity } from "./AuditRepository";

export interface ParentProfile {
  uid: string;
  email: string | null;
  phoneNumber: string | null;
  displayName: string | null;
  avatarId?: string;
  provider: string;
  familyId: string | null;
  familyIds?: string[];
  activeFamilyId?: string | null;
  ownedFamilyId?: string | null;
  role?: string; // Optional cached role
  region?: 'DE' | 'BD' | 'US' | 'Global';
  preferredLanguage?: 'auto' | 'en' | 'de' | 'es' | 'ar' | 'tr';
  resolvedLanguage?: 'en' | 'de' | 'es' | 'ar' | 'tr';
  lastActiveDate?: string; // Phase AQ (YYYY-MM-DD)
  createdAt: any;
  lastLoginAt: any;
  legalConsentAcceptedAt?: any;
  termsVersion?: string;
  privacyVersion?: string;
  adultConfirmedAt?: any;
  subscriptionStatus?: 'NONE' | 'TRIALING' | 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'EXPIRED';
  trialStartedAt?: any;
  trialEndsAt?: any;
  planId?: string;
  basePriceCents?: number;
  includedChildren?: number;
  extraChildPriceCents?: number;
  currency?: 'EUR';
  emailChangeRequestedAt?: Timestamp;
  emailChangeRequestToken?: string;
}

export const OWNER_EMAIL_CHANGE_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

export type OwnerEmailChangeCooldownError = Error & {
  code: "email-change/cooldown";
  nextAllowedAt: Date;
};

export class ParentRepository {
  private static timestampMillis(value: unknown): number | null {
    if (
      value &&
      typeof (value as { toMillis?: unknown }).toMillis === "function"
    ) {
      return (value as { toMillis: () => number }).toMillis();
    }

    return null;
  }

  static getNextOwnerEmailChangeAt(
    requestedAt: unknown,
    now: number = Date.now()
  ): Date | null {
    const requestedAtMillis = this.timestampMillis(requestedAt);
    if (requestedAtMillis === null) return null;

    const nextAllowedAtMillis =
      requestedAtMillis + OWNER_EMAIL_CHANGE_COOLDOWN_MS;

    return nextAllowedAtMillis > now
      ? new Date(nextAllowedAtMillis)
      : null;
  }

  private static cooldownError(nextAllowedAt: Date): OwnerEmailChangeCooldownError {
    return Object.assign(
      new Error("Your next email change is not available yet."),
      {
        code: "email-change/cooldown" as const,
        nextAllowedAt
      }
    );
  }

  static async assertOwnerEmailChangeAllowed(
    uid: string,
    familyId: string
  ): Promise<void> {
    if (!db) throw new Error("Firestore is unavailable.");

    const [parentSnapshot, familySnapshot] = await Promise.all([
      getDoc(doc(db, "parents", uid)),
      getDoc(doc(db, "families", familyId))
    ]);

    if (!familySnapshot.exists() || familySnapshot.data().ownerId !== uid) {
      throw new Error("Only the family owner can change the login email.");
    }

    const nextAllowedAt = this.getNextOwnerEmailChangeAt(
      parentSnapshot.data()?.emailChangeRequestedAt
    );
    if (nextAllowedAt) {
      throw this.cooldownError(nextAllowedAt);
    }
  }

  static async reserveOwnerEmailChangeRequest(
    uid: string,
    familyId: string
  ): Promise<string> {
    if (!db) throw new Error("Firestore is unavailable.");

    const firestore = db;
    const requestToken = globalThis.crypto.randomUUID();
    await runTransaction(firestore, async (transaction) => {
      const parentRef = doc(firestore, "parents", uid);
      const familyRef = doc(firestore, "families", familyId);
      const [parentSnapshot, familySnapshot] = await Promise.all([
        transaction.get(parentRef),
        transaction.get(familyRef)
      ]);

      if (!familySnapshot.exists() || familySnapshot.data().ownerId !== uid) {
        throw new Error("Only the family owner can change the login email.");
      }

      const nextAllowedAt = this.getNextOwnerEmailChangeAt(
        parentSnapshot.data()?.emailChangeRequestedAt
      );
      if (nextAllowedAt) {
        throw this.cooldownError(nextAllowedAt);
      }

      transaction.set(
        parentRef,
        {
          emailChangeRequestedAt: serverTimestamp(),
          emailChangeRequestToken: requestToken
        },
        { merge: true }
      );
    });

    return requestToken;
  }

  static async completeOwnerEmailChangeRequest(
    uid: string,
    requestToken: string
  ): Promise<void> {
    if (!db) throw new Error("Firestore is unavailable.");

    const firestore = db;
    await runTransaction(firestore, async (transaction) => {
      const parentRef = doc(firestore, "parents", uid);
      const parentSnapshot = await transaction.get(parentRef);
      if (
        !parentSnapshot.exists() ||
        parentSnapshot.data().emailChangeRequestToken !== requestToken
      ) {
        return;
      }

      transaction.update(parentRef, {
        emailChangeRequestToken: deleteField()
      });
    });
  }

  static async cancelOwnerEmailChangeRequest(
    uid: string,
    requestToken: string
  ): Promise<void> {
    if (!db) return;

    const firestore = db;
    await runTransaction(firestore, async (transaction) => {
      const parentRef = doc(firestore, "parents", uid);
      const parentSnapshot = await transaction.get(parentRef);
      if (
        !parentSnapshot.exists() ||
        parentSnapshot.data().emailChangeRequestToken !== requestToken
      ) {
        return;
      }

      transaction.update(parentRef, {
        emailChangeRequestedAt: deleteField(),
        emailChangeRequestToken: deleteField()
      });
    });
  }

  private static async syncOwnerMemberEmail(
    profile: ParentProfile,
    email: string
  ): Promise<void> {
    if (!db) return;

    const firestore = db;
    const normalizedEmail = email.trim().toLowerCase();
    const familyIds = Array.from(new Set([
      profile.ownedFamilyId,
      profile.activeFamilyId,
      profile.familyId,
      ...(profile.familyIds || [])
    ].filter((familyId): familyId is string => Boolean(familyId))));

    for (const familyId of familyIds) {
      await runTransaction(firestore, async (transaction) => {
        const familyRef = doc(firestore, "families", familyId);
        const familySnapshot = await transaction.get(familyRef);

        if (!familySnapshot.exists()) return;

        const family = familySnapshot.data();
        if (family.ownerId !== profile.uid || !Array.isArray(family.members)) {
          return;
        }

        let changed = false;
        const members = family.members.map((member: any) => {
          if (
            member?.uid !== profile.uid ||
            String(member.email || "").trim().toLowerCase() === normalizedEmail
          ) {
            return member;
          }

          changed = true;
          return { ...member, email: normalizedEmail };
        });

        if (changed) {
          transaction.update(familyRef, {
            members,
            updatedAt: serverTimestamp()
          });
        }
      });
    }
  }

  static async getProfile(uid: string): Promise<ParentProfile | null> {
    if (!db) return null;
    const ref = doc(db, "parents", uid);
    const snap = await getDoc(ref);
    return snap.exists() ? snap.data() as ParentProfile : null;
  }

  static listenToProfile(uid: string, onUpdate: (profile: ParentProfile | null) => void) {
    if (!db || !uid) return () => {};
    const ref = doc(db, "parents", uid);
    return onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        onUpdate(snap.data() as ParentProfile);
      } else {
        onUpdate(null);
      }
    }, (error) => {
      console.error("Error listening to parent profile:", error);
      onUpdate(null);
    });
  }

  static async createOrUpdateProfile(user: any, provider: string): Promise<ParentProfile> {
    if (!db) throw new Error("Firestore not initialized");

    const existing = await this.getProfile(user.uid);

    const today = new Date().toISOString().split('T')[0];

    const profile: Partial<ParentProfile> = {
      uid: user.uid,
      email: user.email || (existing?.email || null),
      phoneNumber: user.phoneNumber || (existing?.phoneNumber || null),
      displayName: user.displayName || (existing?.displayName || "Parent"),
      avatarId: existing?.avatarId || "parent_1",
      provider: provider,
      lastLoginAt: serverTimestamp(),
      lastActiveDate: today // Phase AQ
    };

    if (existing?.role) {
      profile.role = existing.role;
    }
    // Note: If they have a familyId but no role, we leave it out of this setDoc
    // to avoid writing 'undefined' and let RoleHelper resolve it from family members.

    if (!existing) {
      profile.createdAt = serverTimestamp();
      profile.familyId = null;
      profile.familyIds = [];
      profile.activeFamilyId = null;
      profile.ownedFamilyId = null;
      profile.region = 'DE'; // Default region for new users
    }

    await setDoc(doc(db, "parents", user.uid), profile, { merge: true });

    const updated = await this.getProfile(user.uid);

    if (updated && user.email) {
      try {
        await this.syncOwnerMemberEmail(updated, user.email);
      } catch (error) {
        // The verified Firebase identity remains authoritative. A temporary
        // metadata sync failure must never block a successful sign-in.
        console.warn("Could not sync the verified owner email to family metadata:", error);
      }
    }

    if (updated?.familyId) {
      await AuditRepository.log({
        familyId: updated.familyId,
        actorUid: user.uid,
        actorEmail: updated.email || "unknown",
        action: AuditAction.LOGIN,
        targetType: 'SECURITY',
        targetId: user.uid,
        severity: AuditSeverity.INFO,
        metadata: { provider }
      });
    }

    return updated!;
  }

  static async updateFamilyId(uid: string, familyId: string): Promise<void> {
    if (!db) return;
    await setDoc(doc(db, "parents", uid), { familyId }, { merge: true });
  }

  static async updateProfile(uid: string, updates: Partial<ParentProfile>): Promise<void> {
    if (!db) return;
    await setDoc(doc(db, "parents", uid), updates, { merge: true });
  }

  static async getAllParents(count: number = 100): Promise<ParentProfile[]> {
    if (!db) return [];
    const q = query(
      collection(db, "parents"),
      orderBy("createdAt", "desc"),
      limit(count)
    );
    const snap = await getDocs(q);
    return snap.docs.map(doc => doc.data() as ParentProfile);
  }
}
