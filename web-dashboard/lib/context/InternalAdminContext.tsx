"use client";

import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { observeAuth } from '../auth';
import {
  isAllowedPlatformAdminRole,
  PlatformAdminRepository,
  PlatformAdmin
} from '../repositories/PlatformAdminRepository';
import { hasCurrentAdminTotpSignIn } from '../adminMfa';
import { isFullPlatformAdmin } from '../platformAccess';
import {
  InternalLoginDefenseRepository,
  isInternalLoginBlockedError,
  isInternalSessionSecurityError,
} from '../repositories/InternalLoginDefenseRepository';
import {
  getInternalSessionStartedAt,
  INTERNAL_IDLE_TIMEOUT_MS,
  internalActivityStorageKey,
  isInternalSessionExpired,
  prepareInternalAuthSession,
  readInternalSessionActivity,
  signOutInternalSession,
  writeInternalSessionActivity,
} from '../internalSessionSecurity';

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
  const [session, setSession] = useState<{uid: string; startedAt: number} | null>(null);
  const endingSession = useRef(false);

  useEffect(() => {
    let cancelled = false;
    let authSequence = 0;
    let unsubscribe = () => {};

    void prepareInternalAuthSession()
      .then(() => {
        if (cancelled) return;
        unsubscribe = observeAuth(async (user) => {
          const sequence = ++authSequence;
          if (!user) {
            setAdmin(null);
            setSession(null);
            setLoading(false);
            endingSession.current = false;
            return;
          }

          try {
            const startedAt = await getInternalSessionStartedAt(user);
            if (isInternalSessionExpired(startedAt)) {
              if (!endingSession.current) {
                endingSession.current = true;
                await signOutInternalSession("expired");
              }
              return;
            }

            const profile = await PlatformAdminRepository.getAdminProfile(user.uid);
            const authorizedProfile = Boolean(
              profile?.active && isAllowedPlatformAdminRole(profile.role)
            );
            const mfaVerified = authorizedProfile && profile
              ? !isFullPlatformAdmin(profile.role) ||
                await hasCurrentAdminTotpSignIn(user)
              : false;

            if (authorizedProfile && mfaVerified) {
              await InternalLoginDefenseRepository.assertAccess();
            }

            if (cancelled || sequence !== authSequence) return;
            setAdmin(authorizedProfile && mfaVerified ? profile : null);
            setSession(
              authorizedProfile && mfaVerified
                ? {uid: user.uid, startedAt}
                : null
            );
          } catch (caught) {
            if (cancelled || sequence !== authSequence) return;
            setAdmin(null);
            setSession(null);
            if (isInternalLoginBlockedError(caught) && !endingSession.current) {
              endingSession.current = true;
              await signOutInternalSession("blocked");
            } else if (
              isInternalSessionSecurityError(caught) &&
              !endingSession.current
            ) {
              endingSession.current = true;
              await signOutInternalSession("security");
            }
          } finally {
            if (!cancelled && sequence === authSequence) setLoading(false);
          }
        });
      })
      .catch(() => {
        if (!cancelled) {
          setAdmin(null);
          setSession(null);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
      authSequence += 1;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!admin || !session) return;

    const {uid, startedAt} = session;
    const storedActivity = readInternalSessionActivity(uid);
    let lastActivity = storedActivity && storedActivity >= startedAt
      ? storedActivity
      : startedAt;
    let lastStorageWrite = lastActivity;

    const endSession = (reason: "idle" | "expired" | "blocked" | "security") => {
      if (endingSession.current) return;
      endingSession.current = true;
      void signOutInternalSession(reason);
    };

    const checkSession = (now: number): boolean => {
      if (isInternalSessionExpired(startedAt, now)) {
        endSession("expired");
        return true;
      }
      if (now - lastActivity >= INTERNAL_IDLE_TIMEOUT_MS) {
        endSession("idle");
        return true;
      }
      return false;
    };

    const recordActivity = () => {
      const now = Date.now();
      if (checkSession(now)) return;
      lastActivity = now;
      if (now - lastStorageWrite >= 15_000) {
        lastStorageWrite = now;
        writeInternalSessionActivity(uid, now);
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible") recordActivity();
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== internalActivityStorageKey(uid) || !event.newValue) return;
      const nextActivity = Number(event.newValue);
      if (Number.isFinite(nextActivity) && nextActivity > lastActivity) {
        lastActivity = nextActivity;
      }
    };

    writeInternalSessionActivity(uid, lastActivity);
    if (checkSession(Date.now())) return;

    const intervalId = window.setInterval(() => checkSession(Date.now()), 15_000);
    const guardIntervalId = window.setInterval(async () => {
      try {
        await InternalLoginDefenseRepository.assertAccess();
      } catch (caught) {
        if (isInternalLoginBlockedError(caught)) endSession("blocked");
        else if (isInternalSessionSecurityError(caught)) endSession("security");
      }
    }, 60_000);
    window.addEventListener("pointerdown", recordActivity, {passive: true});
    window.addEventListener("keydown", recordActivity);
    window.addEventListener("wheel", recordActivity, {passive: true});
    window.addEventListener("storage", handleStorage);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.clearInterval(intervalId);
      window.clearInterval(guardIntervalId);
      window.removeEventListener("pointerdown", recordActivity);
      window.removeEventListener("keydown", recordActivity);
      window.removeEventListener("wheel", recordActivity);
      window.removeEventListener("storage", handleStorage);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [admin, session]);

  const isAdmin = admin !== null;

  return (
    <InternalAdminContext.Provider value={{ admin, loading, isAdmin }}>
      {children}
    </InternalAdminContext.Provider>
  );
};

export const useInternalAdmin = () => useContext(InternalAdminContext);
