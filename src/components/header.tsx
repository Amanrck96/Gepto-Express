
'use client'; // Needed for useState

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ShoppingCart, User, Package, Coins } from 'lucide-react'; // Added Package for Orders and Coins for Wallet

export function Header() {
  // Simple client-side state for the wallet balance for now
  // In a real app, this would come from user data/API
  const [geptoCoins, setGeptoCoins] = useState(100);

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center">
        <Link href="/" className="mr-6 flex items-center space-x-2">
          {/* Placeholder for Logo - Replace with actual SVG or Image */}
           <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6 text-primary">
              <path d="M12 2L2 7l10 5 10-5-10-5z"/>
              <path d="M2 17l10 5 10-5"/>
              <path d="M2 12l10 5 10-5"/>
           </svg>
          <span className="font-bold text-lg text-primary">Gepto Express</span>
        </Link>
        <nav className="flex flex-1 items-center justify-end space-x-2">
           {/* Gepto Coin Wallet Display */}
           <div className="flex items-center space-x-1 mr-2 text-sm font-medium text-muted-foreground">
             <Coins className="h-5 w-5 text-yellow-500" />
             <span>{geptoCoins}</span>
           </div>

           {/* Other navigation items */}
           <Button variant="ghost" size="icon" aria-label="Orders">
             <Package className="h-5 w-5" />
           </Button>
           <Button variant="ghost" size="icon" aria-label="Shopping Cart">
             <ShoppingCart className="h-5 w-5" />
             {/* Add badge for cart count later */}
           </Button>
           <Button variant="ghost" size="icon" aria-label="User Profile">
             <User className="h-5 w-5" />
           </Button>
        </nav>
      </div>
    </header>
  );
}
