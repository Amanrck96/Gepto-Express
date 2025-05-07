
'use client'; // Needed for hooks like useState, useEffect

import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ShoppingCart, MapPin, Search, Plus, Minus, Loader2, Coins, Info } from 'lucide-react';
import Image from 'next/image';
import type { Location } from '@/services/geocoding';
import type { Store } from '@/services/store';
import type { Category, Product } from '@/services/product';
import { getAddress, getLocation } from '@/services/geocoding';
import { getNearbyStores } from '@/services/store';
import { getProductCategories, getProductsByStoreAndCategory } from '@/services/product';
import { useToast } from '@/hooks/use-toast';
import { initiatePayment } from '@/actions/payment';
import Script from 'next/script';
import type { CashfreeDropinOptions } from '@/types/cashfree';
import { useAuth } from '@/context/AuthContext';

// Mock Cart Item Type - Export it so it can be used in actions/payment.ts
export interface CartItem extends Product {
  quantity: number;
}

// Declare Cashfree on the window object for the v3 SDK
declare global {
  interface Window {
    Cashfree?: {
      new (): any; // Constructor for the Cashfree SDK instance
      dropin(options: CashfreeDropinOptions): void; // Drop-in method
      // Add other v3 methods if needed, e.g., for specific payment flows
      // checkout(options: CashfreeCheckoutOptions): void; // If using older checkout methods
    };
  }
}


