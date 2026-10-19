"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { observeAuth } from '../auth';
import {
  isAllowedPlatformAdminRole,
  PlatformAdminRepository,
  PlatformAdmin
} from '../repositories/PlatformAdminRepository';
import { hasCurrentAdminTotpSignIn } from '../adminMfa';

interface InternalAdminContextType {
  admin: PlatformAdmin | null;
  loading: boolean;
  isAdmin: boolean;
}

const InternalAdminContext = createContext<InternalAdminContextType>({
  admin: null,
  loading: true,
  isAdmin: false
});

export const InternalAdminProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [admin, setAdmin] = useState<PlatformAdmin | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    return observeAuth(async (user) => {
      if (!user) {
        setAdmin(null);
        setLoading(false);
        return;
      }

      try {
        const profile = await PlatformAdminRepository.getAdminProfile(user.uid);
        const authorizedProfile = Boolean(
          profile?.active && isAllowedPlatformAdminRole(profile.role)
        );
        const mfaVerified = authorizedProfile
          ? await hasCurrentAdminTotpSignIn(user)
          : false;

        setAdmin(authorizedProfile && mfaVerified ? profile : null);
      } catch {
        setAdmin(null);
      } finally {
        setLoading(false);
      }
    });
  }, []);

  const isAdmin = admin !== null;

  return (
    <InternalAdminContext.Provider value={{ admin, loading, isAdmin }}>
      {children}
    </InternalAdminContext.Provider>
  );
};

export const useInternalAdmin = () => useContext(InternalAdminContext);
