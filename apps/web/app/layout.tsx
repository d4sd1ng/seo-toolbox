import type { ReactNode } from "react";
import { bootPlugins } from "@/lib/plugins";

bootPlugins();

export const metadata = {
  title: "SEO Toolbox",
  description: "Modulare SEO-Toolbox, usability first.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="de">
      <body style={{ fontFamily: "ui-sans-serif, system-ui", margin: 0 }}>
        {children}
      </body>
    </html>
  );
}
