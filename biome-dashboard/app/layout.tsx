import type { Metadata } from "next";
import { Providers } from "@/lib/providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Biome Dashboard",
  description: "BM 3.0 Admin Dashboard",
};

const themeInitScript = `
(function(){
  try {
    var raw = localStorage.getItem('biome-theme');
    var theme = 'light';
    if (raw) {
      var parsed = JSON.parse(raw);
      if (parsed && parsed.state && parsed.state.theme === 'dark') theme = 'dark';
    }
    if (theme === 'dark') document.documentElement.classList.add('dark');
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
