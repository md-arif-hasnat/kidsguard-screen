"use client";

import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { observeAuth } from '../auth';
import { ParentRepository, ParentProfile } from '../repositories/ParentRepository';
import { FamilyRepository, FamilyData, FamilyRole } from '../repositories/FamilyRepository';
import { RoleHelper } from '../utils/RoleHelper';

interface ParentProfileContextType {
  profile: ParentProfile | null;
  family: FamilyData | null;
  role: FamilyRole;
  isChildAccessible: (childId: string | null) => boolean;
  loading: boolean;
}

const ParentProfileContext = createContext<ParentProfileContextType>({
  profile: null,
  family: null,
  role: FamilyRole.VIEWER,
  isChildAccessible: () => false,
  loading: true
});

export const ParentProfileProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [authUser, setAuthUser] = useState<any>(null);
  const [profile, setProfile] = useState<ParentProfile | null>(null);
  const [family, setFamily] = useState<FamilyData | null>(null);
  const [loading, setLoading] = useState(true);

  // 1. Sync with Firebase Auth
  useEffect(() => {
    return observeAuth(setAuthUser);
  }, []);

  // 2. Sync with Parent Profile
  useEffect(() => {
    if (!authUser) {
        setProfile(null);
        setFamily(null);
        setLoading(false);
        return;
    }
    return ParentRepository.listenToProfile(authUser.uid, (data) => {
        setProfile(data);
        if (!data?.familyId) {
            setFamily(null);
            setLoading(false);
        }
    });
  }, [authUser]);

  // 3. Sync with Family Data
  useEffect(() => {
    if (!profile?.familyId) {
        setFamily(null);
        return;
    }
    return FamilyRepository.listenToFamily(profile.familyId, (data) => {
        setFamily(data);
        setLoading(false);
    });
  }, [profile?.familyId]);

  // 4. Resolve Role (Single Source of Truth)
  const role = useMemo(() => {
    const resolved = RoleHelper.resolveRole(family, authUser?.uid, profile);

    // Debug log for role resolution in development
    if (process.env.NODE_ENV === 'development' && authUser) {
        console.log("RBAC DEBUG:", {
            uid: authUser.uid,
            familyId: family?.familyId,
            ownerId: family?.ownerId,
            profileRole: profile?.role,
            resolvedRole: resolved,
            permissions: {
                canManageFamily: RoleHelper.canManageFamily(resolved),
                canInvite: RoleHelper.canInviteMembers(resolved),
                canManageZones: RoleHelper.canManageSafeZones(resolved)
            }
        });
    }
    return resolved;
  }, [family, authUser?.uid, profile]);

  const isChildAccessible = (childId: string | null) => {
      if (!childId || !family) return false;
      return (family.childDeviceIds ?? []).includes(childId);
  };

  return (
    <ParentProfileContext.Provider value={{ profile, family, role, loading, isChildAccessible }}>
      {children}
    </ParentProfileContext.Provider>
  );
};

export const useParentProfile = () => useContext(ParentProfileContext);

export const getDisplayName = (profile: ParentProfile | null, fallbackEmail?: string | null) => {
    if (profile?.displayName) return profile.displayName;
    if (fallbackEmail) return fallbackEmail.split('@')[0];
    return "Parent Account";
};

export const getAvatarUrl = (profile: ParentProfile | null) => {
    if (profile?.avatarId) {
        return `https://api.dicebear.com/7.x/avataaars/svg?seed=${profile.avatarId}`;
    }
    return null;
};
