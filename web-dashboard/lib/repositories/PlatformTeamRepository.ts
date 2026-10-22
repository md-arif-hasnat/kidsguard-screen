import { auth, db } from "../firebase";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  Unsubscribe,
} from "firebase/firestore";
import {
  PlatformAdmin,
  PlatformAdminRole,
} from "./PlatformAdminRepository";

export type AssignablePlatformRole =
  | PlatformAdminRole.PLATFORM_ADMIN
  | PlatformAdminRole.EMPLOYEE
  | PlatformAdminRole.ACCOUNTING;

export interface PlatformStaffProfile extends PlatformAdmin {
  pendingApprovalRequestId?: string;
  invitationStatus?: "SENT" | "FAILED";
  updatedAt?: unknown;
  deactivatedAt?: unknown;
}

export type PlatformStaffApprovalStatus =
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "CANCELED";

export interface PlatformStaffApprovalRequest {
  requestId: string;
  kind: "CREATE_ACCOUNT" | "ROLE_CHANGE" | "REACTIVATE";
  status: PlatformStaffApprovalStatus;
  targetUid: string;
  targetEmail: string;
  displayName: string;
  currentRole?: PlatformAdminRole | null;
  requestedRole: AssignablePlatformRole;
  requestedActive: boolean;
  requestedBy: string;
  requestedByEmail?: string | null;
  createdAt?: unknown;
  expiresAt?: unknown;
  notificationStatus?: "PENDING" | "SENT" | "FAILED";
}

type FunctionResult = {
  success: boolean;
  requestId?: string;
  notificationSent?: boolean;
  decision?: "APPROVED" | "REJECTED";
  invitationSent?: boolean;
};

async function callTeamFunction(
  functionName: string,
  data: Record<string, unknown>
): Promise<FunctionResult> {
  const currentUser = auth?.currentUser;
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!currentUser || !projectId) {
    throw new Error("Your secure admin session is unavailable. Sign in again.");
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
      payload?.error?.message || "The secure team access request failed."
    );
  }
  return payload.result as FunctionResult;
}

export class PlatformTeamRepository {
  static subscribeProfiles(
    onUpdate: (profiles: PlatformStaffProfile[]) => void,
    onError: (error: Error) => void
  ): Unsubscribe {
    if (!db) {
      onError(new Error("Firestore is not configured."));
      return () => undefined;
    }
    return onSnapshot(
      collection(db, "platformAdmins"),
      (snapshot) => onUpdate(snapshot.docs.map((profileDocument) => ({
        ...(profileDocument.data() as Omit<PlatformStaffProfile, "uid">),
        uid: profileDocument.id,
      })).sort((left, right) => {
        if (left.role === PlatformAdminRole.SUPER_ADMIN) return -1;
        if (right.role === PlatformAdminRole.SUPER_ADMIN) return 1;
        return left.email.localeCompare(right.email);
      })),
      (error) => onError(error)
    );
  }

  static subscribeApprovals(
    onUpdate: (requests: PlatformStaffApprovalRequest[]) => void,
    onError: (error: Error) => void
  ): Unsubscribe {
    if (!db) {
      onError(new Error("Firestore is not configured."));
      return () => undefined;
    }
    return onSnapshot(
      query(
        collection(db, "platformStaffApprovalRequests"),
        orderBy("createdAt", "desc")
      ),
      (snapshot) => onUpdate(snapshot.docs.map((requestDocument) => ({
        ...(requestDocument.data() as Omit<PlatformStaffApprovalRequest, "requestId">),
        requestId: requestDocument.id,
      }))),
      (error) => onError(error)
    );
  }

  static createProfile(input: {
    displayName: string;
    email: string;
    role: AssignablePlatformRole;
  }): Promise<FunctionResult> {
    return callTeamFunction("requestPlatformStaffAccount", input);
  }

  static requestChange(
    uid: string,
    role: AssignablePlatformRole
  ): Promise<FunctionResult> {
    return callTeamFunction("requestPlatformStaffChange", {
      uid,
      role,
      active: true,
    });
  }

  static deactivate(uid: string): Promise<FunctionResult> {
    return callTeamFunction("deactivatePlatformStaff", { uid });
  }

  static review(input: {
    requestId: string;
    token: string;
    decision: "APPROVE" | "REJECT";
  }): Promise<FunctionResult> {
    return callTeamFunction("reviewPlatformStaffRequest", input);
  }

  static resendApproval(requestId: string): Promise<FunctionResult> {
    return callTeamFunction("resendPlatformStaffApproval", { requestId });
  }

  static resendInvite(uid: string): Promise<FunctionResult> {
    return callTeamFunction("resendPlatformStaffInvite", { uid });
  }
}
