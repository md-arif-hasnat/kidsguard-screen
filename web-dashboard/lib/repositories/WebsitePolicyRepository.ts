import { db } from "../firebase";
import { doc, onSnapshot, setDoc, serverTimestamp, getDoc } from "firebase/firestore";
import { FamilyRole } from "./FamilyRepository";
import { RoleHelper } from "../utils/RoleHelper";
import { PermissionError } from "./ChildRepository";
import { AuditRepository, AuditAction, AuditSeverity } from "./AuditRepository";

export enum WebsiteCategory {
    EDUCATION = "EDUCATION",
    SEARCH = "SEARCH",
    SOCIAL_MEDIA = "SOCIAL_MEDIA",
    VIDEO = "VIDEO",
    NEWS = "NEWS",
    GAMING = "GAMING",
    SHOPPING = "SHOPPING",
    COMMUNICATION = "COMMUNICATION",
    STREAMING = "STREAMING",
    MUSIC = "MUSIC",
    PRODUCTIVITY = "PRODUCTIVITY",
    TECHNOLOGY = "TECHNOLOGY",
    FINANCE = "FINANCE",
    HEALTH = "HEALTH",
    TRAVEL = "TRAVEL",
    FOOD = "FOOD",
    GOVERNMENT = "GOVERNMENT",
    ADULT = "ADULT",
    GAMBLING = "GAMBLING",
    VIOLENCE = "VIOLENCE",
    DRUGS = "DRUGS",
    UNKNOWN = "UNKNOWN"
}

export enum WebsiteDecision {
    ALLOW = "ALLOW",
    WARN = "WARN",
    BLOCK = "BLOCK"
}

export enum WebsiteRiskLevel {
    SAFE = "SAFE",
    CAUTION = "CAUTION",
    RESTRICTED = "RESTRICTED",
    UNKNOWN = "UNKNOWN"
}

export interface WebsitePolicy {
    id: string;
    enabled: boolean;
    blockedDomains: string[];
    allowedDomains: string[];
    blockedCategories: WebsiteCategory[];
    allowedCategories: WebsiteCategory[];
    riskLevels: Record<WebsiteRiskLevel, WebsiteDecision>;
    createdAt: any;
    updatedAt: any;
    version: number;
}

export const DEFAULT_WEBSITE_POLICY: WebsitePolicy = {
    id: "default",
    enabled: true,
    blockedDomains: [],
    allowedDomains: [],
    blockedCategories: [],
    allowedCategories: [],
    riskLevels: {
        [WebsiteRiskLevel.SAFE]: WebsiteDecision.ALLOW,
        [WebsiteRiskLevel.CAUTION]: WebsiteDecision.ALLOW,
        [WebsiteRiskLevel.RESTRICTED]: WebsiteDecision.BLOCK,
        [WebsiteRiskLevel.UNKNOWN]: WebsiteDecision.ALLOW
    },
    createdAt: Date.now(),
    updatedAt: Date.now(),
    version: 1
};

export class WebsitePolicyRepository {
    static listenToFamilyPolicy(familyId: string, onUpdate: (policy: WebsitePolicy) => void) {
        if (!db || !familyId) return () => {};

        const policyRef = doc(db, "families", familyId, "websitePolicy", "current");
        return onSnapshot(policyRef, (snapshot) => {
            if (snapshot.exists()) {
                onUpdate(this.normalizeWebsitePolicy(snapshot.data()));
            } else {
                onUpdate(DEFAULT_WEBSITE_POLICY);
            }
        });
    }

    static normalizeWebsitePolicy(data: any): WebsitePolicy {
        return {
            ...DEFAULT_WEBSITE_POLICY,
            ...data,
            blockedDomains: Array.isArray(data?.blockedDomains) ? data.blockedDomains : [],
            allowedDomains: Array.isArray(data?.allowedDomains) ? data.allowedDomains : [],
            blockedCategories: Array.isArray(data?.blockedCategories) ? data.blockedCategories : [],
            allowedCategories: Array.isArray(data?.allowedCategories) ? data.allowedCategories : [],
            riskLevels: {
                ...DEFAULT_WEBSITE_POLICY.riskLevels,
                ...(data?.riskLevels || {})
            }
        };
    }

    static async updatePolicy(familyId: string, parentUid: string, policy: Partial<WebsitePolicy>, callerRole?: FamilyRole) {
        if (callerRole && !RoleHelper.canManageWebProtection(callerRole)) throw new PermissionError();
        if (!db || !familyId) return;

        const policyRef = doc(db, "families", familyId, "websitePolicy", "current");

        const data = {
            ...policy,
            updatedAt: serverTimestamp(),
            updatedBy: parentUid,
            version: (policy.version || 0) + 1
        };

        await setDoc(policyRef, data, { merge: true });

        await AuditRepository.log({
            actorUid: parentUid,
            actorEmail: "parent",
            familyId: familyId,
            action: AuditAction.WEB_RULE_CHANGED,
            targetType: 'WEB',
            targetId: familyId,
            severity: AuditSeverity.NOTICE,
            metadata: { policy: data }
        });
    }

    static getDefaultPolicy(): WebsitePolicy {
        return DEFAULT_WEBSITE_POLICY;
    }
}
