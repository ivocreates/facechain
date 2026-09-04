import "./globals.css";

export const metadata = {
  title: "FaceChain — Content Verification Ledger",
  description: "Reverse-image search, face match, and on-chain content provenance verification.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen font-sans antialiased">{children}</body>
    </html>
  );
}
