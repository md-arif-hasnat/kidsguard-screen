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
    return observeAuth((user) => {
        setAuthUser(user);
        if (!user) {
            setProfile(null);
            setFamily(null);
            setLoading(false);
        }
    });
  }, []);

  // 2. Sync with Parent Profile
  useEffect(() => {
    if (!authUser) return;

    const unsub = ParentRepository.listenToProfile(authUser.uid, async (data) => {
        setProfile(data);

        // Auto-provisioning logic (Linear fallback)
        if (data && !data.familyId) {
            console.log("CONTEXT: Auto-provisioning family for:", authUser.uid);
            try {
                const newFId = await FamilyRepository.createFamily(authUser.uid, authUser.email, data.displayName);
                await ParentRepository.updateProfile(authUser.uid, {
                    familyId: newFId,
                    role: 'OWNER'
                });
            } catch (e) {
                console.error("CONTEXT: Auto-provision failed", e);
                setLoading(false);
            }
        } else if (!data) {
            // Profile doesn't exist yet, should be created by Login page
            // But if it's somehow missing, we stay in loading or handle error
        }
    });

    return () => unsub();
  }, [authUser]);

  // 3. Sync with Family Data
  useEffect(() => {
    if (!profile?.familyId) {
        if (profile) setLoading(false); // If profile loaded but no familyId (and not auto-provisioning), stop loading
        return;
    }

    setLoading(true);
    const unsub = FamilyRepository.listenToFamily(profile.familyId, (data) => {
        setFamily(data);
        setLoading(false);
    });

    return () => unsub();
  }, [profile?.familyId]);

  // 4. Resolve Role (Single Source of Truth)
  const role = useMemo(() => {
    return RoleHelper.resolveRole(family, authUser?.uid, profile);
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
