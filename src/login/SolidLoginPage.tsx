"use client";

import {
  useState,
  useEffect,
  useRef,
  useMemo,
  useId,
  ReactNode,
} from "react";
import { useSolidLogin } from "./useSolidLogin";
import type { PresetIssuer } from "./useSolidLogin";

export interface SolidLoginPageProps {
  /** Redirect when already logged in (e.g. router.replace("/")) */
  onAlreadyLoggedIn?: () => void;
  /** URL the IdP should redirect back to after auth. Defaults to window.location.href (the login page). */
  redirectUrl: string;
  defaultIssuer?: string;
  presetIssuers?: PresetIssuer[];

  /** Logo: pass URL from the app (e.g. "/file-manager-logo.svg") - not shipped in package */
  logo?: string;
  logoAlt?: string;
  title?: string;
  subtitle?: string;
  inputPlaceholder?: string;
  inputLabel?: string;
  buttonLabel?: string;
  buttonLoadingLabel?: string;
  className?: string;

  /** Optional footer links (same as original GitHubLinks horizontal) */
  footerGitHubUrl?: string;
  footerIssuesUrl?: string;

  /** Slots: replace parts of the default UI */
  renderLogo?: () => ReactNode;
  renderForm?: (props: {
    issuerInput: string;
    setIssuerInput: (v: string) => void;
    error: string | null;
    presetIssuers: PresetIssuer[];
    isLoading: boolean;
    onSubmit: (e: React.FormEvent) => void;
    onIssuerChange: (v: string) => void;
  }) => ReactNode;
  renderFooter?: () => ReactNode;
}

const defaultTitle = "Sign in";
const defaultSubtitle = "to continue";

/** Inline SVG Chevron Down - matches heroicons 24 outline */
function ChevronDownIcon({
  open,
  style,
}: {
  open: boolean;
  style?: React.CSSProperties;
}) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{
        transform: open ? "rotate(180deg)" : "rotate(0deg)",
        transition: "transform 0.2s",
        ...style,
      }}
      aria-hidden
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

/** GitHub octocat icon - same path as original GitHubLinks */
function GitHubIcon({ style }: { style?: React.CSSProperties }) {
  return (
    <svg
      width="16"
      height="16"
      fill="currentColor"
      viewBox="0 0 24 24"
      aria-hidden
      style={style}
    >
      <path
        fillRule="evenodd"
        d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
        clipRule="evenodd"
      />
    </svg>
  );
}

/** Warning triangle icon - matches ExclamationTriangleIcon */
function ReportIssueIcon({ style }: { style?: React.CSSProperties }) {
  return (
    <svg
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden
      style={style}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
      />
    </svg>
  );
}

/** Loading spinner for button - minimal, no extra deps */
function ButtonSpinner() {
  return (
    <span
      style={{
        display: "inline-block",
        width: 14,
        height: 14,
        border: "2px solid transparent",
        borderTopColor: "currentColor",
        borderRadius: "50%",
        animation: "solid-login-spin 0.6s linear infinite",
        marginRight: 8,
        verticalAlign: "middle",
      }}
    />
  );
}

