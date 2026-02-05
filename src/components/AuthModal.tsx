"use client";

import * as React from "react";
import { supabase } from "@/lib/supabase";
import { AppButton } from "@/components/ui";

type Props = {
  isOpen: boolean;
  onClose: () => void;
};

export default function AuthModal({ isOpen, onClose }: Props) {
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [msg, setMsg] = React.useState("");
  const [err, setErr] = React.useState("");

  if (!isOpen) return null;

  const clearStatus = () => {
    setMsg("");
    setErr("");
  };

  const signIn = async () => {
    clearStatus();
    setLoading(true);
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
      setLoading(false);
    }
  };

  const signUp = async () => {
    clearStatus();
    setLoading(true);
    try {
      if (!email.trim()) throw new Error("Email is required.");
      if (!password.trim()) throw new Error("Password is required.");
      const { error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { emailRedirectTo: window.location.origin },
      });
      if (error) throw error;
      setMsg("Account created. Check your email to confirm.");
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Sign up failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div style={styles.backdrop} onClick={onClose} />
      <div style={styles.modal} role="dialog" aria-modal="true" aria-label="Login or create account">
        <div style={styles.top}>
          <div style={styles.title}>LOGIN</div>
          <AppButton variant="ghost" style={styles.closeBtn} onClick={onClose}>
            CLOSE
          </AppButton>
        </div>

        <div style={styles.form}>
          <input
            style={styles.input}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            type="email"
          />
          <input
            style={styles.input}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            type="password"
          />
          <AppButton style={styles.submitBtn} disabled={loading} onClick={signIn}>
            {loading ? "PLEASE WAIT..." : "SIGN IN"}
          </AppButton>

          <div style={styles.orText}>or</div>

          <AppButton variant="ghost" style={styles.submitBtn} disabled={loading} onClick={signUp}>
            {loading ? "PLEASE WAIT..." : "CREATE ACCOUNT"}
          </AppButton>
        </div>

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
    fontSize: 18,
    fontWeight: 900,
    letterSpacing: 2,
  },
  closeBtn: {
    height: 34,
    padding: "0 10px",
    borderRadius: 8,
    fontSize: 13,
    letterSpacing: 0.8,
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
    padding: "0 12px",
  },
  submitBtn: {
    marginTop: 4,
    height: 40,
    borderRadius: 10,
    padding: "0 12px",
    fontSize: 13,
    letterSpacing: 0.8,
  },
  orText: {
    marginTop: 6,
    marginBottom: 2,
    textAlign: "center",
    fontSize: 13,
    opacity: 0.72,
  },
  msg: {
    marginTop: 10,
    color: "#9de4b6",
    fontSize: 13,
  },
  err: {
    marginTop: 8,
    color: "#ff9f9f",
    fontSize: 13,
  },
};
