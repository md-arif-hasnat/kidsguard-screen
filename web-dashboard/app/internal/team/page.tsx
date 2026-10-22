"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  KeyRound,
  Loader2,
  Mail,
  RefreshCw,
  ShieldCheck,
  UserMinus,
  UserPlus,
  UsersRound,
  XCircle,
} from "lucide-react";

import InternalLayout from "@/components/InternalLayout";
import { useInternalAdmin } from "@/lib/context/InternalAdminContext";
import {
  PlatformAdminRole,
} from "@/lib/repositories/PlatformAdminRepository";
import {
  AssignablePlatformRole,
  PlatformStaffApprovalRequest,
  PlatformStaffProfile,
  PlatformTeamRepository,
} from "@/lib/repositories/PlatformTeamRepository";
import { platformRoleLabel } from "@/lib/platformAccess";

const ASSIGNABLE_ROLES: Array<{
  value: AssignablePlatformRole;
  label: string;
  description: string;
}> = [
  {
    value: PlatformAdminRole.EMPLOYEE,
    label: "Employee",
    description: "Support, device health, and issue handling.",
  },
  {
    value: PlatformAdminRole.ACCOUNTING,
    label: "Accounting",
    description: "Customer, family, and billing visibility.",
  },
  {
    value: PlatformAdminRole.PLATFORM_ADMIN,
    label: "Admin",
    description: "Full platform administration except owner approval.",
  },
];

type EmailApprovalAction = {
  requestId: string;
  token: string;
  decision: "APPROVE" | "REJECT";
};

type PageMessage = {
  type: "success" | "error" | "warning";
  text: string;
};

