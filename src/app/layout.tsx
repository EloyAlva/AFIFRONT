import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "AFI · Asistente Financiero Inteligente",
  description:
    "Tus finanzas, con claridad. Ingresos, gastos, pagos y objetivos en un solo lugar.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
