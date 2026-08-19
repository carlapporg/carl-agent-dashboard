import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import { AppProviders } from "@/components/providers/app-providers";
import "./globals.css";

/** Strips password-manager attrs before/during hydrate (Bitwarden etc.). */
const STRIP_EXTENSION_ATTRS = `
(function () {
  var ATTRS = ["bis_skin_checked", "bis_register", "data-bwignore", "data-lpignore"];
  function strip(root) {
    if (!root) return;
    for (var i = 0; i < ATTRS.length; i++) {
      if (root.removeAttribute) root.removeAttribute(ATTRS[i]);
    }
    if (!root.querySelectorAll) return;
    for (var a = 0; a < ATTRS.length; a++) {
      var list = root.querySelectorAll("[" + ATTRS[a] + "]");
      for (var j = 0; j < list.length; j++) list[j].removeAttribute(ATTRS[a]);
    }
  }
  function run() {
    strip(document.documentElement);
    strip(document.body);
  }
  run();
  var obs = new MutationObserver(function () { run(); });
  function start() {
    run();
    if (document.documentElement) {
      obs.observe(document.documentElement, {
        attributes: true,
        subtree: true,
        attributeFilter: ATTRS,
        childList: true,
      });
    }
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
  setTimeout(function () { obs.disconnect(); }, 15000);
})();
`;

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Carl Agent Dashboard",
    template: "%s · Carl Agent Dashboard",
  },
  description: "Human concierge operations for Carl agents.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body
        className="flex min-h-full flex-col bg-background text-foreground"
        suppressHydrationWarning
      >
        <Script
          id="strip-extension-attrs"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: STRIP_EXTENSION_ATTRS }}
        />
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
