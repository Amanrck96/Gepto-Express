
'use client'; 

import { useState, useEffect } from 'react'; // Import useEffect
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ShoppingCart, User, Package, Coins, LogIn, Shield } from 'lucide-react'; // Added Shield for Admin
import { useAuth } from '@/context/AuthContext'; // Import useAuth
import Image from 'next/image'; // Import Next Image for profile picture

export function Header() {
  const { user, loading } = useAuth();
  const [geptoCoins, setGeptoCoins] = useState(0); // Default to 0, fetch if user logged in

  useEffect(() => {
    if (user) {
      // TODO: Fetch user-specific Gepto Coins from Firestore or your backend
      // For now, using a placeholder value if user is logged in.
      setGeptoCoins(100); 
    } else {
      setGeptoCoins(0); // Reset coins if no user
    }
  }, [user]); // Re-run when user object changes

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center">
        <Link href="/" className="mr-6 flex items-center space-x-2">
           <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6 text-primary">
              <path d="M12 2L2 7l10 5 10-5-10-5z"/>
              <path d="M2 17l10 5 10-5"/>
              <path d="M2 12l10 5 10-5"/>
           </svg>
          <span className="font-bold text-lg text-primary">Gepto Express</span>
        </Link>
        <nav className="flex flex-1 items-center justify-end space-x-2">
           <div className="flex items-center space-x-1 mr-2 text-sm font-medium text-muted-foreground">
             <Coins className="h-5 w-5 text-yellow-500" />
             <span>{geptoCoins}</span>
           </div>

           <Button variant="ghost" size="icon" aria-label="Orders" asChild>
             <Link href="/orders">
               <Package className="h-5 w-5" />
             </Link>
           </Button>
           <Button variant="ghost" size="icon" aria-label="Shopping Cart">
             <ShoppingCart className="h-5 w-5" /> {/* This can link to /cart or manage cart state */}
           </Button>
           
           <Button variant="ghost" size="icon" aria-label="User Profile" asChild>
             <Link href="/profile">
               {loading ? (
                 <User className="h-5 w-5 animate-pulse" /> 
               ) : user && user.photoURL ? (
                  <Image 
                    src={user.photoURL} 
                    alt="User Avatar" 
                    width={24} 
                    height={24} 
                    className="rounded-full"
                    data-ai-hint="user avatar" 
                  />
               ) : user ? (
                 <User className="h-5 w-5" /> 
               ) : (
                 <LogIn className="h-5 w-5" /> 
               )}
             </Link>
           </Button>
           {/* TODO: Conditionally render this Admin link based on user role in the future */}
           <Button variant="ghost" size="icon" aria-label="Admin Panel" asChild>
             <Link href="/admin">
               <Shield className="h-5 w-5" />
             </Link>
           </Button>
        </nav>
      </div>
    </header>
  );
}

