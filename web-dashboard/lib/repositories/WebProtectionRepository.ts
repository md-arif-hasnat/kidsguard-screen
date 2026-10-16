import { db } from "../firebase";
import {
    collection,
    doc,
    onSnapshot,
    orderBy,
    query,
    runTransaction,
    serverTimestamp,
    setDoc
} from "firebase/firestore";
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

function normalizeDomain(value: string): string {
    return value
        .trim()
        .toLowerCase()
        .replace(/^https?:\/\//, "")
        .split(/[/?#]/)[0]
        .replace(/^www\./, "");
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

        const database = db;
        const reqRef = doc(database, "children", childId, "accessRequests", requestId);
        const rulesRef = doc(database, "children", childId, "webRules", "current");
        const normalizedDomain = domain ? normalizeDomain(domain) : "";

        if (status === "APPROVED" && !normalizedDomain) {
            throw new Error("The requested domain is invalid.");
        }

        await runTransaction(database, async transaction => {
            let blockedDomains: string[] = [];
            let allowedDomains: string[] = [];

            if (status === "APPROVED") {
                const rulesSnapshot = await transaction.get(rulesRef);
                const rules = rulesSnapshot.data() || {};
                blockedDomains = Array.isArray(rules.blockedDomains)
                    ? rules.blockedDomains.map(String)
                    : [];
                allowedDomains = Array.isArray(rules.allowedDomains)
                    ? rules.allowedDomains.map(String)
                    : [];
            }

            transaction.update(reqRef, {
                status,
                resolvedAt: serverTimestamp()
            });

            if (status === "APPROVED") {
                const filteredBlockedDomains = blockedDomains.filter(entry => {
                    const blocked = normalizeDomain(entry);
                    return !(
                        blocked === normalizedDomain ||
                        normalizedDomain.endsWith(`.${blocked}`) ||
                        blocked.endsWith(`.${normalizedDomain}`)
                    );
                });
                const nextAllowedDomains = Array.from(new Set([
                    ...allowedDomains.map(normalizeDomain).filter(Boolean),
                    normalizedDomain
                ]));

                transaction.set(
                    rulesRef,
                    {
                        allowedDomains: nextAllowedDomains,
                        blockedDomains: filteredBlockedDomains,
                        updatedAt: serverTimestamp()
                    },
                    { merge: true }
                );
            }
        });
    }
}