export function SolidLoginPage({
  onAlreadyLoggedIn,
  redirectUrl,
  defaultIssuer,
  presetIssuers,
  logo,
  logoAlt = "Logo",
  title = defaultTitle,
  subtitle = defaultSubtitle,
  inputPlaceholder = "Enter your provider URL or select from the list",
  inputLabel = "Solid Identity Provider",
  buttonLabel = "Next",
  buttonLoadingLabel = "Signing in...",
  className = "",
  footerGitHubUrl,
  footerIssuesUrl,
  renderLogo,
  renderForm,
  renderFooter,
}: SolidLoginPageProps) {
  const {
    session,
    issuerInput,
    setIssuerInput,
    isLoading,
    error,
    presetIssuers: presets,
    validateAndSubmit,
  } = useSolidLogin({ defaultIssuer, presetIssuers, redirectUrl });

  const [showDropdown, setShowDropdown] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const generatedId = useId();
  const inputId = `solid-login-combobox-${generatedId}`;
  const listboxId = `${inputId}-listbox`;

  useEffect(() => {
    if (session.isActive && onAlreadyLoggedIn) onAlreadyLoggedIn();
  }, [session.isActive, onAlreadyLoggedIn]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false);
      }
    };
    if (showDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showDropdown]);

  const filteredOptions = useMemo(() => {
    if (!issuerInput.trim()) return presets;
    const q = issuerInput.toLowerCase();
    return presets.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        o.value.toLowerCase().includes(q) ||
        (o.secondaryLabel && o.secondaryLabel.toLowerCase().includes(q))
    );
  }, [issuerInput, presets]);

  if (session.isActive) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    validateAndSubmit();
  };

  const handleSelect = (option: PresetIssuer) => {
    setIssuerInput(option.value);
    setShowDropdown(false);
    setHighlightedIndex(-1);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showDropdown) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        setShowDropdown(true);
        setHighlightedIndex(-1);
      }
      return;
    }
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev < filteredOptions.length - 1 ? prev + 1 : prev
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : prev));
        break;
      case "Enter":
        if (
          highlightedIndex >= 0 &&
          highlightedIndex < filteredOptions.length
        ) {
          e.preventDefault();
          handleSelect(filteredOptions[highlightedIndex]);
        }
        break;
      case "Escape":
        e.preventDefault();
        setShowDropdown(false);
        setHighlightedIndex(-1);
        break;
    }
  };

  const formProps = {
    issuerInput,
    setIssuerInput,
    error,
    presetIssuers: presets,
    isLoading,
    onSubmit: handleSubmit,
    onIssuerChange: setIssuerInput,
  };

  if (renderForm) {
    return (
      <main
        className={className}
        role="main"
        aria-label="Sign in page"
        style={{ display: "flex", minHeight: "100vh", background: "#fff" }}
      >
        {renderForm(formProps)}
      </main>
    );
  }

  const showFooter =
    renderFooter ||
    (footerGitHubUrl != null && footerIssuesUrl != null);

  return (
    <>
      <style>{`
        @keyframes solid-login-spin {
          to { transform: rotate(360deg); }
        }
        .solid-login-combobox-input:focus {
          border-color: #7B42F6;
          box-shadow: 0 0 0 1px #7B42F6;
        }
        @media (max-width: 1023px) {
          .solid-login-left-panel { display: none !important; }
          .solid-login-mobile-header { display: flex !important; }
        }
        @media (min-width: 1024px) {
          .solid-login-mobile-header { display: none !important; }
        }
        @media (min-width: 1024px) {
          .solid-login-right-panel { min-width: 450px; }
        }
      `}</style>
      <main
        className={className}
        role="main"
        aria-label="Sign in page"
        style={{
          display: "flex",
          flexDirection: "row",
          flexWrap: "wrap",
          minHeight: "100vh",
          background: "#fff",
        }}
      >
        {/* Left - Logo and branding (hidden on mobile) */}
        <section
          className="solid-login-left-panel"
          aria-label="Branding section"
          style={{
            display: "flex",
            flex: "1 1 50%",
            minWidth: 280,
            alignItems: "center",
            justifyContent: "center",
            borderRight: "1px solid #e5e7eb",
            background: "#F3EDFF",
            padding: "2rem",
          }}
        >
          <div style={{ maxWidth: "28rem", width: "100%" }}>
            <header
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 4,
              }}
            >
              {renderLogo ? (
                renderLogo()
              ) : logo ? (
                <div
                  style={{
                    width: 300,
                    height: 90,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <img
                    src={logo}
                    alt={logoAlt}
                    style={{ width: "100%", height: "100%", objectFit: "contain" }}
                  />
                </div>
              ) : null}
              <h1
                style={{
                  marginBottom: 2,
                  fontSize: "2.25rem",
                  fontWeight: 400,
                  color: "#000",
                }}
              >
                {title}
              </h1>
              <p style={{ fontSize: "1rem", color: "#4b5563" }}>{subtitle}</p>
            </header>
          </div>
        </section>

        {/* Right - Form */}
        <section
          className="solid-login-right-panel"
          aria-label="Sign in form section"
          style={{
            display: "flex",
            flex: "1 1 50%",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            background: "#fff",
            padding: "3rem 1rem",
            minWidth: 0,
            minHeight: 320,
          }}
        >
          <div style={{ width: "100%", maxWidth: "28rem" }}>
            {/* Mobile header (visible only on small screens) */}
            <header
              className="solid-login-mobile-header"
              style={{
                display: "none",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: "2rem",
              }}
            >
              {renderLogo ? (
                renderLogo()
              ) : logo ? (
                <div
                  style={{
                    width: 300,
                    height: 90,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: 8,
                  }}
                >
                  <img
                    src={logo}
                    alt={logoAlt}
                    style={{ width: "100%", height: "100%", objectFit: "contain" }}
                  />
                </div>
              ) : null}
              <h1
                style={{
                  marginBottom: 8,
                  fontSize: "1.875rem",
                  fontWeight: 400,
                  color: "#000",
                  textAlign: "center",
                }}
              >
                {title}
              </h1>
              <p style={{ fontSize: "1rem", color: "#4b5563", textAlign: "center" }}>
                {subtitle}
              </p>
            </header>

            <form
              onSubmit={handleSubmit}
              aria-label="Sign in form"
              noValidate
              style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}
            >
              <label
                htmlFor={inputId}
                style={{
                  display: "block",
                  marginBottom: 8,
                  fontSize: "0.875rem",
                  fontWeight: 500,
                  color: "#000",
                }}
              >
                {inputLabel}
              </label>

              {/* UrlCombobox-style: input + chevron, dropdown below */}
              <div style={{ position: "relative" }}>
                <input
                  ref={inputRef}
                  id={inputId}
                  type="text"
                  value={issuerInput}
                  onChange={(e) => setIssuerInput(e.target.value)}
                  onFocus={() => {
                    setShowDropdown(true);
                    setHighlightedIndex(-1);
                  }}
                  onKeyDown={handleKeyDown}
                  placeholder={inputPlaceholder}
                  disabled={isLoading}
                  aria-invalid={!!error}
                  aria-expanded={showDropdown}
                  aria-controls={listboxId}
                  aria-autocomplete="list"
                  aria-activedescendant={
                    highlightedIndex >= 0
                      ? `${inputId}-option-${highlightedIndex}`
                      : undefined
                  }
                  role="combobox"
                  autoComplete="off"
                  className="solid-login-combobox-input"
                  style={{
                    width: "100%",
                    height: 48,
                    paddingLeft: 16,
                    paddingRight: 40,
                    fontSize: "1rem",
                    color: "#000",
                    background: "#fff",
                    border: `1px solid ${error ? "#fca5a5" : "#d1d5db"}`,
                    borderRadius: 6,
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                  onBlur={() => { }}
                />
                <button
                  type="button"
                  onClick={() => {
                    setShowDropdown(!showDropdown);
                    inputRef.current?.focus();
                  }}
                  aria-label={showDropdown ? "Hide options" : "Show options"}
                  aria-expanded={showDropdown}
                  tabIndex={-1}
                  style={{
                    position: "absolute",
                    right: 12,
                    top: "50%",
                    transform: "translateY(-50%)",
                    padding: 0,
                    border: "none",
                    background: "none",
                    cursor: "pointer",
                    color: "#9ca3af",
                  }}
                >
                  <ChevronDownIcon open={showDropdown} />
                </button>

                {showDropdown && filteredOptions.length > 0 && (
                  <div
                    ref={dropdownRef}
                    id={listboxId}
                    role="listbox"
                    aria-label="Options"
                    style={{
                      position: "absolute",
                      zIndex: 10,
                      marginTop: 4,
                      width: "100%",
                      maxHeight: 240,
                      overflow: "auto",
                      border: "1px solid #e5e7eb",
                      borderRadius: 6,
                      background: "#fff",
                      boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05)",
                    }}
                  >
                    {filteredOptions.map((option, index) => (
                      <button
                        key={option.value}
                        id={`${inputId}-option-${index}`}
                        type="button"
                        role="option"
                        aria-selected={issuerInput === option.value}
                        onClick={() => handleSelect(option)}
                        onMouseEnter={() => setHighlightedIndex(index)}
                        style={{
                          width: "100%",
                          padding: "12px 16px",
                          textAlign: "left",
                          border: "none",
                          background:
                            highlightedIndex === index ? "#f3f4f6" : "transparent",
                          cursor: "pointer",
                          fontSize: "0.875rem",
                          color: "#111",
                        }}
                      >
                        <div style={{ fontWeight: 500, marginBottom: 2 }}>
                          {option.label}
                        </div>
                        {option.secondaryLabel && (
                          <div
                            style={{
                              fontSize: "0.75rem",
                              color: "#6b7280",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {option.secondaryLabel}
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {error && (
                <p
                  role="alert"
                  style={{ fontSize: "0.75rem", color: "#dc2626", marginTop: 4 }}
                >
                  {error}
                </p>
              )}

              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  paddingTop: 16,
                }}
              >
                <button
                  type="submit"
                  disabled={isLoading}
                  aria-busy={isLoading}
                  aria-label={
                    isLoading ? "Signing in, please wait" : "Continue to sign in"
                  }
                  style={{
                    padding: "8px 16px",
                    fontSize: "0.875rem",
                    fontWeight: 500,
                    color: "#fff",
                    background: isLoading ? "#d1d5db" : "#7B42F6",
                    border: "none",
                    borderRadius: 6,
                    cursor: isLoading ? "not-allowed" : "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    boxShadow: "none",
                  }}
                >
                  {isLoading ? (
                    <>
                      <ButtonSpinner />
                      {buttonLoadingLabel}
                    </>
                  ) : (
                    buttonLabel
                  )}
                </button>
              </div>
            </form>

            {showFooter && (
              <footer
                className="solid-login-footer-wrap"
                style={{
                  marginTop: "6rem",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-end",
                  width: "100%",
                }}
              >
                {renderFooter ? (
                  renderFooter()
                ) : (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 16,
                      fontSize: "0.875rem",
                      color: "#6b7280",
                    }}
                  >
                    <a
                      href={footerGitHubUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        color: "inherit",
                        textDecoration: "none",
                      }}
                      aria-label="View source code on GitHub"
                    >
                      <GitHubIcon />
                      <span>GitHub</span>
                    </a>
                    <span style={{ color: "#d1d5db" }}>·</span>
                    <a
                      href={footerIssuesUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        color: "inherit",
                        textDecoration: "none",
                      }}
                      aria-label="Report an issue on GitHub"
                    >
                      <ReportIssueIcon />
                      <span>Report an issue</span>
                    </a>
                  </div>
                )}
              </footer>
            )}
          </div>
        </section>
      </main>
    </>
  );
}
