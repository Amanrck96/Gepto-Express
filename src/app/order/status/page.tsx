'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { getOrderStatus } from '@/actions/order'; // Assume this action exists

type OrderStatus = 'PAID' | 'ACTIVE' | 'EXPIRED' | 'FAILED' | 'PENDING' | 'CANCELLED' | null;

export default function OrderStatusPage() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get('order_id');
  const [status, setStatus] = useState<OrderStatus>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!orderId) {
      setErrorMessage('No order ID found in the URL.');
      setIsLoading(false);
      return;
    }

    async function fetchStatus() {
      setIsLoading(true);
      setErrorMessage(null);
      try {
        console.log(`Fetching status for order_id: ${orderId}`);
        const result = await getOrderStatus(orderId);
        console.log('Order status result:', result);

        if (result.success && result.order_status) {
           // Normalize status for consistency if needed
           const normalizedStatus = result.order_status.toUpperCase() as OrderStatus;
           setStatus(normalizedStatus);
        } else {
          // Handle potential errors like order not found, API errors etc.
          setErrorMessage(result.error || 'Could not retrieve order status.');
          setStatus('FAILED'); // Assume failure if status couldn't be retrieved
        }
      } catch (error: any) {
        console.error('Error fetching order status:', error);
        setErrorMessage(error.message || 'An unexpected error occurred.');
        setStatus('FAILED');
      } finally {
        setIsLoading(false);
      }
    }

    fetchStatus();
  }, [orderId]); // Re-run effect if orderId changes

  const renderStatus = () => {
    if (isLoading) {
      return (
        <div className="flex flex-col items-center justify-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="text-muted-foreground">Checking payment status...</p>
        </div>
      );
    }

    if (errorMessage && status !== 'PAID') { // Show explicit errors unless it's actually paid
        return (
         <div className="flex flex-col items-center justify-center space-y-4 text-center">
            <AlertCircle className="h-12 w-12 text-destructive" />
            <p className="font-semibold text-destructive">Error Checking Status</p>
            <p className="text-muted-foreground">{errorMessage}</p>
             <p className="text-sm text-muted-foreground">Order ID: {orderId}</p>
          </div>
        );
    }


    switch (status) {
      case 'PAID':
        return (
          <div className="flex flex-col items-center justify-center space-y-4 text-center">
            <CheckCircle2 className="h-12 w-12 text-green-600" />
            <p className="font-semibold text-green-600">Payment Successful!</p>
            <p className="text-muted-foreground">Your order <span className="font-medium">{orderId}</span> has been placed.</p>
            <p className="text-muted-foreground">You will receive confirmation shortly.</p>
          </div>
        );
      case 'ACTIVE': // Cashfree might return ACTIVE if pending
      case 'PENDING':
         return (
          <div className="flex flex-col items-center justify-center space-y-4 text-center">
            <Loader2 className="h-12 w-12 animate-spin text-yellow-500" />
            <p className="font-semibold text-yellow-600">Payment Pending</p>
            <p className="text-muted-foreground">Your payment for order <span className="font-medium">{orderId}</span> is being processed.</p>
            <p className="text-muted-foreground">Please wait or check back later. Do not retry payment immediately.</p>
          </div>
        );
      case 'EXPIRED':
       return (
         <div className="flex flex-col items-center justify-center space-y-4 text-center">
            <AlertCircle className="h-12 w-12 text-destructive" />
            <p className="font-semibold text-destructive">Payment Session Expired</p>
            <p className="text-muted-foreground">The payment session for order <span className="font-medium">{orderId}</span> has expired.</p>
          </div>
        );
      case 'FAILED':
      case 'CANCELLED':
      default: // Includes null or unexpected statuses
        return (
          <div className="flex flex-col items-center justify-center space-y-4 text-center">
            <AlertCircle className="h-12 w-12 text-destructive" />
            <p className="font-semibold text-destructive">Payment Failed</p>
            <p className="text-muted-foreground">
              {errorMessage || `The payment for order ${orderId ? ` ${orderId}`: ''} could not be completed.`}
            </p>
             {orderId && <p className="text-sm text-muted-foreground">Order ID: {orderId}</p>}
          </div>
        );
    }
  };

  return (
    <div className="container mx-auto px-4 py-12 flex justify-center">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Order Status</CardTitle>
           <CardDescription>
             {isLoading ? 'Loading...' : `Status for Order ID: ${orderId || 'N/A'}`}
           </CardDescription>
        </CardHeader>
        <CardContent className="min-h-[150px] flex items-center justify-center">
          {renderStatus()}
        </CardContent>
        <CardFooter className="flex justify-center">
          <Button asChild variant="outline">
            <Link href="/">Return to Home</Link>
          </Button>
          {/* Optionally add a 'Try Again' button if status is Failed/Expired */}
          {(status === 'FAILED' || status === 'EXPIRED') && !isLoading && (
             <Button asChild variant="default" className="ml-4">
                 {/* This should ideally take the user back to the cart or a retry mechanism */}
                <Link href="/">Try Again</Link>
             </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
