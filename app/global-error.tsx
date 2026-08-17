"use client";

import "@/styles/theme.css";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--background)",
          color: "var(--foreground)",
          fontFamily:
            "var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif",
          padding: 24,
          textAlign: "center",
        }}
      >
        <div style={{ maxWidth: 420 }}>
          <p
            style={{
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              fontSize: 12,
              color: "var(--muted-dim)",
            }}
          >
            500
          </p>
          <h1 style={{ fontSize: 24, margin: "12px 0" }}>
            Something went wrong
          </h1>
          <p
            style={{
              color: "var(--muted)",
              fontSize: 14,
              lineHeight: 1.6,
            }}
          >
            Carl hit a hard failure loading this screen. You can try again.
          </p>
          {error.digest ? (
            <p
              style={{
                color: "var(--muted-dim)",
                fontSize: 12,
                fontFamily: "monospace",
              }}
            >
              Ref: {error.digest}
            </p>
          ) : null}
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: 20,
              height: 44,
              padding: "0 16px",
              borderRadius: 12,
              border: "none",
              background: "var(--accent)",
              color: "var(--accent-foreground)",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
