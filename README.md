# @solid/react-component

Reusable React components for [Solid](https://solidproject.org/) apps. One package that will grow to include login, profile, and other components—so you depend on a single library instead of many.

**Currently included:**

- **Login** – Solid OIDC login UI and auth guard. Two-column layout (branding + form), combobox-style provider picker, optional footer links. Next.js adapter included.

---

## Table of Contents

- [Requirements](#requirements)
- [Installation](#installation)
- [Quick Start – Next.js](#quick-start--nextjs)
- [Quick Start – Any React App](#quick-start--any-react-app)
- [How Auth and Redirects Work](#how-auth-and-redirects-work)
- [SolidLoginPage – Props Reference](#solidloginpage--props-reference)
- [Customizing the Login Page](#customizing-the-login-page)
- [Import Paths](#import-paths)
- [Headless Login](#headless-login)
- [AuthGuard – Fallback](#authguard--fallback)
- [Package Structure](#package-structure)
- [Contributing](#contributing)
- [License](#license)

---

## Requirements

| Dependency | Version | Notes |
|---|---|---|
| **React** | 18+ | |
| **[@ldo/solid-react](https://www.npmjs.com/package/@ldo/solid-react)** | ≥ 1.0.0-alpha.50 | Your app must be wrapped in `BrowserSolidLdoProvider` |
| **Next.js** *(optional)* | 13+ (App Router) | Only needed for the Next.js adapter |

---

## Installation

```bash
npm i @solid/react-component @ldo/solid-react react
```

For Next.js apps:

```bash
npm i @solid/react-component @ldo/solid-react next react
```

---

## Quick Start – Next.js

### 1. Wrap the app with LDO’s provider

Your app must use `BrowserSolidLdoProvider` from `@ldo/solid-react` so session and login work.

```tsx
// app/layout.tsx
import { BrowserSolidLdoProvider } from "@ldo/solid-react";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <BrowserSolidLdoProvider>{children}</BrowserSolidLdoProvider>
      </body>
    </html>
  );
}
```

### 2. Protect routes with the auth guard

Wrap the part of the tree that requires authentication in **Suspense**, **SolidLoginNavigationProviderNext**, and **AuthGuard**. Use the same config for both the home page and the login page.

**Config:**

- `loginPath` – Path to your login page (e.g. `"/login"`). Unauthenticated users are redirected here.
- `homePath` – Path after login when there is no `returnTo` (e.g. `"/"`).

```tsx
// app/page.tsx (home or any protected page)
"use client";

import { Suspense } from "react";
import { SolidLoginNavigationProviderNext, AuthGuard } from "@solid/react-component/login/next";

const loadingFallback = (
  <div style={{ display: "flex", minHeight: "100vh", alignItems: "center", justifyContent: "center" }}>
    <span>Loading...</span>
  </div>
);

export default function Home() {
  return (
    <Suspense fallback={loadingFallback}>
      <SolidLoginNavigationProviderNext config={{ loginPath: "/login", homePath: "/" }}>
        <AuthGuard fallback={loadingFallback}>
          <YourMainApp />
        </AuthGuard>
      </SolidLoginNavigationProviderNext>
    </Suspense>
  );
}
```

### 3. Add the login page

Render **SolidLoginPage** on your login route. Pass the **logo** from your app (the package does not ship assets). You can also pass **footer** URLs so the default footer shows "GitHub" and "Report an issue" links.

```tsx
// app/login/page.tsx
"use client";

import { Suspense } from "react";
import { useRouter } from "next/navigation";
import {
  SolidLoginNavigationProviderNext,
  AuthGuard,
  SolidLoginPage,
} from "@solid/react-component/login/next";

const loadingFallback = (
  <div style={{ display: "flex", minHeight: "100vh", alignItems: "center", justifyContent: "center" }}>
    <span>Loading...</span>
  </div>
);

export default function Login() {
  const router = useRouter();

  return (
    <Suspense fallback={loadingFallback}>
      <SolidLoginNavigationProviderNext config={{ loginPath: "/login", homePath: "/" }}>
        <AuthGuard fallback={loadingFallback}>
          <SolidLoginPage
            onAlreadyLoggedIn={() => router.replace("/")}
            redirectUrl="http://localhost:3000"
            logo="/your-logo.svg"
            logoAlt="My App Logo"
            title="Sign in"
            subtitle="to continue to My App"
            footerGitHubUrl="https://github.com/your-org/your-app"
            footerIssuesUrl="https://github.com/your-org/your-app/issues/new"
          />
        </AuthGuard>
      </SolidLoginNavigationProviderNext>
    </Suspense>
  );
}
```

### Custom redirect after login

By default, the IdP redirects back to the login page URL after authentication. If you want the user to land on a different page (e.g. your home page with a query param), pass `redirectUrl`:

```tsx
<SolidLoginPage
  redirectUrl={`${window.location.origin}/?showModal=true`}
  onAlreadyLoggedIn={() => router.replace("/")}
  logo="/logo.svg"
  title="Sign in"
  subtitle="to continue to My App"
/>
```

This tells the IdP to send the user straight to `/?showModal=true` instead of back to `/login`, avoiding a visible bounce through the login page.

### 4. Next.js config (recommended)

If you use the package from npm, add it to `transpilePackages` so Next resolves the package’s subpath exports correctly:

```ts
// next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@solid/react-component"],
};

export default nextConfig;
```

---

## Quick Start – Any React App

If you're **not** using Next.js, provide your own navigation implementation via `SolidLoginNavigationProvider`:

```tsx
import {
  SolidLoginNavigationProvider,
  AuthGuard,
  SolidLoginPage,
} from "@solid/react-component/login";
import type { SolidLoginNavigation } from "@solid/react-component/login";

const navigation: SolidLoginNavigation = {
  getPathname: () => window.location.pathname,
  getSearchParams: () => new URLSearchParams(window.location.search),
  replace: (path) => window.history.replaceState(null, "", path),
  redirect: (path) => { window.location.href = path; },
};

function App() {
  return (
    <SolidLoginNavigationProvider
      navigation={navigation}
      config={{ loginPath: "/login", homePath: "/" }}
    >
      <AuthGuard>
        <YourMainApp />
      </AuthGuard>
    </SolidLoginNavigationProvider>
  );
}
```

> **Note:** You are responsible for calling your router's navigation methods inside `replace` and `redirect`. The example above uses basic browser APIs, but you can plug in React Router, TanStack Router, etc.

---

## How auth and redirects work

### Session restore on refresh

The guard uses **LDO’s `ranInitialAuthCheck`** from `useSolidAuth()`. It shows the loading fallback until the initial auth check (including session restore from storage) has finished. Only then does it decide whether to redirect to login. So **refreshing while already logged in does not send you to the login page**; you stay on the same URL.

See [LDO useSolidAuth](https://ldo.js.org/1.0.0-alpha.X/api/solid-react/useSolidAuth/) for `ranInitialAuthCheck`.

### returnTo (deep link back after login)

- When an unauthenticated user hits a protected path (e.g. `/dashboard/settings`), the guard redirects to `/login?returnTo=%2Fdashboard%2Fsettings`.
- After successful login (including after the OAuth redirect), the guard redirects to the `returnTo` path if it’s present and safe (starts with `/`, not `//`). If the IdP strips query params on callback, the package stores `returnTo` in `sessionStorage` when you land on the login page and uses it after the callback.
- If there is no valid `returnTo`, the user is sent to `homePath` (e.g. `"/"`).

---

## SolidLoginPage – props reference

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `onAlreadyLoggedIn` | `() => void` | — | Called when the user is already logged in. |
| `redirectUrl` | `string` | `window.location.href` | URL the IdP redirects back to after auth. |
| `logo` | `string` | — | URL to your logo image (e.g. `"/logo.svg"`). **Not shipped in the package.** |
| `logoAlt` | `string` | `"Logo"` | Alt text for the logo. |
| `title` | `string` | `"Sign in"` | Heading text. |
| `subtitle` | `string` | `"to continue"` | Subheading text. |
| `footerGitHubUrl` | `string` | — | Shows a "GitHub" footer link (requires `footerIssuesUrl` too). |
| `footerIssuesUrl` | `string` | — | Shows a "Report an issue" footer link. |
| `inputPlaceholder` | `string` | `"Enter your provider URL..."` | Placeholder for the provider input. |
| `inputLabel` | `string` | `"Solid Identity Provider"` | Label above the input. |
| `buttonLabel` | `string` | `"Next"` | Submit button text. |
| `buttonLoadingLabel` | `string` | `"Signing in..."` | Button text while loading. |
| `defaultIssuer` | `string` | — | Pre-fill the issuer input. |
| `presetIssuers` | `PresetIssuer[]` | Solid Community, Inrupt | Dropdown options. |
| `className` | `string` | — | Extra CSS class on the outer `<main>`. |
| `renderLogo` | `() => ReactNode` | — | Replace the default logo block. |
| `renderForm` | `(props) => ReactNode` | — | Replace the entire form (see [Headless login](#headless-login)). |
| `renderFooter` | `() => ReactNode` | — | Replace the default footer. |

---

## Customizing the login page

- **Logo:** Pass `logo="/path/to/logo.svg"` from your app’s `public` (or asset URL). The package does not include assets.
- **Footer links:** Set `footerGitHubUrl` and `footerIssuesUrl` to show the default "GitHub" and "Report an issue" links. Or use `renderFooter` for a custom footer.
- **Full custom form:** Use `renderForm` and receive `{ issuerInput, setIssuerInput, error, presetIssuers, isLoading, onSubmit, onIssuerChange }` to build your own UI while keeping auth logic.

---

## Import paths

| Import from | Use for |
|-------------|--------|
| `@solid/react-component/login/next` | Next.js: `SolidLoginNavigationProviderNext`, `AuthGuard`, `SolidLoginPage`. Use in App Router pages. |
| `@solid/react-component/login` | Core login: `AuthGuard`, `SolidLoginPage`, `useSolidLogin`, `LoginFormControl`, etc. You provide navigation via `SolidLoginNavigationProvider`. |
| `@solid/react-component` | Barrel; re-exports from the login entry. Prefer subpaths above for clearer imports. |

---

## Headless login

If you want your own UI and only need the auth logic:

```tsx
import { useSolidLogin, LoginFormControl, validateIssuerUrl } from "@solid/react-component/login";
```

- **`useSolidLogin({ defaultIssuer, presetIssuers, onAlreadyLoggedIn, redirectUrl })`** – Returns `session`, `issuerInput`, `setIssuerInput`, `isLoading`, `error`, `presetIssuers`, `validateAndSubmit`.
- **`LoginFormControl`** – Render-prop component that provides the same state and handlers to children.
- **`validateIssuerUrl(url)`** – Returns `{ valid: boolean, error: string | null }`.

---

## AuthGuard – fallback

`AuthGuard` accepts an optional **`fallback`** prop (e.g. a loading spinner). It is shown:

- Until LDO’s initial auth check has run (`ranInitialAuthCheck`).
- During the OAuth callback (when the URL has `code` and `state`).

> **Tip:** Use the same fallback on both protected pages and the login page for a seamless loading experience.

---

## Package structure

| Subpath | Contents |
|--------|----------|
| `@solid/react-component` | Re-exports (barrel). |
| `@solid/react-component/login` | Login: guard, page, hooks, types. |
| `@solid/react-component/login/next` | Login + Next.js adapter (provider + guard + page). |

Future components (e.g. profile) will follow the same pattern: `@solid/react-component/profile`, `@solid/react-component/profile/next`, etc.

---

## Contributing

```bash
# Install dependencies
npm install

# Run in dev/watch mode
npm run dev

# Run tests
npm test

# Build for production
npm run build
```

Bump `version` in `package.json` before each publish.

---

## License

MIT
