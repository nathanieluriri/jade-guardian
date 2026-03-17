import type { Metadata } from "next";
import "../index.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "Sentinel Admin",
  description: "Marcus cleaning admin frontend",
};

export const dynamic = "force-dynamic";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
