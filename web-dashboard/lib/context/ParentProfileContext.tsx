"use client";

import React, { createContext, useContext, useEffect, useState, useMemo, useRef } from 'react';
import { observeAuth, signOut } from '../auth';
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
  const provisioningFamilyRef = useRef(false);

  // 1. Sync with Firebase Auth
  useEffect(() => {
    return observeAuth((user) => {
        if (user && !user.emailVerified) {
            setAuthUser(null);
            setProfile(null);
            setFamily(null);
            setLoading(false);
            const isLoginPage = window.location.pathname === '/login';
            void signOut().finally(() => {
                // The login page owns the inline verification notice. Reloading
                // it here resets that notice immediately after it appears.
                if (!isLoginPage) {
                    window.location.replace('/login?verificationRequired=1');
                }
            });
            return;
        }
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

        // Provision exactly once through an atomic backend transaction.
        if (
          data &&
          !data.familyId &&
          !data.ownedFamilyId &&
          !provisioningFamilyRef.current
        ) {
            provisioningFamilyRef.current = true;
            console.log(
              "CONTEXT: Securely provisioning family for:",
              authUser.uid
            );
            try {
                await FamilyRepository.ensureParentFamily();
            } catch (e) {
                console.error(
                  "CONTEXT: Auto-provision failed",
                  e
                );
                setLoading(false);
            } finally {
                provisioningFamilyRef.current = false;
            }
        } else if (!data) {
            // Profile doesn't exist yet, should be created by Login page
            // But if it's somehow missing, we stay in loading or handle error
        }
    });

    return () => unsub();
  }, [authUser]);

  // 3. Sync with Family Data
  const selectedFamilyId =
    profile?.activeFamilyId ||
    profile?.ownedFamilyId ||
    profile?.familyId ||
    profile?.familyIds?.[0] ||
    null;

  useEffect(() => {
    if (!selectedFamilyId) {
      if (profile) {
        setFamily(null);
        setLoading(false);
      }
      return;
    }

    setLoading(true);

    const unsub =
      FamilyRepository.listenToFamily(
        selectedFamilyId,
        (data) => {
          setFamily(data);
          setLoading(false);
        }
      );

    return () => unsub();
  }, [selectedFamilyId, profile]);

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
