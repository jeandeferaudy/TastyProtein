"use client";

import * as React from "react";
import { supabase } from "@/lib/supabase";
import { AppButton, TOPBAR_FONT_SIZE } from "@/components/ui";

type Props = {
  isOpen: boolean;
  onClose: () => void;
};

export default function AuthModal({ isOpen, onClose }: Props) {
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

  const clearStatus = () => {
    setMsg("");
    setErr("");
  };

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

  if (!isOpen) return null;

  const signIn = async () => {
    clearStatus();
    setLoadingAction("login");
    try {
      if (!email.trim()) throw new Error("Email is required.");
      if (!password.trim()) throw new Error("Password is required.");

      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) throw error;
      onClose();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Authentication failed.");
    } finally {
      setLoadingAction(null);
    }
  };

  const signUp = async () => {
    clearStatus();
    setLoadingAction("signup");
    try {
      if (!email.trim()) throw new Error("Email is required.");
      if (!password.trim()) throw new Error("Password is required.");
      const redirectTo =
        typeof window !== "undefined"
          ? `${window.location.origin}${window.location.pathname}`
          : process.env.NEXT_PUBLIC_SITE_URL;
      const { error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: redirectTo ? { emailRedirectTo: redirectTo } : undefined,
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
      setMsg("Account created. Check your email to confirm.");
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Sign up failed.");
    } finally {
      setLoadingAction(null);
    }
  };

  const sendReset = async () => {
    clearStatus();
    setLoadingAction("reset");
    try {
      if (!email.trim()) throw new Error("Email is required.");
      const redirectTo =
        typeof window !== "undefined"
          ? `${window.location.origin}${window.location.pathname}`
          : process.env.NEXT_PUBLIC_SITE_URL;
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: redirectTo ?? undefined,
      });
      if (error) throw error;
      setMsg("Password reset email sent. Check your inbox.");
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Password reset failed.");
    } finally {
      setLoadingAction(null);
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
            {mode === "update" || mode === "reset" ? "RESET PASSWORD" : "WELCOME"}
          </div>
          {mode === "update" ? null : (
            <AppButton variant="ghost" style={styles.closeBtn} onClick={onClose}>
              CLOSE
            </AppButton>
          )}
        </div>

        {mode === "login" ? (
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
            <AppButton
              style={styles.primaryBtn}
              disabled={loadingAction === "login"}
              onClick={signIn}
            >
              {loadingAction === "login" ? "PLEASE WAIT..." : "LOGIN"}
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
              disabled={loadingAction === "signup"}
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
            <AppButton
              style={styles.primaryBtn}
              disabled={loadingAction === "reset"}
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
    zIndex: 1200,
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
    zIndex: 1210,
    padding: 16,
    color: "white",
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
  msg: {
    marginTop: 10,
    color: "var(--tp-accent)",
    fontSize: 15,
    textAlign: "center",
  },
  err: {
    marginTop: 8,
    color: "#ff9f9f",
    fontSize: 15,
  },
};
