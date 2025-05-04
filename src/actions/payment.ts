
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

  const appId = process.env.CASHFREE_APP_ID;
  const secretKey = process.env.CASHFREE_SECRET_KEY;

  if (!appId || !secretKey) {
    console.error('Cashfree Error: CASHFREE_APP_ID or CASHFREE_SECRET_KEY environment variables are not set.');
    return { success: false, error: 'Payment gateway configuration error. Server environment variables missing.' };
  }
  console.log('Cashfree Info: Found App ID and Secret Key.');

  if (totalAmount <= 0) {
      console.error(`Cashfree Error: Invalid order amount: ${totalAmount}`);
      return { success: false, error: 'Invalid order amount.' };
  }

  // Determine environment - Since production keys were provided, hardcode to PRODUCTION
  // const cashfreeEnv = secretKey.includes('_test_') ? 'SANDBOX' : 'PRODUCTION'; // Previous dynamic check
  const cashfreeEnv = 'PRODUCTION'; // Explicitly set based on provided keys
  console.log(`Cashfree Info: Initializing Cashfree SDK in ${cashfreeEnv} mode.`);

  let cashfree: Cashfree;
  try {
      console.log('Cashfree Info: Attempting to initialize Cashfree SDK...');
      cashfree = new Cashfree({
        api_key: appId,
        api_secret: secretKey,
        env: cashfreeEnv,
      });

      // Add more robust checks after initialization attempt
      if (!cashfree) {
           console.error('Cashfree Error: Cashfree SDK object is null or undefined after initialization.');
           throw new Error('Payment SDK initialization returned undefined.');
      }
      if (typeof cashfree.orders === 'undefined') {
          console.error('Cashfree Error: Cashfree SDK initialized, but `orders` property is missing.', cashfree);
          throw new Error('Payment SDK failed to initialize properly (missing orders property).');
      }
       if (typeof cashfree.orders.create !== 'function') {
          console.error('Cashfree Error: Cashfree SDK initialized, but `orders.create` is not a function.', cashfree.orders);
          throw new Error('Payment SDK failed to initialize properly (missing orders.create function).');
      }

      console.log('Cashfree Info: Cashfree SDK initialized successfully.');

  } catch (initError: any) {
        console.error('Cashfree Error: Error during Cashfree SDK initialization:', initError);
        // Provide a more specific error message if possible
        const errorMessage = initError.message || 'Unknown initialization error.';
        return { success: false, error: `Payment SDK initialization error: ${errorMessage}` };
  }


  const orderId = `GEPTO-${uuidv4()}`; // Generate a unique order ID
  const returnUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:9002'}/order/status?order_id=${orderId}`; // URL to redirect after payment

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

    console.log('Cashfree Info: Creating order with request:', request);

    // Use the instantiated cashfree object to call orders.create
    const response = await cashfree.orders.create(request);

    console.log('Cashfree Info: Order creation response received.');
    // Avoid logging sensitive parts of the response in production if possible
    // console.log('Cashfree Order Response:', response.data);


    if (response.data && response.data.payment_session_id) {
      console.log(`Cashfree Info: Successfully created payment session: ${response.data.payment_session_id} for order: ${orderId}`);
      return {
        success: true,
        payment_session_id: response.data.payment_session_id,
        order_id: orderId,
        // Optionally return redirectUrl if using redirection method
        // redirectUrl: response.data.payment_link or similar if needed
      };
    } else {
      // Handle potential errors or unexpected responses from Cashfree
      const errorMessage = response?.data?.message || 'Failed to create payment session (no session ID received).';
      console.error('Cashfree Error: Failed to create payment session.', response?.data || 'No data in response');
      return { success: false, error: errorMessage };
    }
  } catch (error: any) {
    console.error('Cashfree Error: Error during order creation:', error);

    // Improved error handling for Cashfree specific responses
    let errorMessage = 'An unexpected error occurred during payment initiation.';
    // Check if the error is from Cashfree response or a different kind of error
    if (error.response && error.response.data && error.response.data.message) {
        errorMessage = error.response.data.message;
         if (error.response.data.code) {
             errorMessage += ` (Code: ${error.response.data.code})`;
         }
         console.error('Cashfree Error: Detailed API Error:', error.response.data);
    } else if (error.message) { // Handle errors not from Cashfree API (e.g., network, SDK internal)
        errorMessage = error.message;
        // Log the full error object if it's not a standard Cashfree response error
        if (!error.response) {
            console.error('Cashfree Error: Non-API Error details:', error);
        }
    } else {
         // Fallback for unknown error structure
         console.error('Cashfree Error: Unknown error structure:', error);
    }

    return { success: false, error: errorMessage };
  }
}

