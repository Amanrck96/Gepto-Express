
'use client'; // Needed for hooks like useState, useEffect

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox'; // Import Checkbox
import { Label } from '@/components/ui/label'; // Import Label
import { ShoppingCart, MapPin, Search, Plus, Minus, Loader2, Coins } from 'lucide-react'; // Added Loader2 and Coins
import Image from 'next/image';
import type { Location } from '@/services/geocoding';
import type { Store } from '@/services/store';
import type { Category, Product } from '@/services/product';
import { getAddress, getLocation } from '@/services/geocoding';
import { getNearbyStores } from '@/services/store';
import { getProductCategories, getProductsByStoreAndCategory } from '@/services/product';
import { useToast } from '@/hooks/use-toast';
import { initiatePayment } from '@/actions/payment'; // Import the server action
// Removed incorrect import: import { load } from '@cashfreepayments/cashfree-js';
import Script from 'next/script'; // Import Next.js Script component


// Mock Cart Item Type - Export it so it can be used in actions/payment.ts
export interface CartItem extends Product {
  quantity: number;
}

export default function Home() {
  const [location, setLocation] = useState<Location | null>(null);
  const [address, setAddress] = useState<string>('');
  const [manualAddress, setManualAddress] = useState<string>('');
  const [stores, setStores] = useState<Store[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loadingLocation, setLoadingLocation] = useState(true);
  const [loadingStores, setLoadingStores] = useState(false);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [isCheckingOut, setIsCheckingOut] = useState(false); // State for checkout loading
  // const [cashfreeInstance, setCashfreeInstance] = useState<any>(null); // State no longer needed, use window.Cashfree directly
  const [geptoCoinBalance, setGeptoCoinBalance] = useState(100); // Mock balance
  const [useGeptoCoins, setUseGeptoCoins] = useState(false); // State for checkbox
  const [isCashfreeReady, setIsCashfreeReady] = useState(false); // Track if SDK is loaded


  const { toast } = useToast();

  // Determine Cashfree mode based on NEXT_PUBLIC_CASHFREE_APP_ID prefix
  const appId = process.env.NEXT_PUBLIC_CASHFREE_APP_ID;
  const isTestMode = appId?.startsWith('TEST');
  const cashfreeMode = isTestMode ? 'sandbox' : 'production'; // Use 'sandbox' for TEST keys

  // Use Cashfree v1 SDK URLs based on user examples and troubleshooting
  const cashfreeScriptSrc = isTestMode
    ? 'https://sdk.cashfree.com/js/v1/cashfree.sandbox.js' // v1 Sandbox script
    : 'https://sdk.cashfree.com/js/v1/cashfree.production.js'; // v1 Production script

  // Function called when the SDK script loads successfully
  const handleCashfreeScriptLoad = () => {
    console.log('Cashfree SDK (v1) script loaded successfully.');
    setIsCashfreeReady(true); // Mark SDK as ready
    // No need to explicitly initialize or store instance for v1 drop-in typically
  };


  // 1. Auto-detect location
  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          const detectedLocation = { lat: latitude, lng: longitude };
          setLocation(detectedLocation);
          try {
            const addr = await getAddress(detectedLocation);
             if (addr.formattedAddress.toLowerCase().includes('cooch behar')) {
               setAddress(addr.formattedAddress);
               toast({ title: "Location Detected", description: addr.formattedAddress });
             } else {
               setAddress("Service unavailable outside Cooch Behar");
               toast({ title: "Location Error", description: "Gepto Express serves Cooch Behar only.", variant: "destructive" });
               setLocation(null);
             }
          } catch (error) {
            console.error("Error fetching address:", error);
            setAddress("Could not fetch address");
            toast({ title: "Location Error", description: "Could not fetch address.", variant: "destructive" });
          } finally {
            setLoadingLocation(false);
          }
        },
        (error) => {
          console.error("Geolocation error:", error);
          setAddress("Location access denied. Please enter manually.");
          setLoadingLocation(false);
          toast({ title: "Location Access Denied", description: "Please enable location or enter address.", variant: "destructive" });
        }
      );
    } else {
      setAddress("Geolocation not available. Please enter manually.");
      setLoadingLocation(false);
      toast({ title: "Location Not Supported", description: "Enter address manually.", variant: "destructive" });
    }
  }, [toast]);

  // Function to handle manual address submission
  const handleManualAddressSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualAddress.trim()) {
      toast({ title: "Invalid Address", description: "Please enter address.", variant: "destructive" });
      return;
    }
    if (!manualAddress.toLowerCase().includes('cooch behar')) {
      toast({ title: "Service Area", description: "Gepto Express serves Cooch Behar only.", variant: "destructive" });
      setAddress("Service unavailable outside Cooch Behar");
      setLocation(null);
      return;
    }

    setLoadingLocation(true);
    try {
      // Append region for accuracy, assuming it's always Cooch Behar based on validation
      const fullAddress = manualAddress.toLowerCase().includes('cooch behar')
                          ? manualAddress
                          : `${manualAddress}, Cooch Behar, West Bengal, India`;
      const loc = await getLocation(fullAddress);
      setLocation(loc);
      setAddress(manualAddress); // Display the user's input
      toast({ title: "Location Set Manually", description: manualAddress });
    } catch (error) {
      console.error("Error fetching location:", error);
      setAddress("Could not find location.");
      setLocation(null);
      toast({ title: "Address Error", description: "Could not find location.", variant: "destructive" });
    } finally {
      setLoadingLocation(false);
    }
  };


  // 2. Fetch nearby stores based on location
  useEffect(() => {
    if (location && address.toLowerCase().includes('cooch behar')) {
      setLoadingStores(true);
      getNearbyStores(location, 5) // 5km radius
        .then(setStores)
        .catch(err => {
          console.error("Error fetching stores:", err);
          toast({ title: "Store Fetch Error", description: "Could not load stores.", variant: "destructive" });
        })
        .finally(() => setLoadingStores(false));
    } else {
      setStores([]);
    }
  }, [location, address, toast]);

  // 3. Fetch product categories
  useEffect(() => {
    setLoadingCategories(true);
    getProductCategories()
      .then(setCategories)
      .catch(err => {
        console.error("Error fetching categories:", err);
        toast({ title: "Category Fetch Error", description: "Could not load categories.", variant: "destructive" });
      })
      .finally(() => setLoadingCategories(false));
  }, [toast]);

  // 4. Fetch products when category and store selected
  useEffect(() => {
    if (selectedCategory && stores.length > 0) {
      setLoadingProducts(true);
      // Ensure stores[0].id is valid before fetching
       if (stores[0]?.id) {
           getProductsByStoreAndCategory(stores[0].id, selectedCategory.id) // Use first store's ID
           .then(setProducts)
           .catch(err => {
             console.error("Error fetching products:", err);
             toast({ title: "Product Fetch Error", description: `Could not load ${selectedCategory.name}.`, variant: "destructive" });
             setProducts([]);
           })
           .finally(() => setLoadingProducts(false));
       } else {
           console.warn("No valid store ID found to fetch products.");
           setLoadingProducts(false);
           setProducts([]);
       }
    } else {
      setProducts([]);
    }
  }, [selectedCategory, stores, toast]);

  // Cart Functions
  const addToCart = (product: Product) => {
    setCart(prevCart => {
      const existingItem = prevCart.find(item => item.id === product.id);
      if (existingItem) {
        return prevCart.map(item =>
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      } else {
        return [...prevCart, { ...product, quantity: 1 }];
      }
    });
    toast({ title: "Added to Cart", description: `${product.name} added.` });
  };

  const removeFromCart = (productId: string) => {
    setCart(prevCart => {
      const existingItem = prevCart.find(item => item.id === productId);
      if (existingItem && existingItem.quantity > 1) {
        return prevCart.map(item =>
          item.id === productId ? { ...item, quantity: item.quantity - 1 } : item
        );
      } else {
        return prevCart.filter(item => item.id !== productId);
      }
    });
     toast({ title: "Item Updated", description: `Cart updated.` });
  };

   const getCartTotal = () => {
    const total = cart.reduce((total, item) => total + item.price * item.quantity, 0);
    return Math.max(0, total);
   };

   const getFinalAmount = () => {
     const total = getCartTotal();
     if (useGeptoCoins) {
       const amountToCover = Math.min(total, geptoCoinBalance);
       return Math.max(0, total - amountToCover);
     }
     return total;
   };

  const getCartItemCount = () => {
    return cart.reduce((total, item) => total + item.quantity, 0);
  };

  // Checkout Function - Updated for v1 SDK Drop-in
  const handleCheckout = async () => {
     if (!isCashfreeReady || typeof window.Cashfree === 'undefined') {
       console.error("Cashfree SDK (v1) not ready yet.");
       toast({
         title: "Payment Error",
         description: "Payment interface not ready. Please wait or refresh.",
         variant: "destructive",
       });
       return;
     }

     if (cart.length === 0) {
       toast({ title: "Empty Cart", description: "Add items to cart first.", variant: "destructive" });
       return;
     }
     setIsCheckingOut(true);

     // --- Placeholder Customer Details ---
     const customerDetails = {
       customerId: `USER_${Math.random().toString(36).substring(2, 10)}`,
       customerEmail: 'test@example.com', // Use a valid-looking email for testing
       customerPhone: '9999999999', // Use a valid-looking phone number
       customerName: 'Test User'
     };
     // --- End Placeholder ---

     try {
       const total = getCartTotal();
       const finalAmount = getFinalAmount();

       console.log('Initiating payment server action...');
       const response = await initiatePayment({
         items: cart,
         totalAmount: total,
         customerDetails: customerDetails,
         useGeptoCoins: useGeptoCoins,
         geptoCoinBalance: geptoCoinBalance,
       });
       console.log('Server action response:', response);


       if (response.success && response.payment_session_id && response.order_id) {
         console.log('Payment session created:', response.payment_session_id);

         // Use the v1 Cashfree SDK drop-in checkout method
         const cf = window.Cashfree; // Access the global Cashfree object
         cf.checkout({
           paymentSessionId: response.payment_session_id,
           orderId: response.order_id,
           // Add any other v1 drop-in specific parameters if needed
           // Example: display options
           // display: { view: 'popup' }, // or 'inline'
         });
         // The v1 SDK typically handles success/failure redirection or callbacks internally
         // based on the order meta return_url or webhook setup.


       } else if (response.success && response.order_id && !response.payment_session_id) {
          console.log("Order fully paid with Gepto Coins.");
          toast({
              title: "Order Placed",
              description: response.message || "Placed order using Gepto Coins.",
          });
          setCart([]);
          setUseGeptoCoins(false);
          // Consider redirecting to status page after a short delay
          setTimeout(() => {
             window.location.href = `/order/status?order_id=${response.order_id}`;
          }, 1500);

       } else {
         // Throw error received from the server action
         throw new Error(response.error || 'Failed to initiate payment. Check server logs for details.');
       }
     } catch (error: any) {
       console.error('Checkout error:', error);
       toast({
         title: 'Checkout Failed',
         description: error.message || 'Could not start payment. Try again.',
         variant: 'destructive',
       });
     } finally {
       setIsCheckingOut(false);
     }
   };


  // Filter products based on search term
  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase())
  );


  return (
    <>
      {/* Load Cashfree v1 SDK Script */}
      <Script
        id="cf-checkout-js" // Keep ID consistent
        src={cashfreeScriptSrc} // Use the dynamically determined v1 src
        strategy="lazyOnload" // Load after essential page elements
        onLoad={handleCashfreeScriptLoad} // Call function on successful load
        onError={(e) => {
            console.error("Cashfree SDK (v1) script failed to load:", e);
            toast({
                title: "Payment Error",
                description: "Failed to load payment script.",
                variant: "destructive",
            });
            setIsCashfreeReady(false); // Ensure readiness state is false on error
        }}
      />

      <div className="space-y-8">
        {/* Location Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="text-primary" /> Delivery Location
            </CardTitle>
            <CardDescription>
              {loadingLocation ? "Detecting location..." : address || "Enter address"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {(!location || !address.toLowerCase().includes('cooch behar')) && !loadingLocation && (
              <form onSubmit={handleManualAddressSubmit} className="flex gap-2">
                <Input
                  type="text"
                  placeholder="Enter address in Cooch Behar"
                  value={manualAddress}
                  onChange={(e) => setManualAddress(e.target.value)}
                  className="flex-grow"
                  required // Make address input required
                />
                <Button type="submit" disabled={loadingLocation}>Set Location</Button>
              </form>
            )}
             {address && !address.toLowerCase().includes('cooch behar') && !loadingLocation && (
                  <p className="text-sm text-destructive mt-2">Service is only available in Cooch Behar.</p>
             )}
          </CardContent>
        </Card>

        {/* Main content - only if location is valid */}
        {location && address.toLowerCase().includes('cooch behar') && (
          <>
            {/* Store Selection Info */}
            {loadingStores && <p>Loading nearby stores...</p>}
            {stores.length > 0 && !loadingStores && (
              <p className="text-sm text-muted-foreground">Items from: <strong>{stores[0].name}</strong></p>
            )}
             {stores.length === 0 && !loadingStores && !loadingLocation && (
              <p className="text-sm text-destructive">No stores found nearby.</p>
            )}


            {/* Categories Section */}
             {stores.length > 0 && ( // Only show categories if stores are found
                 <section>
                   <h2 className="text-2xl font-semibold mb-4">Categories</h2>
                   {loadingCategories ? (
                     <p>Loading categories...</p>
                   ) : categories.length > 0 ? (
                     <div className="flex flex-wrap gap-2">
                       {categories.map(category => (
                         <Button
                           key={category.id}
                           variant={selectedCategory?.id === category.id ? "default" : "outline"}
                           onClick={() => setSelectedCategory(category)}
                           className="transition-transform active:scale-95"
                         >
                           {category.name}
                         </Button>
                       ))}
                     </div>
                   ) : (
                      <p>No categories found.</p>
                   )}
                 </section>
             )}


            {/* Products Section */}
            {selectedCategory && stores.length > 0 && (
              <section>
                <h2 className="text-2xl font-semibold mb-4">
                  {selectedCategory.name}
                </h2>
                <div className="relative mb-4">
                   <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="search"
                    placeholder="Search in category..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8"
                  />
                </div>

                {loadingProducts ? (
                  <p>Loading products...</p>
                ) : filteredProducts.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {filteredProducts.map(product => (
                      <Card key={product.id} className="overflow-hidden flex flex-col">
                         <CardHeader className="p-0 relative aspect-square bg-muted">
                            <Image
                              // Use picsum placeholder if imageUrl is invalid/missing
                              src={product.imageUrl && product.imageUrl.startsWith('https') ? product.imageUrl : `https://picsum.photos/300/300?random=${product.id}`}
                              alt={product.name}
                             fill={true}
                             style={{ objectFit: "cover" }}
                              data-ai-hint="product grocery item"
                              // Add error handling for images
                              onError={(e) => { (e.target as HTMLImageElement).src = `https://picsum.photos/300/300?random=${product.id}`; }}
                             />
                         </CardHeader>
                        <CardContent className="p-4 flex-grow">
                          <CardTitle className="text-lg mb-1">{product.name}</CardTitle>
                          <CardDescription className="text-sm mb-2">{product.description}</CardDescription>
                          <Badge variant="secondary">₹{product.price.toFixed(2)}</Badge>
                        </CardContent>
                        <CardFooter className="p-4 pt-0">
                          {cart.find(item => item.id === product.id) ? (
                             <div className="flex items-center gap-2 w-full justify-between">
                                <Button variant="outline" size="icon" onClick={() => removeFromCart(product.id)} className="h-8 w-8 transition-transform active:scale-90">
                                  <Minus className="h-4 w-4" />
                                </Button>
                                <span className="font-medium w-4 text-center">{cart.find(item => item.id === product.id)?.quantity}</span>
                                <Button variant="default" size="icon" onClick={() => addToCart(product)} className="h-8 w-8 transition-transform active:scale-90">
                                  <Plus className="h-4 w-4" />
                                </Button>
                             </div>
                          ) : (
                             <Button onClick={() => addToCart(product)} className="w-full transition-transform active:scale-95">
                               Add to Cart
                             </Button>
                           )}
                        </CardFooter>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <p>No products found {searchTerm ? `for "${searchTerm}"` : ""} in {selectedCategory.name}.</p>
                )}
              </section>
            )}

            {/* Cart Summary */}
             {cart.length > 0 && (
              <Card className="fixed bottom-4 right-4 w-72 shadow-xl z-50 bg-card">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between text-lg">
                    Your Cart
                    <Badge >{getCartItemCount()}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-sm mb-3">Subtotal: ₹{getCartTotal().toFixed(2)}</div>

                    {/* Gepto Coin Usage */}
                    <div className="flex items-center space-x-2 mb-3 border-t pt-3">
                       <Checkbox
                          id="useGeptoCoins"
                          checked={useGeptoCoins}
                          onCheckedChange={(checked) => setUseGeptoCoins(checked as boolean)}
                          disabled={geptoCoinBalance <= 0}
                       />
                      <Label
                        htmlFor="useGeptoCoins"
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex items-center gap-1"
                      >
                        Use Gepto Coins <Coins className="h-4 w-4 text-yellow-500 inline-block" /> ({geptoCoinBalance} available)
                       </Label>
                    </div>
                    {useGeptoCoins && geptoCoinBalance > 0 && (
                        <div className="text-xs text-green-600 mb-2">
                          - ₹{Math.min(getCartTotal(), geptoCoinBalance).toFixed(2)} (Applied)
                        </div>
                    )}

                   <div className="text-lg font-semibold mb-2 border-t pt-2">
                      Final Amount: ₹{getFinalAmount().toFixed(2)}
                   </div>

                    <ul className="text-xs mt-2 max-h-24 overflow-y-auto space-y-1 text-muted-foreground">
                      {cart.map(item=>(
                          <li key={item.id} className="flex justify-between">
                              <span>{item.name} x {item.quantity}</span>
                               <span>₹{(item.price * item.quantity).toFixed(2)}</span>
                          </li>
                      ))}
                    </ul>
                </CardContent>
                <CardFooter>
                  <Button
                      onClick={handleCheckout}
                      className="w-full transition-transform active:scale-95"
                       // Disable button during checkout, if SDK not ready, if amount invalid, or if location invalid
                      disabled={isCheckingOut || !isCashfreeReady || getFinalAmount() < 0 || !location || !address.toLowerCase().includes('cooch behar') }
                      aria-live="polite"
                  >
                     {isCheckingOut ? (
                      <>
                       <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                       Processing...
                      </>
                     ) : (
                      getFinalAmount() <= 0.009 && useGeptoCoins ? 'Place Order with Coins' : 'Proceed to Payment'
                     )}
                   </Button>
                </CardFooter>
              </Card>
            )}
          </>
        )}
      </div>
    </>
  );
}

// Helper type for Cashfree window object (v1 specific methods might differ)
declare global {
  interface Window {
    // Define the Cashfree object structure based on v1 SDK documentation
    Cashfree?: {
      checkout(options: { paymentSessionId: string; orderId: string; /* Add other v1 options */ }): void;
      // Potentially add other v1 methods like init if needed, though often not required for simple drop-in
      // init?(options: { appId: string; orderToken: string; mode: 'sandbox' | 'production'; /* ... */ }): Promise<{ status: string; }>;
    };
  }
}

