import { auth, db } from "../firebase";
import { doc, writeBatch } from "firebase/firestore";
import { deleteUser } from "firebase/auth";

export interface FamilyDataExportResult {
  success: true;
  familyId: string;
  fileName: string;
  downloadUrl: string;
  expiresAt: string;
}

export class SecurityRepository {
  static async deleteAccount(
    uid: string,
    _familyId?: string | null
  ): Promise<void> {
    if (!db || !uid) return;

    const batch = writeBatch(db);
    batch.delete(doc(db, "parents", uid));
    await batch.commit();

    const user = auth?.currentUser;
    if (user && user.uid === uid) {
      await deleteUser(user);
    }
  }

  /**
   * Requests the complete family export from the trusted backend.
   * The backend verifies email, Owner role, rate limit, and creates
   * a temporary ZIP containing readable HTML and machine-readable JSON.
   */
  static async exportAllFamilyData(
    expectedFamilyId: string
  ): Promise<FamilyDataExportResult> {
    const user = auth?.currentUser;
    const projectId =
      process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

    if (!user || !projectId) {
      throw new Error(
        "You must be signed in to export family data."
      );
    }

    const idToken = await user.getIdToken(true);
    const response = await fetch(
      `https://us-central1-${projectId}.cloudfunctions.net/requestFamilyDataExport`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`
        },
        body: JSON.stringify({ data: {} })
      }
    );

    const payload = await response.json();
    if (!response.ok || payload.error) {
      throw new Error(
        payload.error?.message ||
          "The family data export could not be created."
      );
    }

    const result =
      payload.result as Partial<FamilyDataExportResult>;

    if (
      result.success !== true ||
      result.familyId !== expectedFamilyId ||
      typeof result.fileName !== "string" ||
      typeof result.downloadUrl !== "string" ||
      !result.downloadUrl.startsWith(
        "https://firebasestorage.googleapis.com/"
      ) ||
      typeof result.expiresAt !== "string"
    ) {
      throw new Error(
        "The export service returned an invalid response."
      );
    }

    return result as FamilyDataExportResult;
  }
}
