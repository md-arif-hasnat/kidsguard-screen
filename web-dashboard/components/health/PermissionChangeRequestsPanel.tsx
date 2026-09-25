"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  Check,
  Clock3,
  KeyRound,
  Loader2,
  ShieldAlert,
  X
} from "lucide-react";
import {
  Timestamp,
  collection,
  doc,
  onSnapshot,
  serverTimestamp,
  updateDoc
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

interface PermissionChangeRequest {
  id: string;
  permissionName: string;
  permissionType: string;
  childName: string;
  status: "PENDING" | "APPROVED" | "DENIED";
  requestedAt?: Timestamp;
  expiresAt?: Timestamp;
}

interface PermissionChangeRequestsPanelProps {
  childId: string;
  canEdit: boolean;
  focusRequestId?: string | null;
}

export default function PermissionChangeRequestsPanel({
  childId,
  canEdit,
  focusRequestId
}: PermissionChangeRequestsPanelProps) {
  const [requests, setRequests] = useState<PermissionChangeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const panelRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!focusRequestId || loading) return;
    panelRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }, [focusRequestId, loading]);

  useEffect(() => {
    if (!db || !childId) {
      setLoading(false);
      return;
    }

    return onSnapshot(
      collection(db, "children", childId, "permissionChangeRequests"),
      snapshot => {
        const items = snapshot.docs
          .map(document => ({
            id: document.id,
            ...document.data()
          } as PermissionChangeRequest))
          .sort((a, b) =>
            (b.requestedAt?.toMillis?.() || 0) -
            (a.requestedAt?.toMillis?.() || 0)
          );
        setRequests(items);
        setLoading(false);
      },
      error => {
        console.error("Failed to load permission requests", error);
        setLoading(false);
      }
    );
  }, [childId]);

  const review = async (
    request: PermissionChangeRequest,
    status: "APPROVED" | "DENIED"
  ) => {
    if (!db || !canEdit || request.status !== "PENDING") return;

    try {
      setProcessingId(request.id);
      const expiresAt = status === "APPROVED"
        ? Timestamp.fromMillis(Date.now() + 10 * 60 * 1000)
        : null;

      await updateDoc(
        doc(db, "children", childId, "permissionChangeRequests", request.id),
        {
          status,
          reviewedAt: serverTimestamp(),
          reviewedBy: auth?.currentUser?.uid || "parent",
          ...(expiresAt ? { expiresAt } : {})
        }
      );
    } catch (error) {
      console.error("Failed to review permission request", error);
      window.alert("Failed to update the permission request.");
    } finally {
      setProcessingId(null);
    }
  };

  const pending = requests.filter(request => request.status === "PENDING");
  const recent = requests
    .filter(request => request.status !== "PENDING")
    .slice(0, 5);

  return (
    <section
      ref={panelRef}
      id="permission-approvals"
      className={
        "bg-white rounded-[2rem] border p-6 md:p-8 shadow-sm scroll-mt-24 " +
        (focusRequestId
          ? "border-amber-400 ring-4 ring-amber-100"
          : "border-slate-200")
      }
    >
      <div className="flex items-start gap-4">
        <div className="p-3 rounded-2xl bg-amber-50 text-amber-600">
          <KeyRound size={26} />
        </div>
        <div>
          <h3 className="text-lg font-black text-slate-900">
            Permission change approvals
          </h3>
          <p className="text-sm text-slate-500 mt-1">
            The child needs parent approval before opening protected settings
            to disable an active permission. Approval expires after 10 minutes.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="py-10 flex justify-center">
          <Loader2 className="animate-spin text-primary-600" />
        </div>
      ) : pending.length === 0 ? (
        <div className="mt-6 rounded-2xl bg-emerald-50 border border-emerald-100 p-5 flex items-center gap-3">
          <Check className="text-emerald-600" size={20} />
          <p className="text-sm font-bold text-emerald-800">
            No permission change is waiting for approval.
          </p>
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {pending.map(request => (
            <div
              key={request.id}
              className={
                "rounded-2xl border bg-amber-50 p-4 md:flex md:items-center md:justify-between gap-4 " +
                (focusRequestId === request.id
                  ? "border-amber-500 ring-2 ring-amber-300"
                  : "border-amber-200")
              }
            >
              <div className="flex gap-3">
                <ShieldAlert className="text-amber-600 shrink-0" size={22} />
                <div>
                  <p className="font-black text-slate-900">
                    {request.permissionName}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    {request.childName || "Child"} requested access to change
                    this active permission.
                  </p>
                </div>
              </div>

              <div className="flex gap-2 mt-4 md:mt-0">
                <button
                  type="button"
                  disabled={!canEdit || processingId === request.id}
                  onClick={() => review(request, "DENIED")}
                  className="inline-flex items-center gap-1 px-4 py-2 rounded-xl bg-white border border-rose-200 text-rose-600 text-sm font-bold disabled:opacity-50"
                >
                  <X size={15} />
                  Deny
                </button>
                <button
                  type="button"
                  disabled={!canEdit || processingId === request.id}
                  onClick={() => review(request, "APPROVED")}
                  className="inline-flex items-center gap-1 px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-bold disabled:opacity-50"
                >
                  {processingId === request.id ? (
                    <Loader2 className="animate-spin" size={15} />
                  ) : (
                    <Check size={15} />
                  )}
                  Approve
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {recent.length > 0 && (
        <div className="mt-7 border-t border-slate-100 pt-5">
          <p className="text-xs font-black uppercase tracking-wider text-slate-400 mb-3">
            Recent decisions
          </p>
          <div className="space-y-2">
            {recent.map(request => (
              <div
                key={request.id}
                className="flex items-center justify-between text-sm py-2"
              >
                <span className="font-bold text-slate-700">
                  {request.permissionName}
                </span>
                <span className={
                  "inline-flex items-center gap-1 font-bold " +
                  (request.status === "APPROVED"
                    ? "text-emerald-600"
                    : "text-rose-600")
                }>
                  <Clock3 size={14} />
                  {request.status === "APPROVED" ? "Approved" : "Denied"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
