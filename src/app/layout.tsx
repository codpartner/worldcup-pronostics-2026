import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Navbar } from "@/components/Navbar";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";
import { getSession } from "@/lib/auth";
import { Providers } from "./providers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CODPARTNER · World Cup 2026 Pronostics",
  description:
    "Internal score prediction pool for CODPARTNER during the FIFA World Cup 2026.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getSession();

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-background text-foreground">
        <Providers>
          <div className="app-shell flex min-h-screen flex-col">
            {session ? (
              <Navbar user={session} />
            ) : (
              <div className="flex justify-end px-4 pt-4">
                <ThemeSwitcher compact />
              </div>
            )}
            <div className="flex-1">{children}</div>
          </div>
        </Providers>
      </body>
    </html>
  );
}
