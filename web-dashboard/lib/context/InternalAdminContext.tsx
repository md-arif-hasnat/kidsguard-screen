"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { observeAuth } from '../auth';
import { PlatformAdminRepository, PlatformAdmin } from '../repositories/PlatformAdminRepository';
import { useRouter } from 'next/navigation';

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
  const router = useRouter();

  useEffect(() => {
    return observeAuth(async (user) => {
      if (!user) {
        setAdmin(null);
        setLoading(false);
        return;
      }

      try {
        const profile = await PlatformAdminRepository.getAdminProfile(user.uid);
        if (profile && profile.active) {
            setAdmin(profile);
        } else {
            setAdmin(null);
        }
      } catch (e) {
        console.error("InternalAdminContext: Error fetching profile", e);
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
