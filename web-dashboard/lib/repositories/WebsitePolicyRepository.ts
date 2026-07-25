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
}

export class WebsitePolicyRepository {
    static listenToFamilyPolicy(familyId: string, onUpdate: (policy: WebsitePolicy | null) => void) {
        if (!db || !familyId) return () => {};

        const policyRef = doc(db, "families", familyId, "websitePolicy", "current");
        return onSnapshot(policyRef, (snapshot) => {
            if (snapshot.exists()) {
                onUpdate(snapshot.data() as WebsitePolicy);
            } else {
                onUpdate(this.getDefaultPolicy());
            }
        });
    }

    static async updatePolicy(familyId: string, parentUid: string, policy: Partial<WebsitePolicy>, callerRole?: FamilyRole) {
        if (callerRole && !RoleHelper.canManageWebProtection(callerRole)) throw new PermissionError();
        if (!db || !familyId) return;

        const policyRef = doc(db, "families", familyId, "websitePolicy", "current");

        const data = {
            ...policy,
            updatedAt: serverTimestamp(),
            updatedBy: parentUid
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
        return {
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
            updatedAt: Date.now()
        };
    }
}
