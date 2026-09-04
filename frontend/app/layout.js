import "./globals.css";

export const metadata = {
  title: "FaceChain — Content Verification Ledger",
  description: "Reverse-image search, face match, and on-chain content provenance verification.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen font-sans antialiased text-[15px] text-parchment">
        <div className="relative mx-auto max-w-7xl px-4 pb-16 pt-8 sm:px-6 lg:px-8">{children}</div>
      </body>
    </html>
  );
}
