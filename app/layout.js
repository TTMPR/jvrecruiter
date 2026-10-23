import "./globals.css";

export const metadata = {
  metadataBase: new URL("https://jvrecruiter.xyz"),
  title: {
    default: "JVRecruit | Technical, Product, Data & AI Opportunities",
    template: "%s | JVRecruit"
  },
  description: "Curated technical, product, data, AI and leadership opportunities with a thoughtful recruiting experience.",
  alternates: {
    canonical: "/"
  },
  openGraph: {
    type: "website",
    url: "https://jvrecruiter.xyz",
    siteName: "JVRecruit",
    title: "JVRecruit | Technical, Product, Data & AI Opportunities",
    description: "Curated technical, product, data, AI and leadership opportunities with a thoughtful recruiting experience."
  },
  twitter: {
    card: "summary_large_image",
    title: "JVRecruit | Technical, Product, Data & AI Opportunities",
    description: "Curated technical, product, data, AI and leadership opportunities with a thoughtful recruiting experience."
  },
  verification: {
    google: process.env.GOOGLE_SITE_VERIFICATION || undefined
  }
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
