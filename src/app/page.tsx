
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
import { load } from '@cashfreepayments/cashfree-js'; // Import Cashfree SDK loader
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
  const [cashfreeInstance, setCashfreeInstance] = useState<any>(null); // State for Cashfree SDK instance
  const [geptoCoinBalance, setGeptoCoinBalance] = useState(100); // Mock balance
  const [useGeptoCoins, setUseGeptoCoins] = useState(false); // State for checkbox


  const { toast } = useToast();

  // Determine Cashfree mode (sandbox/production) - client-side check
  // Use hostname or explicit env var if available
  const isProduction = typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
  const cashfreeMode = isProduction ? 'production' : 'sandbox';
  const cashfreeScriptSrc = isProduction
    ? 'https://sdk.cashfree.com/js/v3/cashfree.prod.js' // v3 Production script
    : 'https://sdk.cashfree.com/js/v3/cashfree.sandbox.js'; // v3 Sandbox script

  // Initialize Cashfree Drop-in SDK instance after script loads
  const initializeCashfreeDropin = async () => {
     if (window.Cashfree && !cashfreeInstance) { // Ensure window.Cashfree exists and instance not already set
         try {
             console.log(`Cashfree Drop-in: Initializing SDK in ${cashfreeMode} mode...`);
             const cashfree = await load({
                 mode: cashfreeMode
             });
             setCashfreeInstance(cashfree);
             console.log('Cashfree Drop-in SDK Initialized successfully.');
         } catch (error) {
             console.error("Failed to initialize Cashfree Drop-in SDK:", error);
             toast({
                 title: "Payment Error",
                 description: "Could not initialize the payment interface. Please refresh or try again later.",
                 variant: "destructive",
             });
         }
     } else if (cashfreeInstance) {
        console.log("Cashfree Drop-in: SDK already initialized.");
     } else {
         console.log("Cashfree Drop-in: Waiting for SDK script to load...");
     }
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
            // Only serve Cooch Behar
             if (addr.formattedAddress.toLowerCase().includes('cooch behar')) {
               setAddress(addr.formattedAddress);
               toast({ title: "Location Detected", description: addr.formattedAddress });
             } else {
               setAddress("Service unavailable outside Cooch Behar");
               toast({ title: "Location Error", description: "Sorry, Gepto Express currently only serves Cooch Behar, West Bengal.", variant: "destructive" });
               setLocation(null); // Reset location if outside service area
             }
          } catch (error) {
            console.error("Error fetching address:", error);
            setAddress("Could not fetch address");
            toast({ title: "Location Error", description: "Could not fetch address for your location.", variant: "destructive" });
          } finally {
            setLoadingLocation(false);
          }
        },
        (error) => {
          console.error("Geolocation error:", error);
          setAddress("Location access denied. Please enter manually.");
          setLoadingLocation(false);
          toast({ title: "Location Access Denied", description: "Please enable location services or enter your address manually.", variant: "destructive" });
        }
      );
    } else {
      setAddress("Geolocation not available. Please enter manually.");
      setLoadingLocation(false);
      toast({ title: "Location Not Supported", description: "Geolocation is not supported by your browser. Please enter your address manually.", variant: "destructive" });
    }
  }, [toast]);

  // Function to handle manual address submission
  const handleManualAddressSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualAddress.trim()) {
      toast({ title: "Invalid Address", description: "Please enter a valid address.", variant: "destructive" });
      return;
    }
     // Simple check for Cooch Behar
    if (!manualAddress.toLowerCase().includes('cooch behar')) {
      toast({ title: "Service Area", description: "Sorry, Gepto Express currently only serves Cooch Behar, West Bengal.", variant: "destructive" });
      setAddress("Service unavailable outside Cooch Behar");
      setLocation(null);
      return;
    }

    setLoadingLocation(true);
    try {
      const loc = await getLocation(manualAddress + ", Cooch Behar, West Bengal, India"); // Append region for better accuracy
      setLocation(loc);
      setAddress(manualAddress); // Use the manually entered address for display
      toast({ title: "Location Set Manually", description: manualAddress });
    } catch (error) {
      console.error("Error fetching location:", error);
      setAddress("Could not find location for the address.");
      setLocation(null);
      toast({ title: "Address Error", description: "Could not find location for the entered address.", variant: "destructive" });
    } finally {
      setLoadingLocation(false);
    }
  };


  // 2. Fetch nearby stores based on location
  useEffect(() => {
    if (location && address.toLowerCase().includes('cooch behar')) { // Only fetch if location is valid and in Cooch Behar
      setLoadingStores(true);
      getNearbyStores(location, 5) // Assuming a 5km radius
        .then(setStores)
        .catch(err => {
          console.error("Error fetching stores:", err);
          toast({ title: "Store Fetch Error", description: "Could not load nearby stores.", variant: "destructive" });
        })
        .finally(() => setLoadingStores(false));
    } else {
      setStores([]); // Clear stores if location is not valid or outside Cooch Behar
    }
  }, [location, address, toast]);

  // 3. Fetch product categories
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

  // 4. Fetch products when a category and store are selected
  // For simplicity, we'll assume the first store is selected if available
  useEffect(() => {
    if (selectedCategory && stores.length > 0) {
      setLoadingProducts(true);
      // Using the first store's ID for simplicity
      getProductsByStoreAndCategory(stores[0].id, selectedCategory.id)
        .then(setProducts)
        .catch(err => {
          console.error("Error fetching products:", err);
          toast({ title: "Product Fetch Error", description: `Could not load products for ${selectedCategory.name}.`, variant: "destructive" });
          setProducts([]);
        })
        .finally(() => setLoadingProducts(false));
    } else {
      setProducts([]); // Clear products if no category or store
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
     toast({ title: "Item Updated", description: `Item quantity updated in cart.` });
  };

   const getCartTotal = () => {
    // Ensure total is never negative and has 2 decimal places
    const total = cart.reduce((total, item) => total + item.price * item.quantity, 0);
    return Math.max(0, total); // Return as number for calculations
   };

   // Calculate total after applying Gepto Coins
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

  // Checkout Function
  const handleCheckout = async () => {
     if (!cashfreeInstance) {
       toast({
         title: "Payment Error",
         description: "Payment interface is not ready. Please wait a moment and try again.",
         variant: "destructive",
       });
       return;
     }
     if (cart.length === 0) {
       toast({ title: "Empty Cart", description: "Please add items to your cart before checking out.", variant: "destructive" });
       return;
     }
     setIsCheckingOut(true);

     // --- Placeholder Customer Details ---
     // In a real app, you'd get this from user authentication/profile
     const customerDetails = {
       customerId: `USER_${Math.random().toString(36).substring(2, 10)}`, // Replace with actual user ID
       customerEmail: 'test@example.com', // Replace with actual user email
       customerPhone: '9876543210', // Replace with actual user phone
       customerName: 'Test User' // Optional: Replace with actual user name
     };
     // --- End Placeholder ---

     try {
       const total = getCartTotal(); // Original total
       const finalAmount = getFinalAmount(); // Amount after coins

       console.log('Initiating payment server action...');
       // Pass both the original total and the coin usage details
       const response = await initiatePayment({
         items: cart,
         totalAmount: total, // Send original total to server action
         customerDetails: customerDetails,
         useGeptoCoins: useGeptoCoins, // Send the flag
         geptoCoinBalance: geptoCoinBalance, // Send current balance
       });
       console.log('Server action response:', response);


       if (response.success && response.payment_session_id && response.order_id) {
         console.log('Payment session created:', response.payment_session_id);
         // Use the Cashfree Drop-in SDK
         cashfreeInstance.checkout({
            paymentSessionId: response.payment_session_id,
            orderId: response.order_id,
            // Optional: Customize appearance or behavior
            // display: { backdrop: true, hideIcon: false },
            // style: { color: '#ffffff', backgroundColor: '#006400' } // Example styling
         });
         // The Drop-in SDK handles the rest (showing payment options, redirection, etc.)
       } else if (response.success && response.order_id && !response.payment_session_id) {
          // This handles the case where the order was fully paid with Gepto Coins
          console.log("Order fully paid with Gepto Coins, no payment gateway needed.");
          toast({
              title: "Order Placed",
              description: response.message || "Successfully placed order using Gepto Coins.",
          });
          // Optionally redirect to an order success page or clear the cart
          setCart([]); // Clear cart after successful coin-only order
          setUseGeptoCoins(false); // Reset checkbox
          // Example redirect: router.push(`/order/status?order_id=${response.order_id}`);
       }
       else {
         // Throw error received from the server action
         throw new Error(response.error || 'Failed to initiate payment. Check server logs for details.');
       }
     } catch (error: any) {
       console.error('Checkout error:', error);
       toast({
         title: 'Checkout Failed',
         description: error.message || 'Could not start the payment process. Please try again.',
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
      {/* Load Cashfree SDK Script */}
      <Script
        id="cf-checkout-js"
        src={cashfreeScriptSrc}
        strategy="lazyOnload" // Load after other resources, but before hydration if needed early
        onLoad={initializeCashfreeDropin} // Initialize after script loads
        onError={(e) => {
            console.error("Cashfree SDK script failed to load:", e);
            toast({
                title: "Payment Error",
                description: "Failed to load payment script. Checkout may not work.",
                variant: "destructive",
            });
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
              {loadingLocation ? "Detecting location..." : address || "Enter your address"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {(!location || !address.toLowerCase().includes('cooch behar')) && !loadingLocation && (
              <form onSubmit={handleManualAddressSubmit} className="flex gap-2">
                <Input
                  type="text"
                  placeholder="Enter your address in Cooch Behar"
                  value={manualAddress}
                  onChange={(e) => setManualAddress(e.target.value)}
                  className="flex-grow"
                />
                <Button type="submit">Set Location</Button>
              </form>
            )}
          </CardContent>
        </Card>

        {/* Only show content if location is in Cooch Behar */}
        {location && address.toLowerCase().includes('cooch behar') && (
          <>
            {/* Store Selection (Simplified: Assuming first store) */}
            {loadingStores && <p>Loading nearby stores...</p>}
            {stores.length > 0 && !loadingStores && (
              <p className="text-sm text-muted-foreground">Showing items from: <strong>{stores[0].name}</strong></p>
            )}
             {stores.length === 0 && !loadingStores && !loadingLocation && (
              <p className="text-sm text-destructive">No stores found for your location in Cooch Behar.</p>
            )}


            {/* Categories Section */}
            <section>
              <h2 className="text-2xl font-semibold mb-4">Categories</h2>
              {loadingCategories ? (
                <p>Loading categories...</p>
              ) : (
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
              )}
            </section>

            {/* Products Section */}
            {selectedCategory && (
              <section>
                <h2 className="text-2xl font-semibold mb-4">
                  {selectedCategory.name}
                </h2>
                <div className="relative mb-4">
                   <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="search"
                    placeholder="Search within category..."
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
                         <CardHeader className="p-0 relative aspect-square">
                            <Image
                              src={product.imageUrl || `https://picsum.photos/300/300?random=${product.id}`}
                              alt={product.name}
                             fill={true} // Use fill with relative parent
                             style={{ objectFit: "cover" }} // Use style for objectFit with fill
                              data-ai-hint="product grocery item"
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
                  <p>No products found {searchTerm ? `for "${searchTerm}"` : ""} in this category.</p>
                )}
              </section>
            )}

            {/* Cart Summary (Floating or fixed) */}
             {cart.length > 0 && (
              <Card className="fixed bottom-4 right-4 w-72 shadow-xl z-50 bg-card"> {/* Ensure background for visibility */}
                <CardHeader>
                  <CardTitle className="flex items-center justify-between text-lg">
                    Your Cart
                    <Badge >{getCartItemCount()}</Badge> {/* Use default variant */}
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
                          - ₹{Math.min(getCartTotal(), geptoCoinBalance).toFixed(2)} (Coins Applied)
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
                      disabled={isCheckingOut || !cashfreeInstance || getFinalAmount() < 0} // Disable button during checkout, if SDK not ready, or if amount is invalid
                      aria-live="polite" // Announce loading state change
                  >
                     {isCheckingOut ? (
                      <>
                       <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                       Processing...
                      </>
                     ) : (
                      getFinalAmount() <= 0.009 && useGeptoCoins ? 'Place Order with Coins' : 'Proceed to Payment' // Adjust button text
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
