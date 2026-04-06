"use client";

import * as React from "react";
import type { CustomerInvite } from "@/lib/customerInvite";
import {
  ensureCustomerForAccountSignup,
  linkProfileToCustomer,
} from "@/lib/customersApi";
import { supabase } from "@/lib/supabase";
import { AppButton, TOPBAR_FONT_SIZE } from "@/components/ui";

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: string | HTMLElement,
        options: {
          sitekey: string;
          callback?: (token: string) => void;
          "expired-callback"?: () => void;
          "error-callback"?: () => void;
          theme?: "light" | "dark" | "auto";
          size?: "normal" | "compact" | "flexible";
        }
      ) => string;
      reset: (widgetId?: string) => void;
      remove: (widgetId: string) => void;
    };
  }
}

type Props = {
  isOpen: boolean;
  onClose: () => void;
  recoveryNonce?: number;
  invite?: CustomerInvite | null;
  onAuthenticated?: () => void;
};

export default function AuthModal({
  isOpen,
  onClose,
  recoveryNonce = 0,
  invite = null,
  onAuthenticated,
}: Props) {
  const isInviteFlow = Boolean(invite?.customerId);
  const turnstileSiteKey = String(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "").trim();
  const shouldUseCaptcha = turnstileSiteKey.length > 0;
  const [phoneVerification, setPhoneVerification] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);
  const [loadingAction, setLoadingAction] = React.useState<
    "login" | "signup" | "reset" | "update" | null
  >(null);
  const [msg, setMsg] = React.useState("");
  const [err, setErr] = React.useState("");
  const [mode, setMode] = React.useState<"login" | "reset" | "update">("login");
  const [captchaToken, setCaptchaToken] = React.useState("");
  const [turnstileReady, setTurnstileReady] = React.useState(false);
  const turnstileContainerRef = React.useRef<HTMLDivElement | null>(null);
  const turnstileWidgetIdRef = React.useRef<string | null>(null);
  const captchaPending = shouldUseCaptcha && (!turnstileReady || !captchaToken);

  const clearStatus = () => {
    setMsg("");
    setErr("");
  };

  const normalizeInvitePhone = React.useCallback((value: string | null | undefined) => {
    const digits = String(value ?? "").replace(/\D/g, "");
    if (!digits) return "";
    if (digits.startsWith("63") && digits.length >= 12) return digits.slice(2);
    if (digits.startsWith("0") && digits.length >= 11) return digits.slice(1);
    return digits;
  }, []);

  React.useEffect(() => {
    if (!isOpen) return;
    clearStatus();
    setMode("login");
    setPhoneVerification("");
    setPassword("");
    setConfirmPassword("");
    setEmail("");
  }, [invite?.customerId, isOpen]);

  React.useEffect(() => {
    const { data: subscription } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setMode("update");
        setMsg("");
        setErr("");
      }
    });
    return () => {
      subscription.subscription.unsubscribe();
    };
  }, []);

  React.useEffect(() => {
    if (!recoveryNonce) return;
    setMode("update");
    setMsg("");
    setErr("");
  }, [recoveryNonce]);

  const getAuthEmailRedirectTo = React.useCallback(() => {
    const configured = String(process.env.NEXT_PUBLIC_SITE_URL ?? "").trim();
    if (configured) return configured;
    if (typeof window === "undefined") return undefined;
    const { origin, pathname, hostname } = window.location;
    const isLocalhost =
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "::1";
    if (isLocalhost) return undefined;
    return `${origin}${pathname}`;
  }, []);

  const resetCaptcha = React.useCallback(() => {
    setCaptchaToken("");
    const widgetId = turnstileWidgetIdRef.current;
    if (!widgetId || !window.turnstile) return;
    window.turnstile.reset(widgetId);
  }, []);

  const removeCaptchaWidget = React.useCallback(() => {
    const widgetId = turnstileWidgetIdRef.current;
    if (widgetId && window.turnstile) {
      window.turnstile.remove(widgetId);
    }
    turnstileWidgetIdRef.current = null;
    setCaptchaToken("");
  }, []);

  React.useEffect(() => {
    if (!isOpen || !shouldUseCaptcha) return;
    if (window.turnstile) {
      setTurnstileReady(true);
      return;
    }

    const existing = document.querySelector<HTMLScriptElement>(
      'script[src^="https://challenges.cloudflare.com/turnstile/v0/api.js"]'
    );
    const handleReady = () => setTurnstileReady(true);

    if (existing) {
      existing.addEventListener("load", handleReady);
      return () => existing.removeEventListener("load", handleReady);
    }

    const script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.defer = true;
    script.addEventListener("load", handleReady);
    document.head.appendChild(script);

    return () => {
      script.removeEventListener("load", handleReady);
    };
  }, [isOpen, shouldUseCaptcha]);

  React.useEffect(() => {
    if (isOpen || !shouldUseCaptcha) return;
    setErr("");
    removeCaptchaWidget();
  }, [isOpen, removeCaptchaWidget, shouldUseCaptcha]);

  React.useEffect(() => {
    if (!shouldUseCaptcha || mode === "update") return;
    removeCaptchaWidget();
  }, [mode, removeCaptchaWidget, shouldUseCaptcha]);

  React.useEffect(() => {
    if (!isOpen || !shouldUseCaptcha || mode === "update") return;
    if (!turnstileReady || !window.turnstile || !turnstileContainerRef.current) return;
    if (turnstileWidgetIdRef.current) return;

    turnstileWidgetIdRef.current = window.turnstile.render(turnstileContainerRef.current, {
      sitekey: turnstileSiteKey,
      theme: "dark",
      size: "flexible",
      callback: (token: string) => {
        setCaptchaToken(token);
        setErr("");
      },
      "expired-callback": () => {
        setCaptchaToken("");
      },
      "error-callback": () => {
        setCaptchaToken("");
        setErr(
          "Captcha failed to load. Check that this domain is allowed in Cloudflare Turnstile and disable content blockers for this site."
        );
      },
    });
  }, [isOpen, mode, shouldUseCaptcha, turnstileReady, turnstileSiteKey]);

  React.useEffect(() => {
    return () => {
      removeCaptchaWidget();
    };
  }, [removeCaptchaWidget]);

  if (!isOpen) return null;

  const signIn = async () => {
    clearStatus();
    setLoadingAction("login");
    try {
      if (!email.trim() || !password.trim()) {
        throw new Error("Please fill in email and password.");
      }
      const normalizedEmail = email.trim().toLowerCase();
      if (shouldUseCaptcha && !captchaToken) {
        throw new Error("Please complete the captcha.");
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
        options: shouldUseCaptcha ? { captchaToken } : undefined,
      });
      if (error) throw error;
      const signedInUserId = data.user?.id ? String(data.user.id) : "";
      if (invite?.customerId && signedInUserId) {
        await linkProfileToCustomer(signedInUserId, invite.customerId).catch(() => null);
      }
      onClose();
      onAuthenticated?.();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Authentication failed.");
    } finally {
      setLoadingAction(null);
      if (shouldUseCaptcha) resetCaptcha();
    }
  };

  const signUp = async () => {
    clearStatus();
    setLoadingAction("signup");
    try {
      const typedPhone = normalizeInvitePhone(phoneVerification);
      if (isInviteFlow && !typedPhone) {
        throw new Error("Please confirm your phone number.");
      }
      if (!email.trim()) throw new Error("Email is required.");
      if (!password.trim()) throw new Error("Password is required.");
      if (shouldUseCaptcha && !captchaToken) {
        throw new Error("Please complete the captcha.");
      }
      const normalizedEmail = email.trim().toLowerCase();
      if (isInviteFlow) {
        const response = await fetch("/api/invite-signup", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            customerId: invite?.customerId,
            phone: typedPhone,
            email: normalizedEmail,
            password,
          }),
        });
        const payload = (await response.json()) as { ok?: boolean; error?: string };
        if (!response.ok || !payload.ok) {
          throw new Error(payload.error || "Sign up failed.");
        }
        const signIn = await supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password,
          options: shouldUseCaptcha ? { captchaToken } : undefined,
        });
        if (signIn.error) {
          throw new Error(
            signIn.error.message ||
              "Account was created, but we could not sign you in automatically."
          );
        }
        onClose();
        onAuthenticated?.();
        return;
      }

      const redirectTo = getAuthEmailRedirectTo();
      const { data, error } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          ...(redirectTo ? { emailRedirectTo: redirectTo } : null),
          ...(shouldUseCaptcha ? { captchaToken } : null),
        },
      });
      if (error) {
        const message = error.message || "Sign up failed.";
        const code = (error as { code?: string }).code || "";
        if (
          code === "user_already_exists" ||
          message.toLowerCase().includes("already registered")
        ) {
          throw new Error(
            "This email already has an account. Please key in the right password."
          );
        }
        throw error;
      }
      const newUserId = data.user?.id ? String(data.user.id) : "";
      if (newUserId) {
        const customerRecord = await ensureCustomerForAccountSignup({
          email: normalizedEmail,
          fullName: normalizedEmail,
        });
        await supabase
          .from("profiles")
          .upsert({ id: newUserId, customer_id: customerRecord.id }, { onConflict: "id" });
        await linkProfileToCustomer(newUserId, customerRecord.id).catch(() => null);
      }
      setMsg("Account created. Check your email to confirm.");
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Sign up failed.");
    } finally {
      setLoadingAction(null);
      if (shouldUseCaptcha) resetCaptcha();
    }
  };

  const sendReset = async () => {
    clearStatus();
    setLoadingAction("reset");
    try {
      if (!email.trim()) throw new Error("Email is required.");
      if (shouldUseCaptcha && !captchaToken) {
        throw new Error("Please complete the captcha.");
      }
      const redirectTo = getAuthEmailRedirectTo();
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: redirectTo ?? undefined,
        ...(shouldUseCaptcha ? { captchaToken } : null),
      });
      if (error) throw error;
      setMsg("Password reset email sent. Check your inbox.");
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Password reset failed.");
    } finally {
      setLoadingAction(null);
      if (shouldUseCaptcha) resetCaptcha();
    }
  };

  const updatePassword = async () => {
    clearStatus();
    setLoadingAction("update");
    try {
      if (!password.trim()) throw new Error("Password is required.");
      if (password.trim().length < 6) {
        throw new Error("Password must be at least 6 characters.");
      }
      if (password !== confirmPassword) {
        throw new Error("Passwords do not match.");
      }
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setMsg("Password updated. You can login now.");
      setMode("login");
      setPassword("");
      setConfirmPassword("");
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Password update failed.");
    } finally {
      setLoadingAction(null);
    }
  };

  return (
    <>
      <div style={styles.backdrop} onClick={onClose} />
      <div style={styles.modal} role="dialog" aria-modal="true" aria-label="Login or create account">
        <div style={styles.top}>
          <div style={styles.title}>
            {mode === "update" || mode === "reset"
              ? "RESET PASSWORD"
              : isInviteFlow
                ? "INVITATION TO CREATE YOUR ACCOUNT"
                : "WELCOME"}
          </div>
          {mode === "update" ? null : (
            <AppButton variant="ghost" style={styles.closeBtn} onClick={onClose}>
              CLOSE
            </AppButton>
          )}
        </div>
        {isInviteFlow && mode !== "update" ? (
          <div style={styles.inviteBanner}>Confirm your phone number</div>
        ) : null}

        {isInviteFlow && mode !== "update" ? (
          <div style={styles.form}>
            <input
              style={styles.input}
              value={phoneVerification}
              onChange={(e) => setPhoneVerification(e.target.value)}
              placeholder="Phone number"
              type="tel"
              autoComplete="tel"
            />
            <input
              style={styles.input}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              type="email"
              autoComplete="email"
            />
            <div style={styles.passwordField}>
              <input
                style={styles.input}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
              />
              <button
                type="button"
                style={styles.eyeBtn}
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                  <path
                    d="M12 5c-5 0-9 4.5-10 7 1 2.5 5 7 10 7s9-4.5 10-7c-1-2.5-5-7-10-7Zm0 11a4 4 0 1 1 0-8 4 4 0 0 1 0 8Z"
                    fill="currentColor"
                  />
                  <circle cx="12" cy="12" r="2.2" fill="currentColor" />
                </svg>
              </button>
            </div>
            {shouldUseCaptcha ? (
              <div key="invite-captcha" style={styles.turnstileWrap}>
                <div ref={turnstileContainerRef} style={styles.turnstileContainer} />
                {!turnstileReady ? (
                  <div style={styles.turnstileHint}>Loading captcha…</div>
                ) : null}
              </div>
            ) : null}
            <AppButton
              style={{
                ...styles.primaryBtn,
                ...(shouldUseCaptcha ? styles.primaryBtnAfterCaptcha : null),
              }}
              disabled={loadingAction === "signup" || captchaPending}
              onClick={signUp}
            >
              {loadingAction === "signup" ? "PLEASE WAIT..." : "CREATE ACCOUNT"}
            </AppButton>
          </div>
        ) : mode === "login" ? (
          <div style={styles.form}>
            <input
              style={styles.input}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              type="email"
            />
            <div style={styles.passwordField}>
              <input
                style={styles.input}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                type={showPassword ? "text" : "password"}
              />
              <button
                type="button"
                style={styles.eyeBtn}
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                  <path
                    d="M12 5c-5 0-9 4.5-10 7 1 2.5 5 7 10 7s9-4.5 10-7c-1-2.5-5-7-10-7Zm0 11a4 4 0 1 1 0-8 4 4 0 0 1 0 8Z"
                    fill="currentColor"
                  />
                  <circle cx="12" cy="12" r="2.2" fill="currentColor" />
                </svg>
              </button>
            </div>
            {shouldUseCaptcha ? (
              <div key={`${mode}-captcha`} style={styles.turnstileWrap}>
                <div ref={turnstileContainerRef} style={styles.turnstileContainer} />
                {!turnstileReady ? (
                  <div style={styles.turnstileHint}>Loading captcha…</div>
                ) : null}
              </div>
            ) : null}
            <AppButton
              style={{
                ...styles.primaryBtn,
                ...(shouldUseCaptcha ? styles.primaryBtnAfterCaptcha : null),
              }}
              disabled={loadingAction === "login" || captchaPending}
              onClick={signIn}
            >
              {loadingAction === "login"
                ? "PLEASE WAIT..."
                : invite?.customerId
                  ? "LOGIN TO CONTINUE"
                  : "LOGIN"}
            </AppButton>

            <button
              type="button"
              style={styles.forgotLink}
              onClick={() => {
                clearStatus();
                setMode("reset");
              }}
            >
              Forgot password?
            </button>

            <div style={styles.orText}>or</div>

            <AppButton
              variant="ghost"
              style={styles.primaryBtn}
              disabled={loadingAction === "signup" || captchaPending}
              onClick={signUp}
            >
              {loadingAction === "signup" ? "PLEASE WAIT..." : "CREATE ACCOUNT"}
            </AppButton>
          </div>
        ) : mode === "reset" ? (
          <div style={styles.form}>
            <input
              style={styles.input}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              type="email"
            />
            {shouldUseCaptcha ? (
              <div key={`${mode}-captcha`} style={styles.turnstileWrap}>
                <div ref={turnstileContainerRef} style={styles.turnstileContainer} />
                {!turnstileReady ? (
                  <div style={styles.turnstileHint}>Loading captcha…</div>
                ) : null}
              </div>
            ) : null}
            <AppButton
              style={styles.primaryBtn}
              disabled={loadingAction === "reset" || captchaPending}
              onClick={sendReset}
            >
              {loadingAction === "reset" ? "PLEASE WAIT..." : "SEND"}
            </AppButton>
            <AppButton
              variant="ghost"
              style={styles.primaryBtn}
              disabled={loadingAction === "reset"}
              onClick={() => {
                clearStatus();
                setMode("login");
              }}
            >
              BACK
            </AppButton>
          </div>
        ) : (
          <div style={styles.form}>
            <div style={styles.passwordField}>
              <input
                style={styles.input}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="New password"
                type={showPassword ? "text" : "password"}
              />
              <button
                type="button"
                style={styles.eyeBtn}
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                  <path
                    d="M12 5c-5 0-9 4.5-10 7 1 2.5 5 7 10 7s9-4.5 10-7c-1-2.5-5-7-10-7Zm0 11a4 4 0 1 1 0-8 4 4 0 0 1 0 8Z"
                    fill="currentColor"
                  />
                  <circle cx="12" cy="12" r="2.2" fill="currentColor" />
                </svg>
              </button>
            </div>
            <div style={styles.passwordField}>
              <input
                style={styles.input}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                type={showConfirmPassword ? "text" : "password"}
              />
              <button
                type="button"
                style={styles.eyeBtn}
                onClick={() => setShowConfirmPassword((v) => !v)}
                aria-label={showConfirmPassword ? "Hide password" : "Show password"}
              >
                <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                  <path
                    d="M12 5c-5 0-9 4.5-10 7 1 2.5 5 7 10 7s9-4.5 10-7c-1-2.5-5-7-10-7Zm0 11a4 4 0 1 1 0-8 4 4 0 0 1 0 8Z"
                    fill="currentColor"
                  />
                  <circle cx="12" cy="12" r="2.2" fill="currentColor" />
                </svg>
              </button>
            </div>
            <AppButton
              style={styles.primaryBtn}
              disabled={loadingAction === "update"}
              onClick={updatePassword}
            >
              {loadingAction === "update" ? "PLEASE WAIT..." : "UPDATE PASSWORD"}
            </AppButton>
            <AppButton
              variant="ghost"
              style={styles.primaryBtn}
              disabled={loadingAction === "update"}
              onClick={() => {
                clearStatus();
                setMode("login");
              }}
            >
              BACK
            </AppButton>
          </div>
        )}

        {msg ? <div style={styles.msg}>{msg}</div> : null}
        {err ? <div style={styles.err}>{err}</div> : null}
      </div>
    </>
  );
}

