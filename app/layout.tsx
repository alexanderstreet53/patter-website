import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "patter. — Places your friends actually love.",
  description:
    "A social recommendations app for restaurants, bars, cafés, activities and hidden gems. See places from people you actually trust.",
  openGraph: {
    title: "patter.",
    description: "Places your friends actually love.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
