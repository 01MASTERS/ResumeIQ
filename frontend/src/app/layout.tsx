import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "ResumeIQ",
  description: "AI-Powered Resume Analysis",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} bg-slate-950 text-slate-200 antialiased selection:bg-indigo-500/30 selection:text-indigo-200`}>
        {children}
      </body>
    </html>
  );
}