export default function Home() {
  const { user } = useAuth();
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
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [geptoCoinBalance, setGeptoCoinBalance] = useState(0); // Default to 0
  const [useGeptoCoins, setUseGeptoCoins] = useState(false);
  const [isCashfreeSdkReady, setIsCashfreeSdkReady] = useState(false);
  const cashfreeInstanceRef = useRef<any>(null); // For v3 SDK instance
  const [paymentMode, setPaymentMode] = useState<'online' | 'cod'>('online');


  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      // Placeholder: Fetch actual coin balance from backend/Firestore for the logged-in user
      // For now, let's assume a fixed balance if logged in
      setGeptoCoinBalance(100); // Example: User gets 100 Gepto Coins
    } else {
      setGeptoCoinBalance(0); // No coins if not logged in
    }
  }, [user]); // Re-run when user object changes

  const appId = process.env.NEXT_PUBLIC_CASHFREE_APP_ID;
  const isLiveMode = appId && !appId.startsWith('TEST');
  const cashfreeMode = isLiveMode ? 'production' : 'sandbox';

  console.log(`Cashfree Frontend Mode: ${cashfreeMode} (App ID: ${appId ? appId.substring(0, 4) : 'N/A'}...)`);

  // Use v3 SDK URLs
  const cashfreeScriptSrc = cashfreeMode === 'production'
    ? 'https://sdk.cashfree.com/js/v3/cashfree.js'
    : 'https://sdk.cashfree.com/js/v3/cashfree.sandbox.js';


  // Function to handle successful SDK script load
  const handleCashfreeScriptLoad = () => {
    console.log(`Cashfree Drop-in SDK (v3) script loaded from ${cashfreeScriptSrc}. Mode: ${cashfreeMode}`);
    setIsCashfreeSdkReady(true);
    if (window.Cashfree) {
      try {
        // For v3, the instance is typically created per transaction or globally if preferred
        // Here, we ensure window.Cashfree is available. The actual `new Cashfree()` might be
        // done just before calling drop-in, or stored if using it multiple times.
        // For simplicity, we'll assume window.Cashfree can be used directly or new instance created on demand.
        // cashfreeInstanceRef.current = new window.Cashfree(); // If you need to store the instance
        console.log('Cashfree SDK (v3) is available on window.Cashfree.');
      } catch (error) {
        console.error('Error accessing Cashfree SDK (v3) from window:', error);
        toast({
          title: "Payment Init Error",
          description: "Could not access payment interface.",
          variant: "destructive",
        });
      }
    } else {
      console.error("Cashfree SDK (v3) script loaded but window.Cashfree is not available.");
      toast({
        title: "Payment Init Error",
        description: "Payment script (v3) loaded incorrectly.",
        variant: "destructive",
      });
    }
  };

  // Function to handle SDK script loading errors
  const handleCashfreeScriptError = (e: any) => {
    console.error(`Cashfree Drop-in SDK (v3) script failed to load from URL: ${cashfreeScriptSrc}. Error:`, e);
    toast({
      title: "Payment Script Load Error",
      description: `Failed to load payment script from ${cashfreeScriptSrc}. Check browser's Network tab for details. Possible causes: internet issue, ad-blocker, or firewall.`,
      variant: "destructive",
      duration: 10000,
    });
    setIsCashfreeSdkReady(false);
  };


  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          const detectedLocation = { lat: latitude, lng: longitude };
          setLocation(detectedLocation);
          try {
            const addr = await getAddress(detectedLocation);
            // Ensure service is only for Cooch Behar
            if (addr.formattedAddress.toLowerCase().includes('cooch behar')) {
              setAddress(addr.formattedAddress);
              toast({ title: "Location Detected", description: addr.formattedAddress });
            } else {
              setAddress("Service unavailable outside Cooch Behar");
              toast({ title: "Location Error", description: "Gepto Express serves Cooch Behar only.", variant: "destructive" });
              setLocation(null); // Reset location if outside service area
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

  const handleManualAddressSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualAddress.trim()) {
      toast({ title: "Invalid Address", description: "Please enter address.", variant: "destructive" });
      return;
    }
    // Ensure service is only for Cooch Behar
    if (!manualAddress.toLowerCase().includes('cooch behar')) {
      toast({ title: "Service Area", description: "Gepto Express serves Cooch Behar only.", variant: "destructive" });
      setAddress("Service unavailable outside Cooch Behar");
      setLocation(null); // Reset location
      return;
    }
    setLoadingLocation(true);
    try {
      const loc = await getLocation(manualAddress);
      setLocation(loc);
      setAddress(manualAddress); // Set the address to the manually entered one
      toast({ title: "Location Set Manually", description: manualAddress });
    } catch (error) {
      console.error("Error fetching location from manual address:", error);
      setAddress("Could not find location.");
      setLocation(null);
      toast({ title: "Address Error", description: "Could not find location for the entered address.", variant: "destructive" });
    } finally {
      setLoadingLocation(false);
    }
  };

  useEffect(() => {
    if (location && address.toLowerCase().includes('cooch behar')) {
      setLoadingStores(true);
      getNearbyStores(location, 5) // Assuming radius of 5km
        .then(setStores)
        .catch(err => {
          console.error("Error fetching stores:", err);
          toast({ title: "Store Fetch Error", description: "Could not load nearby stores.", variant: "destructive" });
        })
        .finally(() => setLoadingStores(false));
    } else {
      setStores([]); // Clear stores if location is not set or not in Cooch Behar
    }
  }, [location, address, toast]); // Re-fetch stores if location or address changes

  useEffect(() => {
    setLoadingCategories(true);
    getProductCategories()
      .then(setCategories)
      .catch(err => {
        console.error("Error fetching categories:", err);
        toast({ title: "Category Fetch Error", description: "Could not load product categories.", variant: "destructive" });
      })
      .finally(() => setLoadingCategories(false));
  }, [toast]);

  useEffect(() => {
    if (selectedCategory && stores.length > 0) {
      setLoadingProducts(true);
      // Assuming products are from the first store found for simplicity
      if (stores[0]?.id) {
        getProductsByStoreAndCategory(stores[0].id, selectedCategory.id)
          .then(setProducts)
          .catch(err => {
            console.error(`Error fetching products for category ${selectedCategory.name}:`, err);
            toast({ title: "Product Fetch Error", description: `Could not load ${selectedCategory.name}.`, variant: "destructive" });
            setProducts([]); // Clear products on error
          })
          .finally(() => setLoadingProducts(false));
      } else {
        // This case should ideally not happen if stores are loaded and location is valid
        console.warn("No valid store ID found to fetch products.");
        setLoadingProducts(false);
        setProducts([]);
      }
    } else {
      setProducts([]); // Clear products if no category or store selected/available
    }
  }, [selectedCategory, stores, toast]);

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
  };

  const removeFromCart = (productId: string) => {
    setCart(prevCart => {
      const existingItem = prevCart.find(item => item.id === productId);
      if (existingItem && existingItem.quantity > 1) {
        return prevCart.map(item =>
          item.id === productId ? { ...item, quantity: item.quantity - 1 } : item
        );
      } else {
        // Remove item completely if quantity is 1 or less
        return prevCart.filter(item => item.id !== productId);
      }
    });
  };

  const getCartTotal = () => {
    const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    return Math.max(0, total); // Ensure total is not negative
  };

  const getCoinsUsed = () => {
    const total = getCartTotal();
    if (useGeptoCoins && geptoCoinBalance > 0) {
      return Math.min(total, geptoCoinBalance);
    }
    return 0;
  };

  const getFinalAmount = () => {
    const total = getCartTotal();
    const coinsToUse = getCoinsUsed();
    return Math.max(0, total - coinsToUse); // Ensure final amount is not negative
  };


  const getCartItemCount = () => {
    return cart.reduce((count, item) => count + item.quantity, 0);
  };

  const handleCheckout = async () => {
    if (cart.length === 0) {
      toast({ title: "Empty Cart", description: "Please add items to your cart before checkout.", variant: "destructive" });
      return;
    }
    if (!location || !address.toLowerCase().includes('cooch behar')) {
      toast({ title: "Invalid Location", description: "Please set a valid delivery address within Cooch Behar.", variant: "destructive" });
      return;
    }

    const finalAmount = getFinalAmount();

    // Additional check for online payments: Cashfree might have a minimum transaction amount (e.g., ₹1.00)
    if (paymentMode === 'online' && finalAmount > 0 && finalAmount < 1.00) {
      toast({ title: "Minimum Amount", description: "Minimum order value for online payment is ₹1.00.", variant: "destructive" });
      return;
    }

    // Ensure Cashfree SDK is ready for online payments if an amount is to be paid
    if (paymentMode === 'online' && finalAmount > 0) {
       if (!isCashfreeSdkReady || !window.Cashfree) {
         console.error("Checkout failed: Cashfree SDK (v3) not ready or window.Cashfree not available.");
         toast({
           title: "Payment System Error",
           description: "Payment system is not ready. Please wait a moment or refresh the page.",
           variant: "destructive",
         });
         return;
       }
       // Initialize a new Cashfree instance for v3 Drop-in if not already done or if it needs re-initialization
       try {
         if (!cashfreeInstanceRef.current && window.Cashfree) { // Check if instance exists
            cashfreeInstanceRef.current = new window.Cashfree();
            console.log("New Cashfree SDK (v3) instance created for checkout.");
         } else if (!window.Cashfree) {
            throw new Error("window.Cashfree is not available.");
         }
       } catch(sdkError) {
          console.error("Error initializing Cashfree SDK (v3) instance for checkout:", sdkError);
          toast({ title: "Payment Setup Error", description: "Could not initialize payment interface. Please refresh.", variant: "destructive" });
          return;
       }
    }


    setIsCheckingOut(true);

    // Construct customer details (use guest details if not logged in)
    const customerId = user?.uid || `GUEST_${Date.now()}`;
    const customerDetails = {
      customerId: customerId,
      customerEmail: user?.email || 'guest@gepto.example.com', // Use a default if no email
      customerPhone: user?.phoneNumber || '9999999999', // Placeholder, ensure this is valid
      customerName: user?.displayName || 'Gepto Guest',
    };

    try {
      const totalOrderAmount = getCartTotal(); // This is the original amount before coin deduction
      const coinsToActuallyUse = getCoinsUsed();

      const paymentResponse = await initiatePayment({
        items: cart,
        totalAmount: totalOrderAmount,
        customerDetails: customerDetails,
        useGeptoCoins: useGeptoCoins,
        geptoCoinBalance: geptoCoinBalance,
        paymentMode: paymentMode,
      });

      if (paymentResponse.success) {
        if (paymentResponse.payment_session_id && paymentResponse.order_id && paymentMode === 'online' && finalAmount > 0) {
          // Proceed with Cashfree Drop-in SDK (v3)
          const dropinOptions: CashfreeDropinOptions = {
            paymentSessionId: paymentResponse.payment_session_id,
            orderId: paymentResponse.order_id, // This is your GEPTO- prefixed order_id
            components: ["order-details", "card", "upi", "app", "netbanking"], // Customize as needed
            onSuccess: (data) => {
              console.log("Cashfree onSuccess data:", data);
              toast({ title: "Payment Successful", description: `Order ${data.order?.orderId || paymentResponse.order_id} placed.` });
              // Redirect to your order status page
              window.location.href = `/order/status?order_id=${data.order?.orderId || paymentResponse.order_id}`;
            },
            onFailure: (data) => {
              console.error("Cashfree onFailure data:", data);
              toast({ title: "Payment Failed", description: data.order?.errorText || "Payment could not be completed.", variant: "destructive" });
              window.location.href = `/order/status?order_id=${data.order?.orderId || paymentResponse.order_id}`;
            },
            // onNote: (event, data) => { // Optional: For more detailed event tracking
            //   console.log("Cashfree onNote:", event, data);
            // }
          };

          // Ensure the instance is available before calling drop
          if (cashfreeInstanceRef.current && typeof cashfreeInstanceRef.current.drop === 'function') {
             cashfreeInstanceRef.current.drop(dropinOptions);
          } else if (window.Cashfree) { // Fallback to use window.Cashfree directly if instance wasn't set
             console.warn("cashfreeInstanceRef.current.drop not found, trying window.Cashfree.dropin");
             // Note: v3's global `window.Cashfree` might not have a `drop` method.
             // It might be `window.Cashfree.checkout` or `new window.Cashfree().drop()`
             // The most robust way for v3 drop-in is new window.Cashfree().drop()
             // Assuming `cashfreeInstanceRef.current` was correctly initialized above or use `new window.Cashfree().drop()`
             try {
                const cfInstance = cashfreeInstanceRef.current || new window.Cashfree();
                if (typeof cfInstance.drop === 'function') { // v3 should have drop on instance
                    cfInstance.drop(dropinOptions);
                } else {
                    console.error("Cashfree SDK (v3) .drop() method not found on instance.");
                    throw new Error("Payment interface drop method not available.");
                }
             } catch(dropError) {
                console.error("Error initiating Cashfree drop-in:", dropError);
                toast({ title: "Payment Error", description: "Could not start payment flow.", variant: "destructive" });
             }
          } else {
             console.error("Cashfree SDK (v3) not properly initialized for drop-in.");
             toast({ title: "Payment Setup Error", description: "Payment interface not ready for drop-in.", variant: "destructive" });
          }

        } else if (paymentResponse.order_id) { // For COD or orders fully paid by coins
          toast({ title: "Order Placed", description: paymentResponse.message || `Order ${paymentResponse.order_id} placed successfully.` });
          setCart([]); // Clear cart
          setUseGeptoCoins(false); // Reset coin usage
          // Redirect after a short delay
          setTimeout(() => {
            window.location.href = `/order/status?order_id=${paymentResponse.order_id}`;
          }, 1500);
        } else {
          // This case implies success was true, but no session_id (for online) or order_id (for coin/COD)
          throw new Error("Invalid response from server: Missing order details for successful payment initiation.");
        }
      } else {
        // Throw error received from the server action
        throw new Error(paymentResponse.error || 'Failed to initiate payment. Check server logs for details.');
      }
    } catch (error: any) {
      console.error('Checkout error:', error);
      toast({ title: 'Checkout Failed', description: error.message || 'Could not complete the checkout process.', variant: 'destructive' });
    } finally {
      setIsCheckingOut(false);
    }
  };


  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <>
      <Script
        id="cf-dropin-js" // Unique ID for the script tag
        src={cashfreeScriptSrc}
        strategy="afterInteractive" // Load after page is interactive
        onLoad={handleCashfreeScriptLoad} // Call function on successful load
        onError={handleCashfreeScriptError} // Call function on error
      />

      <div className="space-y-8">
        {/* Location Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="text-primary" /> Delivery Location
            </CardTitle>
            <CardDescription>
              {loadingLocation ? "Detecting location..." : address || "Enter address in Cooch Behar"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!loadingLocation && (!location || !address.toLowerCase().includes('cooch behar')) && (
              <form onSubmit={handleManualAddressSubmit} className="flex gap-2">
                <Input
                  type="text"
                  placeholder="Enter address in Cooch Behar"
                  value={manualAddress}
                  onChange={(e) => setManualAddress(e.target.value)}
                  className="flex-grow"
                  required
                  aria-label="Enter delivery address in Cooch Behar"
                />
                <Button type="submit" disabled={loadingLocation}>Set Location</Button>
              </form>
            )}
            {!loadingLocation && address && !address.toLowerCase().includes('cooch behar') && (
              <p className="text-sm text-destructive mt-2 flex items-center gap-1">
                <Info className="h-4 w-4" /> Service is only available in Cooch Behar.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Main content: Categories, Products, Cart - Shown only if location is valid */}
        {location && address.toLowerCase().includes('cooch behar') ? (
          <>
            {/* Store Information */}
            {loadingStores && <p className="animate-pulse-bg p-2 rounded-md text-center">Loading nearby stores...</p>}
            {stores.length > 0 && !loadingStores && (
              <p className="text-sm text-muted-foreground text-center">Showing items from: <strong>{stores[0].name}</strong> (Nearest store in Cooch Behar)</p>
            )}
            {stores.length === 0 && !loadingStores && !loadingLocation && (
              <p className="text-sm text-destructive text-center">No stores found nearby in Cooch Behar.</p>
            )}

            {/* Categories Section */}
            {stores.length > 0 && ( // Only show categories if stores are available
              <section>
                <h2 className="text-2xl font-semibold mb-4">Categories</h2>
                {loadingCategories ? (
                  <div className="flex flex-wrap gap-2">
                    {[...Array(5)].map((_, i) => <div key={i} className="h-9 w-24 bg-muted rounded-md animate-pulse"></div>)}
                  </div>
                ) : categories.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {categories.map(category => (
                      <Button
                        key={category.id}
                        variant={selectedCategory?.id === category.id ? "default" : "outline"}
                        onClick={() => setSelectedCategory(category)}
                        className="transition-transform active:scale-95 shadow-sm hover:shadow-md"
                      >
                        {category.name}
                      </Button>
                    ))}
                  </div>
                ) : (
                  <p>No product categories found.</p>
                )}
              </section>
            )}

            {/* Products Section */}
            {selectedCategory && stores.length > 0 && ( // Only show products if a category and stores are selected/available
              <section>
                <h2 className="text-2xl font-semibold mb-4 mt-6">
                  {selectedCategory.name}
                </h2>
                <div className="relative mb-4 max-w-sm">
                  <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="search"
                    placeholder={`Search in ${selectedCategory.name}...`}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8"
                    aria-label={`Search products in ${selectedCategory.name}`}
                  />
                </div>

                {loadingProducts ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {[...Array(4)].map((_, i) => (
                      <Card key={i} className="overflow-hidden flex flex-col animate-pulse shadow-md rounded-lg">
                        <div className="relative aspect-square bg-muted"></div>
                        <CardContent className="p-4 flex-grow">
                          <div className="h-5 w-3/4 bg-muted rounded mb-1"></div>
                          <div className="h-4 w-1/2 bg-muted rounded mb-2"></div>
                          <div className="h-5 w-1/4 bg-muted rounded"></div>
                        </CardContent>
                        <CardFooter className="p-4 pt-0">
                          <div className="h-9 w-full bg-muted rounded"></div>
                        </CardFooter>
                      </Card>
                    ))}
                  </div>
                ) : filteredProducts.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {filteredProducts.map(product => (
                      <Card key={product.id} className="overflow-hidden flex flex-col transition-shadow hover:shadow-lg rounded-lg border">
                         {/* Use a container div for aspect ratio and positioning */}
                         <div className="relative aspect-square w-full overflow-hidden bg-muted">
                             <Image
                               // Use picsum placeholder if imageUrl is invalid/missing or doesn't load
                               src={product.imageUrl && product.imageUrl.startsWith('https://picsum.photos') ? product.imageUrl : `https://picsum.photos/300/300?random=${product.id}`}
                               alt={product.name}
                               fill
                               sizes="(max-width: 640px) 90vw, (max-width: 768px) 45vw, (max-width: 1024px) 30vw, 23vw"
                               style={{ objectFit: 'cover' }}
                               data-ai-hint="grocery product" // For AI image replacement hint
                               onError={(e) => {
                                 const target = e.target as HTMLImageElement;
                                 // Fallback to a generic picsum image if the provided one fails, only if it's not already a picsum URL
                                 if (!target.src.includes(`random=${product.id}`)) {
                                    target.src = `https://picsum.photos/300/300?random=${product.id}`;
                                 }
                               }}
                             />
                         </div>
                        <CardContent className="p-4 flex-grow">
                          <CardTitle className="text-lg mb-1 line-clamp-1">{product.name}</CardTitle>
                          <CardDescription className="text-sm mb-2 line-clamp-2 h-10">{product.description}</CardDescription>
                          <Badge variant="secondary" className="mt-1 text-base">₹{product.price.toFixed(2)}</Badge>
                        </CardContent>
                        <CardFooter className="p-4 pt-0 mt-auto">
                          {cart.find(item => item.id === product.id) ? (
                            <div className="flex items-center gap-2 w-full justify-between">
                              <Button aria-label={`Decrease quantity of ${product.name}`} variant="outline" size="icon" onClick={() => removeFromCart(product.id)} className="h-8 w-8 transition-transform active:scale-90 rounded-md">
                                <Minus className="h-4 w-4" />
                              </Button>
                              <span className="font-medium w-4 text-center tabular-nums" aria-live="polite">
                                {cart.find(item => item.id === product.id)?.quantity}
                              </span>
                              <Button aria-label={`Increase quantity of ${product.name}`} variant="default" size="icon" onClick={() => addToCart(product)} className="h-8 w-8 transition-transform active:scale-90 rounded-md">
                                <Plus className="h-4 w-4" />
                              </Button>
                            </div>
                          ) : (
                            <Button onClick={() => addToCart(product)} className="w-full transition-transform active:scale-95 rounded-md">
                              Add to Cart
                            </Button>
                          )}
                        </CardFooter>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground mt-4 text-center">No products found {searchTerm ? `matching "${searchTerm}"` : ""} in {selectedCategory.name}.</p>
                )}
              </section>
            )}

            {/* Cart Section - Fixed Position */}
            {cart.length > 0 && (
              <Card className="fixed bottom-4 right-4 w-72 md:w-80 shadow-xl z-50 bg-card border rounded-lg">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center justify-between text-lg">
                    Your Cart
                    <Badge>{getCartItemCount()}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="py-2 max-h-48 overflow-y-auto">
                  <ul className="text-xs space-y-1 text-muted-foreground mb-2">
                    {cart.slice(0, 5).map(item => ( // Show first 5 items, add scroll for more
                      <li key={item.id} className="flex justify-between">
                        <span className="truncate pr-1">{item.name} x {item.quantity}</span>
                        <span className="whitespace-nowrap">₹{(item.price * item.quantity).toFixed(2)}</span>
                      </li>
                    ))}
                    {cart.length > 5 && <li className="text-center text-xs text-muted-foreground">...and {cart.length - 5} more item(s)</li>}
                  </ul>
                  <div className="text-sm mb-2 border-t pt-2">Subtotal: ₹{getCartTotal().toFixed(2)}</div>

                  {/* Gepto Coins Section */}
                  <div className="flex items-center space-x-2 mb-2 border-t pt-2">
                    <Checkbox
                      id="useGeptoCoins"
                      checked={useGeptoCoins}
                      onCheckedChange={(checked) => setUseGeptoCoins(checked as boolean)}
                      disabled={geptoCoinBalance <= 0 || getCartTotal() <= 0} // Disable if no coins or empty cart
                      aria-label={`Use Gepto Coins. Available balance: ${geptoCoinBalance} coins`}
                    />
                    <Label
                      htmlFor="useGeptoCoins"
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex items-center gap-1"
                    >
                      Use Gepto Coins <Coins className="h-4 w-4 text-yellow-500 inline-block" /> ({geptoCoinBalance})
                    </Label>
                  </div>
                  {useGeptoCoins && geptoCoinBalance > 0 && getCoinsUsed() > 0 && (
                    <div className="text-xs text-green-600 mb-2">
                      - ₹{getCoinsUsed().toFixed(2)} (Coins Applied)
                    </div>
                  )}
                  <div className="text-lg font-semibold mb-1 border-t pt-2">
                    Final Amount: ₹{getFinalAmount().toFixed(2)}
                  </div>
                </CardContent>
                 <CardFooter className="flex-col items-start gap-3 pt-3 border-t">
                  <div className="flex justify-between items-center w-full">
                    <Label htmlFor="paymentMode" className="text-sm font-medium">Payment Mode:</Label>
                    <select
                      id="paymentMode"
                      name="paymentMode"
                      className="ml-2 p-1.5 border rounded-md text-sm bg-background text-foreground focus:ring-ring focus:border-ring"
                      value={paymentMode}
                      onChange={(e) => setPaymentMode(e.target.value as 'online' | 'cod')}
                      aria-label="Select payment mode"
                    >
                      <option value="online">Online Payment</option>
                      <option value="cod">Cash on Delivery</option>
                    </select>
                  </div>

                  <Button
                    onClick={handleCheckout}
                    className="w-full transition-transform active:scale-95 rounded-md py-2.5 text-base"
                    disabled={
                      isCheckingOut || // Disable if checkout is in progress
                      (paymentMode === 'online' && getFinalAmount() > 0 && !isCashfreeSdkReady) || // Disable if SDK not ready for online payment
                      !location || // Disable if no location
                      !address.toLowerCase().includes('cooch behar') || // Disable if address not in Cooch Behar
                      (paymentMode === 'online' && getFinalAmount() > 0 && getFinalAmount() < 1.00) // Disable if online payment amount is too low
                    }
                    aria-live="polite"
                    aria-label={isCheckingOut ? "Processing your order" : (paymentMode === 'cod' ? "Place Order (Cash on Delivery)" : (getFinalAmount() < 0.01 && useGeptoCoins ? "Place Order using Gepto Coins" : "Proceed to Secure Online Payment"))}
                  >
                    {isCheckingOut ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      paymentMode === 'cod' ? 'Place Order (COD)' :
                        (getFinalAmount() < 0.01 && useGeptoCoins ? 'Place Order with Coins' : 'Proceed to Online Payment')
                    )}
                  </Button>
                </CardFooter>
              </Card>
            )}
          </>
        ) : (
          // Show this if location is not set or invalid
          !loadingLocation && (
            <div className="text-center text-muted-foreground mt-8 py-10">
              <MapPin className="h-12 w-12 mx-auto mb-4 text-primary" />
              <p className="text-lg">Please set your delivery location in Cooch Behar to start shopping.</p>
              <p className="text-sm">We need your location to show you relevant stores and products.</p>
            </div>
          )
        )}
      </div>
    </>
  );
}