const styles: Record<string, React.CSSProperties> = {
  backdrop: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.72)",
    backdropFilter: "blur(3px)",
    WebkitBackdropFilter: "blur(3px)",
    zIndex: 4000,
  },
  modal: {
    position: "fixed",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    width: "min(92vw, 460px)",
    background: "#0f0f0f",
    border: "1px solid rgba(255,255,255,0.16)",
    borderRadius: 14,
    zIndex: 4010,
    padding: 16,
    color: "white",
    boxShadow: "0 18px 48px rgba(0,0,0,0.4)",
  },
  top: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  title: {
    fontSize: TOPBAR_FONT_SIZE,
    fontWeight: 900,
    letterSpacing: 2,
  },
  inviteBanner: {
    marginBottom: 12,
    color: "rgba(255,255,255,0.72)",
    fontSize: 14,
    lineHeight: 1.4,
  },
  closeBtn: {
    width: 68,
    minWidth: 68,
    height: 36,
    padding: 0,
    borderRadius: 8,
    fontSize: TOPBAR_FONT_SIZE,
    fontWeight: 700,
    letterSpacing: 1,
    textTransform: "uppercase",
    border: "none",
    background: "transparent",
    justifyContent: "flex-end",
    textAlign: "right",
  },
  form: {
    display: "grid",
    gap: 8,
  },
  input: {
    width: "100%",
    height: 40,
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.16)",
    background: "rgba(255,255,255,0.06)",
    color: "white",
    padding: "0 42px 0 15px",
  },
  primaryBtn: {
    width: "100%",
    height: 36,
    marginTop: 14,
    padding: "0 15px",
    borderRadius: 8,
    border: "1px solid var(--tp-cta-border)",
    background: "var(--tp-cta-bg)",
    color: "var(--tp-cta-fg)",
    fontSize: 15,
    fontWeight: 700,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  primaryBtnAfterCaptcha: {
    marginTop: 4,
  },
  forgotLink: {
    marginTop: 4,
    textAlign: "right",
    fontSize: 14,
    color: "#ffffff",
    background: "transparent",
    border: "none",
    cursor: "pointer",
    opacity: 0.8,
  },
  passwordField: {
    position: "relative",
  },
  eyeBtn: {
    position: "absolute",
    right: 10,
    top: "50%",
    transform: "translateY(-50%)",
    width: 24,
    height: 24,
    border: "none",
    background: "transparent",
    color: "rgba(255,255,255,0.75)",
    cursor: "pointer",
    padding: 0,
  },
  orText: {
    marginTop: 6,
    marginBottom: 2,
    textAlign: "center",
    fontSize: 15,
    opacity: 0.72,
  },
  turnstileWrap: {
    marginTop: 4,
    display: "flex",
    flexDirection: "column",
    alignItems: "stretch",
    justifyContent: "center",
    minHeight: 65,
    gap: 4,
    width: "100%",
  },
  turnstileContainer: {
    width: "100%",
  },
  turnstileHint: {
    fontSize: 13,
    color: "rgba(255,255,255,0.7)",
    textAlign: "center",
  },
  msg: {
    marginTop: 10,
    color: "#67bf8a",
    fontSize: 15,
    textAlign: "center",
  },
  err: {
    marginTop: 8,
    color: "var(--tp-accent)",
    fontSize: 15,
  },
};
