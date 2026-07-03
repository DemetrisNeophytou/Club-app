import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "Portal Venues",
  description: "Πούλα εισιτήρια, διαχειρίσου guestlists, σκάναρε στην πόρτα.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="el" className="dark">
      <body className="min-h-screen bg-abyss text-bone antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
