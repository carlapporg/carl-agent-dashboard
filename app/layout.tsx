import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import { AppProviders } from "@/components/providers/app-providers";
import "./globals.css";

/** Strips password-manager attrs before hydrate (stops blink loops in dev). */
const STRIP_EXTENSION_ATTRS = `
(function () {
  var ATTRS = ["bis_skin_checked", "bis_register"];
  function strip(node) {
    if (!node) return;
    for (var i = 0; i < ATTRS.length; i++) {
      if (node.removeAttribute) node.removeAttribute(ATTRS[i]);
    }
    if (!node.querySelectorAll) return;
    for (var a = 0; a < ATTRS.length; a++) {
      var list = node.querySelectorAll("[" + ATTRS[a] + "]");
      for (var j = 0; j < list.length; j++) list[j].removeAttribute(ATTRS[a]);
    }
  }
  strip(document.documentElement);
  var obs = new MutationObserver(function () {
    strip(document.documentElement);
  });
  obs.observe(document.documentElement, {
    attributes: true,
    subtree: true,
    attributeFilter: ATTRS,
  });
  setTimeout(function () { obs.disconnect(); }, 8000);
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
