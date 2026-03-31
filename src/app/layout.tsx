import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import "@arco-design/web-react/dist/css/arco.css";
// Import AG Grid Styles Globally
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-quartz.css';
import { cn } from "@/lib/utils";

import { MainLayout } from "@/components/layout/MainLayout";
import ThemeRegistry from "@/components/ThemeRegistry/ThemeRegistry";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "纷享销客工具库",
  description: "Cross-platform data import for FxCRM",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={cn(
        "min-h-screen bg-background font-sans antialiased",
        inter.variable
      )}>
        <ThemeRegistry>
          <MainLayout>
            {children}
          </MainLayout>
        </ThemeRegistry>
      </body>
    </html>
  );
}
