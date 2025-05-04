import type { Metadata } from 'next';
import { Inter } from 'next/font/google'; // Changed font to Inter for a modern look
import './globals.css';
import { Toaster } from '@/components/ui/toaster'; // Import Toaster
import { Header } from '@/components/header'; // Import Header
import { Footer } from '@/components/footer'; // Import Footer

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'Gepto Express',
  description: 'On-demand grocery delivery in Cooch Behar',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <body className={`font-sans antialiased flex flex-col min-h-screen`}>
        <Header />
        <main className="flex-grow container mx-auto px-4 py-8">
          {children}
        </main>
        <Footer />
        <Toaster /> {/* Add Toaster component here */}
      </body>
    </html>
  );
}
