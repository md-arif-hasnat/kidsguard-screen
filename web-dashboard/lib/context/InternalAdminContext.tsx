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
      console.log("INTERNAL_DEBUG: observeAuth triggered", user ? `User: ${user.email} (${user.uid})` : "No user");
      if (!user) {
        console.log("INTERNAL_DEBUG: Context Auth: No user signed in.");
        setAdmin(null);
        setLoading(false);
        return;
      }

      try {
        console.log(`INTERNAL_DEBUG: Context Auth: User signed in: ${user.email}, UID: ${user.uid}`);
        const profile = await PlatformAdminRepository.getAdminProfile(user.uid);
        if (profile) {
            console.log("INTERNAL_DEBUG: Context Auth: Found profile:", profile);
            if (profile.active) {
                console.log("INTERNAL_DEBUG: Context Auth: Admin profile active. Granting access.");
                setAdmin(profile);
            } else {
                console.warn("INTERNAL_DEBUG: Context Auth: Access denied. Profile marked as INACTIVE.");
                setAdmin(null);
            }
        } else {
            console.warn(`INTERNAL_DEBUG: Context Auth: Access denied. No profile document found for UID: ${user.uid}`);
            setAdmin(null);
        }
      } catch (e) {
        console.error("INTERNAL_DEBUG: Context Auth: Error fetching profile", e);
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
