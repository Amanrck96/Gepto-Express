'use client'; // Needed for hooks like useState, useEffect

import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox'; // Import Checkbox
import { Label } from '@/components/ui/label'; // Import Label
import { ShoppingCart, MapPin, Search, Plus, Minus, Loader2, Coins, Info } from 'lucide-react'; // Added Loader2 and Coins
import Image from 'next/image';
import type { Location } from '@/services/geocoding';
import type { Store } from '@/services/store';
import type { Category, Product } from '@/services/product';
import { getAddress, getLocation } from '@/services/geocoding';
import { getNearbyStores } from '@/services/store';
import { getProductCategories, getProductsByStoreAndCategory } from '@/services/product';
import { useToast } from '@/hooks/use-toast';
import { initiatePayment } from '@/actions/payment'; // Import the server action
import Script from 'next/script'; // Import Next.js Script component
import type { CashfreeDropinOptions } from '@/types/cashfree'; // Import types
import { useAuth } from '@/context/AuthContext'; // Import useAuth


// Mock Cart Item Type - Export it so it can be used in actions/payment.ts
export interface CartItem extends Product {
  quantity: number;
}

export default function Home() {
  const { user } = useAuth(); // Get user from AuthContext
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
  const [geptoCoinBalance, setGeptoCoinBalance] = useState(0); // Default to 0
  const [useGeptoCoins, setUseGeptoCoins] = useState(false); // State for checkbox
  const [isCashfreeSdkReady, setIsCashfreeSdkReady] = useState(false); // Track if SDK script has loaded
  const cashfreeInstanceRef = useRef<any>(null); // Ref to store the initialized SDK instance
  const [paymentMode, setPaymentMode] = useState<'online' | 'cod'>('online');

  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      // TODO: Fetch user-specific Gepto Coins from Firestore or your backend
      // For now, using a placeholder value if user is logged in.
      setGeptoCoinBalance(100);
    } else {
      setGeptoCoinBalance(0); // Reset coins if no user
    }
  }, [user]);

  // Determine Cashfree mode based on NEXT_PUBLIC_CASHFREE_APP_ID prefix from environment
  const appId = process.env.NEXT_PUBLIC_CASHFREE_APP_ID;
  const isProductionEnv = process.env.NODE_ENV === 'production';


  // Use App ID for mode determination, ensuring it defaults to sandbox if App ID is missing
  const isLiveMode = appId && !appId.startsWith('TEST');
  const cashfreeMode = isLiveMode ? 'production' : 'sandbox';


  console.log(`Cashfree Frontend Mode: ${cashfreeMode} (Using App ID starting with: ${appId ? appId.substring(0, 4) : 'N/A'}, NODE_ENV: ${process.env.NODE_ENV})`);

  // Use Cashfree v3 Drop-in SDK URLs
  const cashfreeScriptSrc = cashfreeMode === 'production'
    ? 'https://sdk.cashfree.com/js/v3/cashfree.js' // v3 Production script
    : 'https://sdk.cashfree.com/js/v3/cashfree.sandbox.js'; // v3 Sandbox script


  // --- SDK Initialization ---
  // Function called when the SDK script loads successfully
  const handleCashfreeScriptLoad = () => {
    console.log(`Cashfree Drop-in SDK (v3) script loaded from ${cashfreeScriptSrc}. Mode: ${cashfreeMode}`);
    setIsCashfreeSdkReady(true);
    if (window.Cashfree) {
      try {
        cashfreeInstanceRef.current = new (window as any).Cashfree();
        console.log('Cashfree SDK instance created (pre-init).');
      } catch (error) {
         console.error('Error creating Cashfree SDK instance:', error);
         toast({
            title: "Payment Init Error",
            description: "Could not create payment interface instance.",
            variant: "destructive",
         });
      }
    } else {
      console.error("Cashfree SDK script loaded but window.Cashfree is not available.");
       toast({
          title: "Payment Init Error",
          description: "Payment script loaded incorrectly.",
          variant: "destructive",
       });
    }
  };

  // Function to handle SDK script loading errors
  const handleCashfreeScriptError = (e: any) => {
    console.error(`Cashfree Drop-in SDK (v3) script failed to load from URL: ${cashfreeScriptSrc}. Error:`, e);
    toast({
        title: "Payment Script Load Error",
        description: `Failed to load payment script from ${cashfreeScriptSrc}. Please check your internet connection, disable ad-blockers, and refresh.`,
        variant: "destructive",
        duration: 10000, // Longer duration for a more detailed message
    });
    setIsCashfreeSdkReady(false);
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
      const loc = await getLocation(manualAddress);
      setLocation(loc);
      setAddress(manualAddress);
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


  // 2. Fetch nearby stores based on location
  useEffect(() => {
    if (location && address.toLowerCase().includes('cooch behar')) {
      setLoadingStores(true);
      getNearbyStores(location, 5) // 5km radius
        .then(setStores)
        .catch(err => {
          console.error("Error fetching stores:", err);
          toast({ title: "Store Fetch Error", description: "Could not load nearby stores.", variant: "destructive" });
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
        toast({ title: "Category Fetch Error", description: "Could not load product categories.", variant: "destructive" });
      })
      .finally(() => setLoadingCategories(false));
  }, [toast]);

  // 4. Fetch products when category and store selected
  useEffect(() => {
    if (selectedCategory && stores.length > 0) {
      setLoadingProducts(true);
       if (stores[0]?.id) {
           getProductsByStoreAndCategory(stores[0].id, selectedCategory.id)
           .then(setProducts)
           .catch(err => {
             console.error(`Error fetching products for category ${selectedCategory.name}:`, err);
             toast({ title: "Product Fetch Error", description: `Could not load ${selectedCategory.name}.`, variant: "destructive" });
             setProducts([]);
           })
           .finally(() => setLoadingProducts(false));
       } else {
           console.warn("No valid store ID found to fetch products for selected category.");
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
  };

   const getCartTotal = () => {
    const total = cart.reduce((total, item) => total + item.price * item.quantity, 0);
    return Math.max(0, total);
   };

   const getFinalAmount = () => {
     const total = getCartTotal();
     if (useGeptoCoins && geptoCoinBalance > 0) {
       const amountToCover = Math.min(total, geptoCoinBalance);
       return Math.max(0, total - amountToCover);
     }
     return total;
   };

   const getCoinsUsed = () => {
     const total = getCartTotal();
      if (useGeptoCoins && geptoCoinBalance > 0) {
        return Math.min(total, geptoCoinBalance);
      }
      return 0;
   }

  const getCartItemCount = () => {
    return cart.reduce((count, item) => count + item.quantity, 0);
  };

  // Checkout Function - Updated for v3 Drop-in SDK
  const handleCheckout = async () => {
     if (cart.length === 0) {
       toast({ title: "Empty Cart", description: "Please add items to your cart before checkout.", variant: "destructive" });
       return;
     }
      if (!location || !address.toLowerCase().includes('cooch behar')) {
        toast({ title: "Invalid Location", description: "Please set a valid delivery address in Cooch Behar.", variant: "destructive" });
        return;
     }

     const finalAmount = getFinalAmount();
     if (finalAmount > 0 && finalAmount < 1.00 && paymentMode === 'online') {
         toast({
            title: "Minimum Amount",
            description: "Minimum order amount for online payment is ₹1.00.",
            variant: "destructive",
         });
         return;
     }

      if (paymentMode === 'online') {
          if (!isCashfreeSdkReady || !cashfreeInstanceRef.current) {
           console.error("Checkout attempt failed: Cashfree SDK not ready or instance not created.");
           toast({
             title: "Payment Error",
             description: "Payment system is not ready. Please wait a moment or refresh the page.",
             variant: "destructive",
           });
           return;
         }
      }

     setIsCheckingOut(true);

     const customerId = user?.uid || `GEPTO_GUEST_${Math.random().toString(36).substring(2, 10)}`;
     const customerEmail = user?.email || 'guest@gepto.example.com';
     const customerPhone = user?.phoneNumber || '9999999999'; // Placeholder, ideally get from profile
     const customerName = user?.displayName || 'Gepto Guest';


     const customerDetails = {
       customerId: customerId,
       customerEmail: customerEmail,
       customerPhone: customerPhone,
       customerName: customerName
     };

     try {
       const total = getCartTotal();
       const coinsToUse = getCoinsUsed();

       console.log(`Checkout Initiated: Total=₹${total.toFixed(2)}, Coins Used=${coinsToUse.toFixed(0)}, Final Amount=₹${finalAmount.toFixed(2)}, Payment Mode: ${paymentMode}`);
       console.log('Calling initiatePayment server action...');

       const response = await initiatePayment({
         items: cart,
         totalAmount: total,
         customerDetails: customerDetails,
         useGeptoCoins: useGeptoCoins,
         geptoCoinBalance: geptoCoinBalance,
         paymentMode: paymentMode,
       });

       console.log('Server action response:', response);

       if (response.success) {
            if (response.payment_session_id && response.order_id && paymentMode === 'online') {
                console.log(`Payment session created: ${response.payment_session_id} for order: ${response.order_id}. Opening Drop-in...`);

                 const dropinOptions: CashfreeDropinOptions = {
                    paymentSessionId: response.payment_session_id,
                    orderId: response.order_id,
                    components: [ "order-details", "card", "upi", "app", "netbanking" ],
                    onSuccess: (data) => {
                        console.log('Cashfree Drop-in Success:', data);
                        toast({
                          title: "Payment Successful",
                          description: `Order ${data.order?.orderId} placed successfully.`,
                        });
                         window.location.href = `/order/status?order_id=${data.order?.orderId}`;
                    },
                    onFailure: (data) => {
                         console.error('Cashfree Drop-in Failure:', data);
                         toast({
                           title: "Payment Failed",
                           description: data.order?.errorText || "Payment could not be completed.",
                           variant: "destructive",
                         });
                          window.location.href = `/order/status?order_id=${data.order?.orderId}`;
                    },
                 };
                 cashfreeInstanceRef.current.drop(dropinOptions);

            } else if (response.order_id && !response.payment_session_id) {
                console.log(`Order placed using ${paymentMode === 'online' && finalAmount < 0.01 ? 'Gepto Coins' : 'Cash on Delivery'}. Order ID: ${response.order_id}`);
                toast({
                    title: "Order Placed",
                    description: response.message || `Successfully placed order using ${paymentMode === 'online' && finalAmount < 0.01 ? 'Gepto Coins' : 'Cash on Delivery'}.`,
                });
                setCart([]); 
                setUseGeptoCoins(false); 
                setTimeout(() => {
                    window.location.href = `/order/status?order_id=${response.order_id}`;
                }, 1500);
            } else {
                 console.error("Checkout Error: Server action successful but response missing required IDs for online payment flow.");
                 throw new Error("Invalid response from server. Online payment cannot proceed.");
            }
       } else {
         console.error("Checkout Error: Server action failed.", response.error);
         throw new Error(response.error || 'Failed to initiate payment process. Please try again.');
       }
     } catch (error: any) {
       console.error('Checkout error during handleCheckout:', error);
       toast({
         title: 'Checkout Failed',
         description: error.message || 'Could not start payment. Please try again or contact support.',
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
      <Script
        id="cf-dropin-js"
        src={cashfreeScriptSrc}
        strategy="lazyOnload" 
        onLoad={handleCashfreeScriptLoad} 
        onError={handleCashfreeScriptError} 
      />

      <div className="space-y-8">
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

        {location && address.toLowerCase().includes('cooch behar') ? (
          <>
            {loadingStores && <p>Loading nearby stores...</p>}
            {stores.length > 0 && !loadingStores && (
              <p className="text-sm text-muted-foreground">Showing items from: <strong>{stores[0].name}</strong> (Nearest)</p>
            )}
             {stores.length === 0 && !loadingStores && !loadingLocation && (
              <p className="text-sm text-destructive">No stores found nearby in Cooch Behar.</p>
            )}

             {stores.length > 0 && (
                 <section>
                   <h2 className="text-2xl font-semibold mb-4">Categories</h2>
                   {loadingCategories ? (
                     <div className="flex flex-wrap gap-2">
                        <div className="h-9 w-20 bg-muted rounded-md animate-pulse"></div>
                        <div className="h-9 w-24 bg-muted rounded-md animate-pulse"></div>
                        <div className="h-9 w-16 bg-muted rounded-md animate-pulse"></div>
                     </div>
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
                      <p>No product categories found for this store.</p>
                   )}
                 </section>
             )}

            {selectedCategory && stores.length > 0 && (
              <section>
                <h2 className="text-2xl font-semibold mb-4">
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
                  />
                </div>

                {loadingProducts ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                     {[...Array(4)].map((_, i) => (
                       <Card key={i} className="overflow-hidden flex flex-col animate-pulse">
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
                      <Card key={product.id} className="overflow-hidden flex flex-col transition-shadow hover:shadow-md">
                         <div className="relative aspect-square w-full overflow-hidden bg-muted">
                             <Image
                               src={product.imageUrl && product.imageUrl.startsWith('https://picsum.photos') ? product.imageUrl : `https://picsum.photos/300/300?random=${product.id}`}
                               alt={product.name}
                               fill 
                               sizes="(max-width: 640px) 90vw, (max-width: 768px) 45vw, (max-width: 1024px) 30vw, 23vw" 
                               style={{ objectFit: 'cover' }} 
                               data-ai-hint="product grocery item"
                               onError={(e) => {
                                   const target = e.target as HTMLImageElement;
                                   if (!target.src.startsWith('https://picsum.photos')) {
                                        target.src = `https://picsum.photos/300/300?random=${product.id}`;
                                   }
                               }}
                             />
                         </div>
                        <CardContent className="p-4 flex-grow">
                          <CardTitle className="text-lg mb-1 line-clamp-1">{product.name}</CardTitle>
                          <CardDescription className="text-sm mb-2 line-clamp-2">{product.description}</CardDescription>
                          <Badge variant="secondary">₹{product.price.toFixed(2)}</Badge>
                        </CardContent>
                        <CardFooter className="p-4 pt-0 mt-auto"> 
                          {cart.find(item => item.id === product.id) ? (
                             <div className="flex items-center gap-2 w-full justify-between">
                                <Button aria-label={`Decrease quantity of ${product.name}`} variant="outline" size="icon" onClick={() => removeFromCart(product.id)} className="h-8 w-8 transition-transform active:scale-90">
                                  <Minus className="h-4 w-4" />
                                </Button>
                                <span className="font-medium w-4 text-center tabular-nums" aria-live="polite">
                                  {cart.find(item => item.id === product.id)?.quantity}
                                </span>
                                <Button aria-label={`Increase quantity of ${product.name}`} variant="default" size="icon" onClick={() => addToCart(product)} className="h-8 w-8 transition-transform active:scale-90">
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
                  <p className="text-muted-foreground mt-4">No products found {searchTerm ? `matching "${searchTerm}"` : ""} in {selectedCategory.name}.</p>
                )}
              </section>
            )}

             {cart.length > 0 && (
              <Card className="fixed bottom-4 right-4 w-72 shadow-xl z-50 bg-card border">
                <CardHeader className="pb-2"> 
                  <CardTitle className="flex items-center justify-between text-lg">
                    Your Cart
                    <Badge>{getCartItemCount()}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="py-2 max-h-48 overflow-y-auto"> 
                    <ul className="text-xs space-y-1 text-muted-foreground mb-2">
                      {cart.slice(0, 5).map(item=>( 
                          <li key={item.id} className="flex justify-between">
                              <span className="truncate pr-1">{item.name} x {item.quantity}</span>
                               <span className="whitespace-nowrap">₹{(item.price * item.quantity).toFixed(2)}</span>
                          </li>
                      ))}
                       {cart.length > 5 && <li className="text-center text-xs">...and more</li>}
                    </ul>

                     <div className="text-sm mb-2 border-t pt-2">Subtotal: ₹{getCartTotal().toFixed(2)}</div>

                    <div className="flex items-center space-x-2 mb-2 border-t pt-2">
                       <Checkbox
                          id="useGeptoCoins"
                          checked={useGeptoCoins}
                          onCheckedChange={(checked) => setUseGeptoCoins(checked as boolean)}
                          disabled={geptoCoinBalance <= 0 || getCartTotal() <= 0}
                          aria-label={`Use Gepto Coins. Available balance: ${geptoCoinBalance}`}
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
                          - ₹{getCoinsUsed().toFixed(2)} (Applied)
                        </div>
                    )}

                   <div className="text-lg font-semibold mb-1 border-t pt-2">
                      Final Amount: ₹{getFinalAmount().toFixed(2)}
                   </div>
                </CardContent>
                <CardFooter className="flex-col items-start">
                    <div className="flex justify-between items-center w-full mb-2">
                        <Label htmlFor="paymentMode" className="text-sm">Payment Mode:</Label>
                        <select
                            id="paymentMode"
                            className="ml-2 p-1 border rounded text-sm bg-background text-foreground"
                            value={paymentMode}
                            onChange={(e) => setPaymentMode(e.target.value as 'online' | 'cod')}
                        >
                            <option value="online">Online</option>
                            <option value="cod">Cash on Delivery</option>
                        </select>
                    </div>
                  <Button
                      onClick={handleCheckout}
                      className="w-full transition-transform active:scale-95"
                      disabled={
                         isCheckingOut || 
                         (paymentMode === 'online' && getFinalAmount() > 0 && !isCashfreeSdkReady) || 
                         !location || 
                         !address.toLowerCase().includes('cooch behar') || 
                         (paymentMode === 'online' && getFinalAmount() > 0 && getFinalAmount() < 1.00) 
                       }
                      aria-live="polite" 
                      aria-label={isCheckingOut ? "Processing payment" : (getFinalAmount() <= 0.01 && useGeptoCoins && paymentMode === 'online' ? "Place order using Gepto Coins" : (paymentMode === 'cod' ? "Place Order with COD" : "Proceed to Online Payment"))}
                  >
                     {isCheckingOut ? (
                      <>
                       <Loader2 className="mr-2 h-4 w-4 animate-spin" />
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
           !loadingLocation && (
              <div className="text-center text-muted-foreground mt-8">
                 <p>Please set your delivery location in Cooch Behar to start shopping.</p>
              </div>
           )
        )}
      </div>
    </>
  );
}

declare global {
  interface Window {
    Cashfree?: {
        new (): any; 
        drop(options: CashfreeDropinOptions): void;
    };
  }
}
