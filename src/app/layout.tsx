import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Salary Management",
    template: "%s · Salary Management",
  },
  description: "HR salary management: employees, salary records, bulk imports and reports.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // `lang` is required for correct screen-reader pronunciation, and
    // `data-scroll-behavior="smooth"` opts back into the navigation scroll
    // override that Next 16 no longer applies by default.
    <html lang="en" data-scroll-behavior="smooth">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
