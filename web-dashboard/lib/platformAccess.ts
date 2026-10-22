import { PlatformAdminRole } from "./repositories/PlatformAdminRepository";

const FULL_ADMIN_ROLES = new Set<PlatformAdminRole>([
  PlatformAdminRole.SUPER_ADMIN,
  PlatformAdminRole.PLATFORM_ADMIN,
  PlatformAdminRole.DEV_ADMIN,
]);

const EMPLOYEE_ROUTES = [
  "/internal",
  "/internal/health",
  "/internal/devices",
  "/internal/support",
  "/internal/issues",
  "/internal/settings",
];

const ACCOUNTING_ROUTES = [
  "/internal",
  "/internal/customers",
  "/internal/families",
  "/internal/settings",
];

function matchesRoute(pathname: string, route: string): boolean {
  if (route === "/internal") return pathname === route;
  return pathname === route || pathname.startsWith(`${route}/`);
}

export function isFullPlatformAdmin(role: PlatformAdminRole): boolean {
  return FULL_ADMIN_ROLES.has(role);
}

export function isSupportStaff(role: PlatformAdminRole): boolean {
  return isFullPlatformAdmin(role) || role === PlatformAdminRole.EMPLOYEE;
}

export function isAccountingStaff(role: PlatformAdminRole): boolean {
  return isFullPlatformAdmin(role) || role === PlatformAdminRole.ACCOUNTING;
}

export function canAccessInternalPath(
  role: PlatformAdminRole,
  pathname: string
): boolean {
  if (pathname === "/internal/login") return true;
  if (matchesRoute(pathname, "/internal/billing")) {
    return role === PlatformAdminRole.SUPER_ADMIN;
  }
  if (isFullPlatformAdmin(role)) return true;

  const allowedRoutes = role === PlatformAdminRole.EMPLOYEE
    ? EMPLOYEE_ROUTES
    : role === PlatformAdminRole.ACCOUNTING
      ? ACCOUNTING_ROUTES
      : [];
  return allowedRoutes.some((route) => matchesRoute(pathname, route));
}

export function defaultInternalPath(role: PlatformAdminRole): string {
  if (role === PlatformAdminRole.EMPLOYEE) return "/internal/health";
  if (role === PlatformAdminRole.ACCOUNTING) return "/internal/customers";
  return "/internal";
}

export function platformRoleLabel(role: PlatformAdminRole): string {
  if (role === PlatformAdminRole.SUPER_ADMIN) return "Super Admin";
  if (role === PlatformAdminRole.PLATFORM_ADMIN) return "Admin";
  if (role === PlatformAdminRole.DEV_ADMIN) return "Developer Admin";
  if (role === PlatformAdminRole.ACCOUNTING) return "Accounting";
  return "Employee";
}
