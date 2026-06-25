"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { observeAuth } from '../auth';
import { ParentRepository, ParentProfile } from '../repositories/ParentRepository';

interface ParentProfileContextType {
  profile: ParentProfile | null;
  loading: boolean;
}

const ParentProfileContext = createContext<ParentProfileContextType>({
  profile: null,
  loading: true
});

export const ParentProfileProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [profile, setProfile] = useState<ParentProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubAuth = observeAuth((user) => {
      if (user) {
        const unsubProfile = ParentRepository.listenToProfile(user.uid, (data) => {
          setProfile(data);
          setLoading(false);
        });
        return () => unsubProfile();
      } else {
        setProfile(null);
        setLoading(false);
      }
    });
    return () => unsubAuth();
  }, []);

  return (
    <ParentProfileContext.Provider value={{ profile, loading }}>
      {children}
    </ParentProfileContext.Provider>
  );
};

export const useParentProfile = () => useContext(ParentProfileContext);

export const getDisplayName = (profile: ParentProfile | null, fallbackEmail?: string | null) => {
    if (profile?.displayName) return profile.displayName;
    // Legacy mapping if displayName is empty but fullName might exist in firestore (if we used that field)
    // For now, based on interface, it's displayName.

    if (fallbackEmail) return fallbackEmail.split('@')[0];
    return "Parent Account";
};

export const getAvatarUrl = (profile: ParentProfile | null) => {
    if (profile?.avatarId) {
        return `https://api.dicebear.com/7.x/avataaars/svg?seed=${profile.avatarId}`;
    }
    return null;
};
