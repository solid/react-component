"use client";

import { useEffect, useRef, Suspense, type ReactNode } from "react";
import { useSolidAuth } from "@ldo/solid-react";
import { useSolidLoginNavigation } from "./NavigationContext";

// ── Constants ────────────────────────────────────────────────────────────────

const RETURN_TO_KEY = "solid-login-returnTo";

// ── Storage helpers (sessionStorage/localStorage throw in restricted contexts) ──

function storageGet(storage: Storage, key: string): string | null {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

function storageSet(storage: Storage, key: string, value: string): void {
  try {
    storage.setItem(key, value);
  } catch {
    // Unavailable (e.g. Safari private mode, quota exceeded)
  }
}

function storageRemove(storage: Storage, key: string): void {
  try {
    storage.removeItem(key);
  } catch {
    // Unavailable
  }
}

// ── Path helpers ─────────────────────────────────────────────────────────────

function isValidReturnPath(value: string | null | undefined): value is string {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//");
}

/**
 * Resolves where to send the user after login completes.
 *
 * Priority:
 *  1. ?returnTo= URL parameter (set by AuthGuard when redirecting to login)
 *  2. sessionStorage value (persisted before redirect to login or IdP)
 *  3. window.location.pathname (LDO restores original URL via history.replaceState
 *     after silent auth — Next.js router state is stale, but the browser URL is correct)
 *  4. homePath fallback
 */
function resolveReturnTo(
  searchParams: { get: (key: string) => string | null },
  loginPath: string,
  homePath: string,
): string {
  const fromParam = searchParams.get("returnTo");
  if (isValidReturnPath(fromParam)) return fromParam;

  if (typeof window === "undefined") return homePath;

  const fromStorage = storageGet(sessionStorage, RETURN_TO_KEY);
  if (isValidReturnPath(fromStorage)) return fromStorage;

  const browserPath = window.location.pathname;
  if (browserPath !== loginPath && browserPath !== homePath && isValidReturnPath(browserPath)) {
    return browserPath;
  }

  return homePath;
}

// ── Component ────────────────────────────────────────────────────────────────

export interface AuthGuardProps {
  children: ReactNode;
  /** Shown while session is being checked or OAuth callback is in progress */
  fallback?: ReactNode;
}

const defaultFallback = (
  <div
    style={{
      display: "flex",
      minHeight: "100vh",
      alignItems: "center",
      justifyContent: "center",
      background: "#fff",
    }}
  >
    <span>Loading...</span>
  </div>
);

function AuthGuardContent({
  children,
  fallback = defaultFallback,
}: AuthGuardProps) {
  // `ranInitialAuthCheck` defaults to `true` for backward compat with older
  // @ldo/solid-react versions that don't expose it. Current versions start at
  // `false` and flip to `true` after handleIncomingRedirect resolves.
  const { session, ranInitialAuthCheck = true } = useSolidAuth();
  const nav = useSolidLoginNavigation();

  // Derive route state from the navigation context (falls back to safe
  // defaults when the provider is missing so hooks always run).
  const pathname = nav?.navigation.getPathname() ?? "/";
  const searchParams = nav?.navigation.getSearchParams() ?? { has: () => false, get: () => null };
  const config = nav?.config ?? { loginPath: "/login", homePath: "/" };
  const isOAuthCallback = searchParams.has("code") || searchParams.has("state");
  const isLoginPage = pathname === config.loginPath;

  // Single redirect guard: prevents the same redirect from firing twice while
  // the previous one is still in flight (Next.js router.replace is async, so
  // the effect can re-run before the pathname has actually changed).
  const hasRedirectedRef = useRef(false);
  const prevPathnameRef = useRef(pathname);

  // Reset the guard when the pathname *actually* changes (the navigation we
  // triggered has completed, or the user navigated elsewhere).
  if (prevPathnameRef.current !== pathname) {
    prevPathnameRef.current = pathname;
    hasRedirectedRef.current = false;
  }

  // ── Effect: persist returnTo when arriving at /login?returnTo=… ──────────
  useEffect(() => {
    if (typeof window === "undefined" || !isLoginPage || session.isActive) return;
    const returnTo = searchParams.get("returnTo");
    if (isValidReturnPath(returnTo)) {
      storageSet(sessionStorage, RETURN_TO_KEY, returnTo);
    }
  }, [isLoginPage, session.isActive]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Effect: main redirect logic ──────────────────────────────────────────
  //
  // Deps are limited to the values that represent meaningful state transitions.
  // `navigation` is intentionally excluded — it's a new object on every render
  // in Next.js, which would cause infinite re-runs. We read it from the ref-
  // stable `nav` context inside the effect instead.
  useEffect(() => {
    if (!nav || !ranInitialAuthCheck || hasRedirectedRef.current) return;
    const { navigation } = nav;

    // Re-derive inside the effect so we don't depend on the outer closures
    // that change reference every render.
    const sp = navigation.getSearchParams();
    const path = navigation.getPathname();
    const isCallback = sp.has("code") || sp.has("state");
    const isLogin = path === config.loginPath;

    // 1. OAuth callback completed — redirect to the saved return path
    if (isCallback && session.isActive) {
      hasRedirectedRef.current = true;
      let target = resolveReturnTo(sp, config.loginPath, config.homePath);
      if (target === config.loginPath) target = config.homePath;
      storageRemove(sessionStorage, RETURN_TO_KEY);
      navigation.redirect(target);
      return;
    }

    // 2. Already logged in but still on /login — redirect away
    if (session.isActive && isLogin && !isCallback) {
      hasRedirectedRef.current = true;
      let target = resolveReturnTo(sp, config.loginPath, config.homePath);
      if (target === config.loginPath) target = config.homePath;
      storageRemove(sessionStorage, RETURN_TO_KEY);
      navigation.replace(target);
      return;
    }

    // 3. Not logged in on a protected page — redirect to login
    if (!session.isActive && !isLogin && !isCallback) {
      hasRedirectedRef.current = true;
      const current = path || "/";
      if (current !== config.loginPath && current !== config.homePath) {
        storageSet(sessionStorage, RETURN_TO_KEY, current);
      }
      const loginUrl =
        current === config.loginPath || current === config.homePath
          ? config.loginPath
          : `${config.loginPath}?returnTo=${encodeURIComponent(current)}`;
      navigation.replace(loginUrl);
    }
  }, [ranInitialAuthCheck, session.isActive, pathname, nav, config.loginPath, config.homePath]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Render ───────────────────────────────────────────────────────────────

  if (!nav) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        "@solid/react-component: AuthGuard requires SolidLoginNavigationProvider " +
        "(or use '@solid/react-component/login/next')",
      );
    }
    return <>{children}</>;
  }

  if (!ranInitialAuthCheck) return <>{fallback}</>;
  if (isOAuthCallback) return <>{fallback}</>;
  if (!session.isActive && !isLoginPage) return null;
  if (session.isActive && isLoginPage) return null;

  return <>{children}</>;
}

export function AuthGuard(props: AuthGuardProps) {
  return (
    <Suspense fallback={props.fallback ?? defaultFallback}>
      <AuthGuardContent {...props} />
    </Suspense>
  );
}
