import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Fluxo — Seu dinheiro, com direção",
  description: "Clareza para organizar suas finanças e conquistar suas metas.",
  icons: { icon: "/favicon.svg" },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
