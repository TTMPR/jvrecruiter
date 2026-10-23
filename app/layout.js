import "./globals.css";

export const metadata = {
  title: "JVRecruit",
  description: "Confidential recruiting opportunities and recruiter workspace."
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