function toDateLabel(value: unknown): string {
  if (!value) return "Not available";
  const candidate = value as {toDate?: () => Date; seconds?: number};
  const date = typeof candidate.toDate === "function"
    ? candidate.toDate()
    : typeof candidate.seconds === "number"
      ? new Date(candidate.seconds * 1000)
      : new Date(String(value));
  return Number.isNaN(date.getTime())
    ? "Not available"
    : new Intl.DateTimeFormat("en-GB", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(date);
}

function requestKindLabel(kind: PlatformStaffApprovalRequest["kind"]): string {
  if (kind === "CREATE_ACCOUNT") return "New account";
  if (kind === "REACTIVATE") return "Reactivate access";
  return "Role change";
}

function statusStyle(status: string): string {
  if (status === "APPROVED") {
    return "border-emerald-500/20 bg-emerald-500/10 text-emerald-300";
  }
  if (status === "REJECTED" || status === "SECURITY_HOLD") {
    return "border-rose-500/20 bg-rose-500/10 text-rose-300";
  }
  if (status === "PENDING") {
    return "border-amber-500/20 bg-amber-500/10 text-amber-300";
  }
  return "border-slate-700 bg-slate-800 text-slate-400";
}

export default function InternalTeamPage() {
  const { admin } = useInternalAdmin();
  const [profiles, setProfiles] = useState<PlatformStaffProfile[]>([]);
  const [approvals, setApprovals] = useState<PlatformStaffApprovalRequest[]>([]);
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<AssignablePlatformRole>(
    PlatformAdminRole.EMPLOYEE
  );
  const [draftRoles, setDraftRoles] = useState<Record<string, AssignablePlatformRole>>({});
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState<string | null>(null);
  const [message, setMessage] = useState<PageMessage | null>(null);
  const [emailAction, setEmailAction] = useState<EmailApprovalAction | null>(null);

  useEffect(() => {
    let profilesLoaded = false;
    let approvalsLoaded = false;
    const finishLoading = () => {
      if (profilesLoaded && approvalsLoaded) setLoading(false);
    };
    const handleError = (error: Error) => {
      setMessage({type: "error", text: error.message});
      setLoading(false);
    };
    const unsubscribeProfiles = PlatformTeamRepository.subscribeProfiles(
      (nextProfiles) => {
        profilesLoaded = true;
        setProfiles(nextProfiles);
        setDraftRoles((current) => {
          const next = {...current};
          nextProfiles.forEach((profile) => {
            if (
              !next[profile.uid] &&
              ASSIGNABLE_ROLES.some((option) => option.value === profile.role)
            ) {
              next[profile.uid] = profile.role as AssignablePlatformRole;
            }
          });
          return next;
        });
        finishLoading();
      },
      handleError
    );
    const unsubscribeApprovals = PlatformTeamRepository.subscribeApprovals(
      (nextApprovals) => {
        approvalsLoaded = true;
        setApprovals(nextApprovals);
        finishLoading();
      },
      handleError
    );
    return () => {
      unsubscribeProfiles();
      unsubscribeApprovals();
    };
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requestId = params.get("requestId") || "";
    const token = params.get("token") || "";
    const rawDecision = (params.get("decision") || "").toUpperCase();
    if (
      requestId &&
      token &&
      (rawDecision === "APPROVE" || rawDecision === "REJECT")
    ) {
      setEmailAction({
        requestId,
        token,
        decision: rawDecision,
      });
    }
  }, []);

  const pendingByTarget = useMemo(() => {
    const pending = new Map<string, PlatformStaffApprovalRequest>();
    approvals.forEach((request) => {
      if (request.status === "PENDING" && !pending.has(request.targetUid)) {
        pending.set(request.targetUid, request);
      }
    });
    return pending;
  }, [approvals]);

  const pendingApprovals = useMemo(
    () => approvals.filter((request) => request.status === "PENDING"),
    [approvals]
  );

  const linkedApproval = emailAction
    ? approvals.find((request) => request.requestId === emailAction.requestId)
    : undefined;

  const createProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setWorking("create");
    setMessage(null);
    try {
      const result = await PlatformTeamRepository.createProfile({
        displayName: displayName.trim(),
        email: email.trim().toLowerCase(),
        role,
      });
      setDisplayName("");
      setEmail("");
      setRole(PlatformAdminRole.EMPLOYEE);
      setMessage({
        type: result.notificationSent ? "success" : "warning",
        text: result.notificationSent
          ? "Profile created disabled. The Super Admin approval email was sent."
          : "Profile created disabled, but the approval email failed. Use Resend below.",
      });
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Profile could not be created.",
      });
    } finally {
      setWorking(null);
    }
  };

  const requestChange = async (profile: PlatformStaffProfile) => {
    const requestedRole = draftRoles[profile.uid];
    if (!requestedRole) return;
    setWorking(`change:${profile.uid}`);
    setMessage(null);
    try {
      const result = await PlatformTeamRepository.requestChange(
        profile.uid,
        requestedRole
      );
      setMessage({
        type: result.notificationSent ? "success" : "warning",
        text: result.notificationSent
          ? "Change is pending. The Super Admin approval email was sent."
          : "Change is pending, but email delivery failed. Use Resend below.",
      });
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Change could not be requested.",
      });
    } finally {
      setWorking(null);
    }
  };

  const deactivate = async (profile: PlatformStaffProfile) => {
    if (!window.confirm(`Deactivate ${profile.email} immediately?`)) return;
    setWorking(`deactivate:${profile.uid}`);
    setMessage(null);
    try {
      await PlatformTeamRepository.deactivate(profile.uid);
      setMessage({
        type: "success",
        text: `${profile.email} can no longer sign in. The Super Admin was notified.`,
      });
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Access could not be removed.",
      });
    } finally {
      setWorking(null);
    }
  };

  const resendApproval = async (requestId: string) => {
    setWorking(`resend:${requestId}`);
    setMessage(null);
    try {
      await PlatformTeamRepository.resendApproval(requestId);
      setMessage({type: "success", text: "A new owner approval link was sent."});
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Approval email could not be resent.",
      });
    } finally {
      setWorking(null);
    }
  };

  const resendInvite = async (profile: PlatformStaffProfile) => {
    setWorking(`invite:${profile.uid}`);
    setMessage(null);
    try {
      await PlatformTeamRepository.resendInvite(profile.uid);
      setMessage({type: "success", text: `Password setup sent to ${profile.email}.`});
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Invitation could not be sent.",
      });
    } finally {
      setWorking(null);
    }
  };

  const reviewEmailAction = async () => {
    if (!emailAction) return;
    setWorking(`review:${emailAction.requestId}`);
    setMessage(null);
    try {
      const result = await PlatformTeamRepository.review(emailAction);
      setMessage({
        type: result.invitationSent === false ? "warning" : "success",
        text: emailAction.decision === "APPROVE"
          ? result.invitationSent === false
            ? "Access approved, but the employee invitation failed. Use Send invite again."
            : "Access approved. The staff member can set a password and sign in. Admin roles require TOTP; Employee and Accounting can enable it from Settings."
          : "Request rejected. The account remains disabled.",
      });
      setEmailAction(null);
      window.history.replaceState({}, "", "/internal/team");
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Request could not be reviewed.",
      });
    } finally {
      setWorking(null);
    }
  };

  const cancelEmailAction = () => {
    setEmailAction(null);
    window.history.replaceState({}, "", "/internal/team");
  };

  return (
    <InternalLayout>
      <header className="mb-8">
        <p className="text-[10px] font-black uppercase tracking-[0.25em] text-rose-400">
          Owner-controlled security
        </p>
        <h1 className="mt-2 text-3xl font-black uppercase italic tracking-tight text-white sm:text-4xl">
          Team <span className="text-rose-500">Access</span>
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-500">
          Create role-based internal profiles. Every new account, promotion, and
          reactivation stays disabled until the Super Admin approves it by email
          after TOTP verification.
        </p>
      </header>

      {message ? (
        <div
          role="status"
          className={`mb-6 flex items-start gap-3 rounded-2xl border p-4 text-sm font-bold ${
            message.type === "success"
              ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
              : message.type === "warning"
                ? "border-amber-500/20 bg-amber-500/10 text-amber-300"
                : "border-rose-500/20 bg-rose-500/10 text-rose-300"
          }`}
        >
          {message.type === "success" ? (
            <CheckCircle2 className="mt-0.5 shrink-0" size={18} />
          ) : (
            <AlertCircle className="mt-0.5 shrink-0" size={18} />
          )}
          <p>{message.text}</p>
        </div>
      ) : null}

      {emailAction ? (
        <section className="mb-8 rounded-3xl border border-amber-500/30 bg-amber-500/5 p-6 shadow-xl">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="mb-2 flex items-center gap-2 text-amber-300">
                <KeyRound size={18} />
                <p className="text-[10px] font-black uppercase tracking-[0.2em]">
                  Email approval link
                </p>
              </div>
              <h2 className="text-xl font-black text-white">
                {emailAction.decision === "APPROVE" ? "Approve" : "Reject"}{" "}
                {linkedApproval?.targetEmail || "this access request"}?
              </h2>
              <p className="mt-2 text-sm text-slate-400">
                Only the Super Admin owner can complete this action. The secure
                function will verify this TOTP-authenticated session again.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={cancelEmailAction}
                className="rounded-xl border border-slate-700 px-5 py-3 text-xs font-black uppercase tracking-widest text-slate-300 hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={reviewEmailAction}
                disabled={working === `review:${emailAction.requestId}`}
                className={`flex items-center gap-2 rounded-xl px-5 py-3 text-xs font-black uppercase tracking-widest text-white disabled:opacity-50 ${
                  emailAction.decision === "APPROVE"
                    ? "bg-emerald-600 hover:bg-emerald-500"
                    : "bg-rose-600 hover:bg-rose-500"
                }`}
              >
                {working === `review:${emailAction.requestId}` ? (
                  <Loader2 className="animate-spin" size={16} />
                ) : emailAction.decision === "APPROVE" ? (
                  <ShieldCheck size={16} />
                ) : (
                  <XCircle size={16} />
                )}
                Confirm {emailAction.decision.toLowerCase()}
              </button>
            </div>
          </div>
        </section>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <section className="rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-xl sm:p-7">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-400">
              <UserPlus size={21} />
            </div>
            <div>
              <h2 className="font-black uppercase tracking-tight text-white">
                Create employee profile
              </h2>
              <p className="text-xs text-slate-500">Created disabled by default</p>
            </div>
          </div>
          <form onSubmit={createProfile} className="space-y-5">
            <label className="block">
              <span className="mb-2 block text-[10px] font-black uppercase tracking-widest text-slate-500">
                Full name
              </span>
              <input
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                required
                minLength={2}
                maxLength={100}
                autoComplete="name"
                className="w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:ring-2 focus:ring-rose-500"
                placeholder="Employee name"
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-[10px] font-black uppercase tracking-widest text-slate-500">
                Work email
              </span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                autoComplete="email"
                className="w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:ring-2 focus:ring-rose-500"
                placeholder="employee@company.com"
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-[10px] font-black uppercase tracking-widest text-slate-500">
                Requested role
              </span>
              <select
                value={role}
                onChange={(event) => setRole(event.target.value as AssignablePlatformRole)}
                className="w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:ring-2 focus:ring-rose-500"
              >
                {ASSIGNABLE_ROLES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <p className="mt-2 text-xs leading-relaxed text-slate-500">
                {ASSIGNABLE_ROLES.find((option) => option.value === role)?.description}
              </p>
            </label>
            <button
              type="submit"
              disabled={working === "create"}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-rose-600 px-5 py-3.5 text-xs font-black uppercase tracking-widest text-white hover:bg-rose-500 disabled:opacity-50"
            >
              {working === "create" ? (
                <Loader2 className="animate-spin" size={17} />
              ) : (
                <UserPlus size={17} />
              )}
              Create pending profile
            </button>
          </form>
        </section>

        <section className="rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-xl sm:p-7">
          <div className="mb-6 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-400">
                <Clock3 size={21} />
              </div>
              <div>
                <h2 className="font-black uppercase tracking-tight text-white">
                  Pending approvals
                </h2>
                <p className="text-xs text-slate-500">Owner review required</p>
              </div>
            </div>
            <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-xs font-black text-amber-300">
              {pendingApprovals.length}
            </span>
          </div>
          <div className="space-y-3">
            {pendingApprovals.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-800 p-8 text-center text-sm text-slate-500">
                No pending owner approvals.
              </div>
            ) : pendingApprovals.map((request) => (
              <article
                key={request.requestId}
                className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-bold text-white">{request.targetEmail}</p>
                      <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-amber-300">
                        {requestKindLabel(request.kind)}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      {platformRoleLabel(request.requestedRole)} · requested {toDateLabel(request.createdAt)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => resendApproval(request.requestId)}
                    disabled={working === `resend:${request.requestId}`}
                    className="flex shrink-0 items-center justify-center gap-2 rounded-xl border border-slate-700 px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-slate-300 hover:bg-slate-800 disabled:opacity-50"
                  >
                    {working === `resend:${request.requestId}` ? (
                      <Loader2 className="animate-spin" size={14} />
                    ) : (
                      <Mail size={14} />
                    )}
                    Resend
                  </button>
                </div>
                {request.notificationStatus === "FAILED" ? (
                  <p className="mt-3 text-xs font-bold text-rose-400">
                    Previous email delivery failed.
                  </p>
                ) : null}
              </article>
            ))}
          </div>
        </section>
      </div>

      <section className="mt-6 rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-xl sm:p-7">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-400">
              <UsersRound size={21} />
            </div>
            <div>
              <h2 className="font-black uppercase tracking-tight text-white">
                Internal profiles
              </h2>
              <p className="text-xs text-slate-500">Role and account status</p>
            </div>
          </div>
          <span className="text-xs font-black text-slate-500">{profiles.length} profiles</span>
        </div>

        {loading ? (
          <div className="flex justify-center py-16 text-rose-400">
            <Loader2 className="animate-spin" size={28} />
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {profiles.map((profile) => {
              const pending = pendingByTarget.get(profile.uid);
              const isOwner = profile.role === PlatformAdminRole.SUPER_ADMIN;
              const selectedRole = draftRoles[profile.uid];
              const hasRequestedChange = Boolean(
                selectedRole &&
                (selectedRole !== profile.role || profile.active !== true)
              );
              return (
                <article
                  key={profile.uid}
                  className="rounded-2xl border border-slate-800 bg-slate-950/60 p-5"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="truncate font-black text-white">
                        {profile.displayName || profile.email}
                      </p>
                      <p className="mt-1 truncate text-xs text-slate-500">{profile.email}</p>
                    </div>
                    <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-wider ${statusStyle(profile.approvalStatus || (profile.active ? "APPROVED" : "INACTIVE"))}`}>
                      {profile.active ? platformRoleLabel(profile.role) : profile.approvalStatus || "Inactive"}
                    </span>
                  </div>

                  {isOwner ? (
                    <div className="mt-5 flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-xs font-bold text-emerald-300">
                      <ShieldCheck size={16} /> Super Admin owner is protected from changes.
                    </div>
                  ) : (
                    <div className="mt-5 space-y-3">
                      <select
                        aria-label={`Role for ${profile.email}`}
                        value={selectedRole || PlatformAdminRole.EMPLOYEE}
                        onChange={(event) => setDraftRoles((current) => ({
                          ...current,
                          [profile.uid]: event.target.value as AssignablePlatformRole,
                        }))}
                        disabled={Boolean(pending)}
                        className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2.5 text-sm text-white outline-none focus:ring-2 focus:ring-rose-500 disabled:opacity-50"
                      >
                        {ASSIGNABLE_ROLES.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => requestChange(profile)}
                          disabled={!hasRequestedChange || Boolean(pending) || working === `change:${profile.uid}`}
                          className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          {working === `change:${profile.uid}` ? (
                            <Loader2 className="animate-spin" size={14} />
                          ) : (
                            <RefreshCw size={14} />
                          )}
                          {profile.active ? "Request change" : "Request activation"}
                        </button>
                        {profile.active ? (
                          <button
                            type="button"
                            onClick={() => deactivate(profile)}
                            disabled={working === `deactivate:${profile.uid}`}
                            className="flex items-center gap-2 rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-rose-300 hover:bg-rose-500/20 disabled:opacity-50"
                          >
                            <UserMinus size={14} /> Deactivate
                          </button>
                        ) : null}
                        {profile.active && profile.invitationStatus === "FAILED" ? (
                          <button
                            type="button"
                            onClick={() => resendInvite(profile)}
                            disabled={working === `invite:${profile.uid}`}
                            className="flex items-center gap-2 rounded-xl border border-slate-700 px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-slate-300 hover:bg-slate-800 disabled:opacity-50"
                          >
                            <Mail size={14} /> Send invite again
                          </button>
                        ) : null}
                      </div>
                      {pending ? (
                        <p className="flex items-center gap-2 text-xs font-bold text-amber-300">
                          <Clock3 size={14} /> Pending Super Admin approval
                        </p>
                      ) : null}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>

      <div className="mt-6 rounded-3xl border border-slate-800 bg-slate-900/60 p-5 text-xs leading-relaxed text-slate-500">
        Signed in as <span className="font-bold text-slate-300">{admin?.email}</span>.
        All roles must use password/Google sign-in plus authenticator verification.
        Role changes are server-authoritative and recorded for owner review.
      </div>
    </InternalLayout>
  );
}
