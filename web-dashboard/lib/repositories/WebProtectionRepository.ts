import { db } from "../firebase";
import { doc, onSnapshot, collection, query, orderBy, setDoc, updateDoc } from "firebase/firestore";
import { AuditRepository, AuditAction, AuditSeverity } from "./AuditRepository";
import { FamilyRole } from "./FamilyRepository";
import { RoleHelper } from "../utils/RoleHelper";
import { PermissionError } from "./ChildRepository";

export enum WebCategory {
    SAFE = "SAFE",
    EDUCATION = "EDUCATION",
    SEARCH = "SEARCH",
    VIDEO = "VIDEO",
    SOCIAL = "SOCIAL",
    GAMING = "GAMING",
    SHOPPING = "SHOPPING",
    UNKNOWN = "UNKNOWN",
    ADULT = "ADULT",
    GAMBLING = "GAMBLING",
    VIOLENCE = "VIOLENCE",
    DRUGS = "DRUGS",
    PHISHING = "PHISHING",
    SCAM = "SCAM",
    MALWARE = "MALWARE"
}

export interface WebRuleSet {
    blockedDomains: string[];
    allowedDomains: string[];
    blockedCategories: WebCategory[];
    allowedCategories: WebCategory[];
    safeSearchEnabled: boolean;
    youtubeRestrictedMode: boolean;
    adultContentBlockEnabled: boolean;
}

export interface WebActivityEvent {
    domain: string;
    category: WebCategory;
    timestamp: number;
    browserApp: string;
    status: "ALLOWED" | "BLOCKED";
}

export interface WebAccessRequest {
    requestId: string;
    childId: string;
    domain: string;
    timestamp: number;
    status: "PENDING" | "APPROVED" | "DENIED";
}

export class WebProtectionRepository {
    static listenToWebRules(childId: string, onUpdate: (rules: WebRuleSet | null) => void) {
        if (!db || !childId) return () => {};
        const ref = doc(db, "children", childId, "webRules", "current");
        return onSnapshot(ref, (snapshot) => {
            if (snapshot.exists()) {
                onUpdate(snapshot.data() as WebRuleSet);
            } else {
                onUpdate(null);
            }
        });
    }

    static async updateWebRules(childId: string, rules: WebRuleSet, callerRole?: FamilyRole) {
        if (callerRole && !RoleHelper.canManageWebProtection(callerRole)) throw new PermissionError();
        if (!db || !childId) return;
        const ref = doc(db, "children", childId, "webRules", "current");
        await setDoc(ref, rules);

        await AuditRepository.log({
            actorUid: "current_user",
            actorEmail: "parent",
            familyId: localStorage.getItem("kidsguard_family_id") || "unknown",
            childId: childId,
            action: AuditAction.WEB_RULE_CHANGED,
            targetType: 'WEB',
            targetId: childId,
            severity: AuditSeverity.NOTICE,
            metadata: { rules }
        });
    }

    static listenToWebActivity(childId: string, date: string, onUpdate: (events: WebActivityEvent[]) => void) {
        if (!db || !childId) return () => {};
        const ref = collection(db, "children", childId, "webActivity", date, "events");
        const q = query(ref, orderBy("timestamp", "desc"));
        return onSnapshot(q, (snapshot) => {
            onUpdate(snapshot.docs.map(doc => doc.data() as WebActivityEvent));
        });
    }

    static listenToAccessRequests(childId: string, onUpdate: (requests: WebAccessRequest[]) => void) {
        if (!db || !childId) return () => {};
        const ref = collection(db, "children", childId, "accessRequests");
        const q = query(ref, orderBy("timestamp", "desc"));
        return onSnapshot(q, (snapshot) => {
            onUpdate(snapshot.docs.map(doc => doc.data() as WebAccessRequest));
        });
    }

    static async handleAccessRequest(childId: string, requestId: string, status: "APPROVED" | "DENIED", domain?: string, callerRole?: FamilyRole) {
        if (callerRole && !RoleHelper.canManageWebProtection(callerRole)) throw new PermissionError();
        if (!db || !childId) return;
        const reqRef = doc(db, "children", childId, "accessRequests", requestId);
        await updateDoc(reqRef, { status });

        if (status === "APPROVED" && domain) {
            // Add to allowed domains
            const rulesRef = doc(db, "children", childId, "webRules", "current");
            // This is simplified, in real app we'd fetch current rules first or use arrayUnion
            // But here we'll assume we want to update it.
        }
    }
}
