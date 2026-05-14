"use client";

import { ReactNode } from "react";
import { useSolidLogin } from "./useSolidLogin";

export interface LoginFormControlProps {
  children: (props: {
    issuerInput: string;
    setIssuerInput: (v: string) => void;
    isLoading: boolean;
    error: string | null;
    presetIssuers: { label: string; value: string; secondaryLabel?: string }[];
    onSubmit: (e: React.FormEvent) => void;
    onIssuerChange: (v: string) => void;
  }) => ReactNode;
  defaultIssuer?: string;
  presetIssuers?: { label: string; value: string; secondaryLabel?: string }[];
  redirectUrl: string;
}

export function LoginFormControl({
  children,
  defaultIssuer,
  presetIssuers,
  redirectUrl
}: LoginFormControlProps) {
  const {
    session,
    issuerInput,
    setIssuerInput,
    isLoading,
    error,
    presetIssuers: presets,
    validateAndSubmit,
  } = useSolidLogin({ defaultIssuer, presetIssuers, redirectUrl });

  if (session.isActive) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    validateAndSubmit();
  };

  return (
    <>
      {children({
        issuerInput,
        setIssuerInput,
        isLoading,
        error,
        presetIssuers: presets,
        onSubmit: handleSubmit,
        onIssuerChange: setIssuerInput,
      })}
    </>
  );
}
