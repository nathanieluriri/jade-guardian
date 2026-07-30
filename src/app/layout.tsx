import type { Metadata } from "next";
import { cookies } from "next/headers";
import "../index.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "Cleanm Admin",
  description: "Cleanm admin frontend",
  icons: {
    icon: "/company_logo.png",
    shortcut: "/company_logo.png",
    apple: "/company_logo.png",
  },
  openGraph: {
    title: "Cleanm Admin",
    description: "Cleanm admin frontend",
    images: [{ url: "/company_logo.png" }],
  },
  twitter: {
    card: "summary",
    title: "Cleanm Admin",
    description: "Cleanm admin frontend",
    images: ["/company_logo.png"],
  },
};

export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const cookieTheme = cookieStore.get("theme")?.value;
  const initialTheme = cookieTheme === "dark" ? "dark" : "light";

  return (
    <html lang="en" className={initialTheme} style={{ colorScheme: initialTheme }}>
      <body suppressHydrationWarning>
        <Providers initialTheme={initialTheme}>{children}</Providers>
      </body>
    </html>
  );
}
