import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PodcastAI Studio",
  description: "Turn any URL into a natural AI podcast episode.",
  icons:{
  icon: "/reading.svg"
  }
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
