"use client";

import React, { useEffect, useState } from "react";
import { CheckCircle2, Loader2, ShieldCheck, X } from "lucide-react";
import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useParentProfile } from "@/lib/context/ParentProfileContext";

interface OverrideEvent {
  id: string;
  title?: string;
  message?: string;
  commandType?: string;
  status?: string;
  acknowledged?: boolean;
}

export default function RemoteControlOverrideCard({
  childId
}: {
  childId: string;
}) {
  const { profile } = useParentProfile();
  const [event, setEvent] = useState<OverrideEvent | null>(null);
  const [dismissing, setDismissing] = useState(false);

  useEffect(() => {
    if (!db || !childId) return;

    const eventsQuery = query(
      collection(db, "children", childId, "remoteControlOverrides"),
      orderBy("createdAt", "desc"),
      limit(10)
    );

    return onSnapshot(
      eventsQuery,
      snapshot => {
        const latest = snapshot.docs
          .map(eventDoc => ({
            id: eventDoc.id,
            ...eventDoc.data()
          } as OverrideEvent))
          .find(item => item.status === "APPLIED" && item.acknowledged !== true);
        setEvent(latest || null);
      },
      error => {
        console.error("Failed to load Remote Control override", error);
        setEvent(null);
      }
    );
  }, [childId]);

  if (!event) return null;

  const dismiss = async () => {
    if (!db || !profile?.uid) return;
    try {
      setDismissing(true);
      await updateDoc(
        doc(db, "children", childId, "remoteControlOverrides", event.id),
        {
          acknowledged: true,
          acknowledgedAt: serverTimestamp(),
          acknowledgedBy: profile.uid
        }
      );
    } catch (error) {
      console.error("Failed to dismiss Remote Control override", error);
      window.alert("The Remote Control notice could not be dismissed.");
    } finally {
      setDismissing(false);
    }
  };

  return (
    <section
      id="remote-control-override"
      className="scroll-mt-24 rounded-2xl border border-primary-200 bg-primary-50 p-5 shadow-sm md:p-6"
    >
      <div className="flex items-start gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-600 text-white">
          <ShieldCheck size={23} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-black text-primary-950">
              {event.title || "Remote control priority applied"}
            </h2>
            <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-black text-emerald-700">
              <CheckCircle2 size={12} />
              APPLIED
            </span>
          </div>
          <p className="mt-1 text-sm font-medium text-primary-800">
            {event.message || "The Remote Control command overrode scheduled settings."}
          </p>
          {event.commandType && (
            <p className="mt-2 text-xs font-bold uppercase tracking-wider text-primary-600">
              {event.commandType.replace(/_/g, " ")}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={dismiss}
          disabled={dismissing}
          aria-label="Dismiss Remote Control notice"
          className="rounded-lg p-2 text-primary-700 transition hover:bg-primary-100 disabled:opacity-50"
        >
          {dismissing
            ? <Loader2 size={18} className="animate-spin" />
            : <X size={18} />}
        </button>
      </div>
    </section>
  );
}
