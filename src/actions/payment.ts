
'use server';

import { Cashfree } from 'cashfree-pg';
import { v4 as uuidv4 } from 'uuid';
import type { CartItem } from '@/app/page'; // Assuming CartItem type is exported from page.tsx

// Define input structure for the payment initiation
interface InitiatePaymentInput {
  items: CartItem[];
  totalAmount: number;
  customerDetails: {
    customerId: string; // Unique ID for the customer
    customerEmail: string;
    customerPhone: string;
    customerName?: string; // Optional but recommended
  };
}

// Define the expected response structure
interface InitiatePaymentResponse {
  success: boolean;
  payment_session_id?: string;
  order_id?: string;
  error?: string;
  redirectUrl?: string; // In case direct redirect is needed
}

export async function initiatePayment(
  input: InitiatePaymentInput
): Promise<InitiatePaymentResponse> {
  const { items, totalAmount, customerDetails } = input;

  if (!process.env.CASHFREE_APP_ID || !process.env.CASHFREE_SECRET_KEY) {
    console.error('Cashfree API keys are not configured.');
    return { success: false, error: 'Payment gateway configuration error.' };
  }

  if (totalAmount <= 0) {
      return { success: false, error: 'Invalid order amount.' };
  }

  // Initialize Cashfree with credentials
  const cashfree = new Cashfree({
    api_key: process.env.CASHFREE_APP_ID!,
    api_secret: process.env.CASHFREE_SECRET_KEY!,
    env: 'PRODUCTION', // Or 'SANDBOX' based on your environment
  });


  const orderId = `GEPTO-${uuidv4()}`; // Generate a unique order ID
  const returnUrl = `${process.env.NEXT_PUBLIC_APP_URL}/order/status?order_id=${orderId}`; // URL to redirect after payment

  try {
    const request = {
      order_amount: totalAmount,
      order_currency: 'INR',
      order_id: orderId,
      customer_details: {
        customer_id: customerDetails.customerId,
        customer_email: customerDetails.customerEmail,
        customer_phone: customerDetails.customerPhone,
        customer_name: customerDetails.customerName || customerDetails.customerEmail.split('@')[0], // Use email prefix if name not provided
      },
      order_meta: {
        return_url: returnUrl,
        // notify_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/cashfree`, // Optional: Server-to-server notification URL
      },
      order_note: `Order from Gepto Express for ${items.length} items.`,
       // Optional: Add expiry time (e.g., 15 minutes)
      order_expiry_time: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    };

    console.log('Cashfree Order Request:', request);

    // Use the instantiated cashfree object to call PGOrderCreate
    const response = await cashfree.orders.create(request);

    console.log('Cashfree Order Response:', response.data);


    if (response.data && response.data.payment_session_id) {
      return {
        success: true,
        payment_session_id: response.data.payment_session_id,
        order_id: orderId,
        // Optionally return redirectUrl if using redirection method
        // redirectUrl: response.data.payment_link or similar if needed
      };
    } else {
      // Handle potential errors or unexpected responses from Cashfree
      const errorMessage = response.data?.message || 'Failed to create payment session.';
      console.error('Cashfree Error:', errorMessage, response.data);
      return { success: false, error: errorMessage };
    }
  } catch (error: any) {
    console.error('Error initiating payment:', error);
    // Check for Cashfree specific error structure
     // Improved error handling for Cashfree specific responses
    let errorMessage = 'An unexpected error occurred during payment initiation.';
    if (error.response && error.response.data && error.response.data.message) {
        errorMessage = error.response.data.message;
         if (error.response.data.code) {
             errorMessage += ` (Code: ${error.response.data.code})`;
         }
    } else if (error.message) {
        errorMessage = error.message;
    }
    console.error('Detailed Cashfree Error:', error.response?.data || error);
    return { success: false, error: errorMessage };
  }
}

