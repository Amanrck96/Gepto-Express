
'use server';

import { Cashfree, CashfreeConfig } from 'cashfree-pg';
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

// Define the Cashfree API version date (required for v4 SDK)
const CASHFREE_API_VERSION = "2023-08-01";

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
   if (!customerDetails || !customerDetails.customerId || !customerDetails.customerEmail || !customerDetails.customerPhone) {
      console.error('Cashfree Error: Invalid customer details provided.', customerDetails);
      return { success: false, error: 'Missing required customer details (ID, Email, Phone).' };
   }

  // Determine environment based on NODE_ENV or a specific Cashfree env variable
  const cashfreeEnv = process.env.NODE_ENV === 'production'
                        ? Cashfree.Environment.PRODUCTION
                        : Cashfree.Environment.SANDBOX;

  console.log(`Cashfree Info: Configuring Cashfree SDK in ${cashfreeEnv === Cashfree.Environment.PRODUCTION ? 'PRODUCTION' : 'SANDBOX'} mode.`);

  try {
    // --- SDK v4.x Configuration ---
    // Set credentials and environment directly on the Cashfree class
    Cashfree.XClientId = appId;
    Cashfree.XClientSecret = secretKey;
    Cashfree.XEnvironment = cashfreeEnv;
    // Cashfree.XApiVersion = CASHFREE_API_VERSION; // Optional, but good practice for v4

    console.log('Cashfree Info: SDK v4.x configured using static properties.');
    // Check if static properties are set (basic sanity check)
     if (!Cashfree.XClientId || !Cashfree.XClientSecret) {
        throw new Error('Failed to set Cashfree static configuration properties.');
     }

  } catch (configError: any) {
    console.error('Cashfree Error: Error during Cashfree SDK v4.x configuration:', configError);
    return { success: false, error: `Payment SDK configuration error: ${configError.message || 'Failed to configure SDK.'}` };
  }

  const orderId = `GEPTO-${uuidv4()}`; // Generate a unique order ID

  // Construct return URL, ensuring HTTPS as required by Cashfree
  let appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:9002';

  // --- HTTPS Enforcement for return URL ---
   // Use HTTPS for production or if NEXT_PUBLIC_APP_URL starts with https
  if (process.env.NODE_ENV === 'production' || appUrl.startsWith('https://')) {
      if (appUrl.startsWith('http://')) {
          console.warn(`Cashfree Warning: App URL (${appUrl}) uses http in production/explicitly. Forcing https for Cashfree return_url.`);
          appUrl = appUrl.replace('http://', 'https://');
      } else if (!appUrl.startsWith('https://')) {
          console.warn(`Cashfree Warning: App URL (${appUrl}) does not specify a protocol. Assuming https for Cashfree return_url.`);
          appUrl = `https://${appUrl}`;
      }
  } else if (appUrl.startsWith('http://localhost')) {
      // Allow http only for localhost during development
       console.log(`Cashfree Info: Using HTTP return URL for localhost development: ${appUrl}`);
  }
   else if (appUrl.startsWith('http://')) {
      // Force HTTPS if it's http but *not* localhost
       console.warn(`Cashfree Warning: App URL (${appUrl}) uses http. Forcing https for Cashfree return_url as it's not localhost.`);
       appUrl = appUrl.replace('http://', 'https://');
   }
   else {
      // Default to HTTPS if protocol is missing and not localhost
      console.warn(`Cashfree Warning: App URL (${appUrl}) does not specify a protocol. Assuming https for Cashfree return_url.`);
      appUrl = `https://${appUrl}`;
   }
  // --- End HTTPS Enforcement ---


  const returnUrl = `${appUrl}/order/status?order_id=${orderId}`; // URL to redirect after payment


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
        // notify_url: `${appUrl}/api/webhooks/cashfree`, // Optional: Server-to-server notification URL also needs HTTPS
      },
      order_note: `Order from Gepto Express for ${items.length} items.`,
       // Optional: Add expiry time (e.g., 15 minutes)
      order_expiry_time: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    };

    // **Diagnosis Step 1: Check if the request object itself is null/undefined**
    if (!request) {
        console.error('Cashfree FATAL Error: The constructed `request` object is unexpectedly null or undefined before calling PGCreateOrder.');
        return { success: false, error: 'Internal server error: Failed to construct payment request data.' };
    }

    // **Diagnosis Step 2: Log the exact request object being sent**
    console.log('Cashfree Info: Preparing to call PGCreateOrder with request object:', JSON.stringify(request, null, 2));
    console.log(`Cashfree Info: Using API Version: ${CASHFREE_API_VERSION}`);


    // **Diagnosis Step 3: Check if the static method exists on the Cashfree class**
    if (typeof Cashfree.PGCreateOrder !== 'function') {
        console.error('Cashfree FATAL Error: Static method `Cashfree.PGCreateOrder` not found. SDK might be improperly initialized, version mismatch, or corrupted installation.');
        return { success: false, error: 'Payment SDK configuration error: CreateOrder method is not available. Please check server logs.' };
    }

    console.log('Cashfree Info: Static method `Cashfree.PGCreateOrder` found. Proceeding with API call (v4.x style).');

    // *** Use the static method 'PGCreateOrder' with API version as the first argument (v4.x SDK style) ***
    const response = await Cashfree.PGCreateOrder(CASHFREE_API_VERSION, request); // Pass API version first, then request

    console.log('Cashfree Info: Order creation response received.');

    if (response.data && response.data.payment_session_id) {
      console.log(`Cashfree Info: Successfully created payment session: ${response.data.payment_session_id} for order: ${orderId}`);
      return {
        success: true,
        payment_session_id: response.data.payment_session_id,
        order_id: orderId,
      };
    } else {
      const errorMessage = response?.data?.message || 'Failed to create payment session (no session ID received).';
      console.error('Cashfree Error: Failed to create payment session after API call.', response?.data || 'No data in response');
      return { success: false, error: errorMessage };
    }
  } catch (error: any) {
    console.error('Cashfree Error: Exception during PGCreateOrder call:', error);

    let errorMessage = 'An unexpected error occurred during payment initiation.';
    if (error.response && error.response.data && error.response.data.message) {
        // Error is likely from the Cashfree API itself
        errorMessage = error.response.data.message;
         if (error.response.data.code) {
             errorMessage += ` (Code: ${error.response.data.code})`;
         }
         console.error('Cashfree Error: Detailed API Error:', error.response.data);
         // Specific check for the "null or undefined" error originating from the API response (less likely for this exact message)
         if (errorMessage.includes('Required parameter CreateOrderRequest was null or undefined')) {
             console.error('Cashfree Diagnosis: API returned "CreateOrderRequest was null or undefined". Check the logged request object.');
             errorMessage = 'Payment gateway rejected the request. Please ensure all details are correct.';
         }

    } else if (error.message) { // Handle errors not from Cashfree API
        errorMessage = error.message;
        if (!error.response) {
            console.error('Cashfree Error: Non-API Error details:', error);
        }
        // Check if the error message relates to SDK issues
         if (errorMessage.includes('Cashfree.PGCreateOrder is not a function')) {
             errorMessage = 'Payment SDK initialization error: CreateOrder method missing.'
         } else if (errorMessage.includes('Required parameter CreateOrderRequest was null or undefined')) {
             // This is the most likely path for the current user error
             console.error('Cashfree Diagnosis: SDK likely threw "CreateOrderRequest was null or undefined" error *before* API call. This often happens if the API version argument is missing or incorrect for the SDK version being used (e.g., v4.x). Verify the `Cashfree.PGCreateOrder(apiVersion, request)` call signature.');
             errorMessage = 'Internal server error: Invalid payment request data or SDK call signature.';
         } else if (errorMessage.includes('Payment SDK failed to initialize properly')) {
             // Catching the specific error from the previous step
              console.error('Cashfree Diagnosis: SDK initialization failed, possibly due to configuration issues (check static properties like XClientId, XClientSecret, XEnvironment) or internal SDK problems.');
              errorMessage = 'Payment SDK initialization failed. Check server configuration.';
         }
    } else {
         console.error('Cashfree Error: Unknown error structure:', error);
    }

    return { success: false, error: errorMessage };
  }
}
