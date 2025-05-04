
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

// Define the Cashfree API version date (required for v4 SDK, optional but good practice for v5+)
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
    // Initialize Cashfree SDK using the V5+ constructor style
    // This configures the SDK globally for subsequent static method calls
    const config: CashfreeConfig = {
        env: cashfreeEnv,
        appId: appId,
        secretKey: secretKey,
        apiVersion: CASHFREE_API_VERSION // Optional: specify API version
    };
    // Create instance to configure SDK globally (no need to store the instance variable)
    new Cashfree(config);
    console.log('Cashfree Info: SDK globally configured.');

  } catch (configError: any) {
    console.error('Cashfree Error: Error during Cashfree SDK instantiation:', configError);
    // Return the specific error message if available
    return { success: false, error: `Payment SDK initialization error: ${configError.message || 'Failed to create SDK instance.'}` };
  }

  const orderId = `GEPTO-${uuidv4()}`; // Generate a unique order ID

  // Construct return URL, ensuring HTTPS as required by Cashfree
  let appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:9002';

  // Force HTTPS for the return URL in production or if explicitly set
  // Allow HTTP only for localhost development if NEXT_PUBLIC_APP_URL starts with http://localhost
  if (!appUrl.startsWith('http://localhost') && !appUrl.startsWith('https://')) {
     // If not localhost and not https, force https
     if (appUrl.startsWith('http://')) {
       console.warn(`Cashfree Warning: App URL (${appUrl}) uses http. Forcing https for Cashfree return_url.`);
       appUrl = appUrl.replace('http://', 'https://');
     } else {
       console.warn(`Cashfree Warning: App URL (${appUrl}) does not specify a protocol. Assuming https for Cashfree return_url.`);
       appUrl = `https://${appUrl}`;
     }
  } else if (appUrl.startsWith('http://') && !appUrl.startsWith('http://localhost')) {
      // If it starts with http:// but is NOT localhost, force https
      console.warn(`Cashfree Warning: App URL (${appUrl}) uses http. Forcing https for Cashfree return_url as it's not localhost.`);
      appUrl = appUrl.replace('http://', 'https://');
  }


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
        // This case should ideally not happen based on the code, but adding a safeguard.
        return { success: false, error: 'Internal server error: Failed to construct payment request data.' };
    }

    // **Diagnosis Step 2: Log the exact request object being sent**
    // Use JSON.stringify to ensure all nested properties are logged clearly.
    console.log('Cashfree Info: Preparing to call PGCreateOrder with request object:', JSON.stringify(request, null, 2));

    // **Diagnosis Step 3: Check if the static method exists on the Cashfree class**
    // This helps confirm the SDK is loaded and configured correctly to the point where static methods are available.
    if (typeof Cashfree.PGCreateOrder !== 'function') {
        console.error('Cashfree FATAL Error: Static method `Cashfree.PGCreateOrder` not found. SDK might be improperly initialized, version mismatch, or corrupted installation.');
        return { success: false, error: 'Payment SDK configuration error: CreateOrder method is not available. Please check server logs.' };
    }

    console.log('Cashfree Info: Static method `Cashfree.PGCreateOrder` found. Proceeding with API call.');

    // *** Use the static method 'PGCreateOrder' from the Cashfree class ***
    const response = await Cashfree.PGCreateOrder(request); // Pass the validated and logged request object

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
      // Handle potential errors or unexpected responses from Cashfree *after* the call
      const errorMessage = response?.data?.message || 'Failed to create payment session (no session ID received).';
      console.error('Cashfree Error: Failed to create payment session after API call.', response?.data || 'No data in response');
      return { success: false, error: errorMessage };
    }
  } catch (error: any) {
    console.error('Cashfree Error: Exception during PGCreateOrder call:', error);

    // Improved error handling for Cashfree specific responses vs other errors
    let errorMessage = 'An unexpected error occurred during payment initiation.';
    if (error.response && error.response.data && error.response.data.message) {
        // Error is likely from the Cashfree API itself (e.g., validation error)
        errorMessage = error.response.data.message;
         if (error.response.data.code) {
             errorMessage += ` (Code: ${error.response.data.code})`;
         }
         console.error('Cashfree Error: Detailed API Error:', error.response.data);
         // **Check if the specific error message matches the user report**
         if (error.message && error.message.includes('Required parameter CreateOrderRequest was null or undefined')) {
             console.error('Cashfree Diagnosis: Received the "CreateOrderRequest was null or undefined" error. Check the logged request object above for potential issues.');
             // Provide a more user-friendly error in this specific case
             errorMessage = 'Payment gateway rejected the request. Please ensure all details (amount, customer info) are correct.';
         }

    } else if (error.message) { // Handle errors not from Cashfree API (e.g., network, SDK internal, coding errors)
        errorMessage = error.message;
        // Log the full error object if it's not a standard Cashfree response error
        if (!error.response) {
            console.error('Cashfree Error: Non-API Error details:', error);
        }
        // Check if the error message relates to the SDK initialization or method availability
         if (errorMessage.includes('Cashfree.PGCreateOrder is not a function')) {
             errorMessage = 'Payment SDK initialization error: CreateOrder method missing.'
         } else if (errorMessage.includes('Required parameter CreateOrderRequest was null or undefined')) {
             // This might occur if the SDK throws before even making the API call
             console.error('Cashfree Diagnosis: SDK threw "CreateOrderRequest was null or undefined" error *before* API call. This indicates the `request` object passed to `PGCreateOrder` was likely invalid (e.g., null, undefined, or wrong type).');
             errorMessage = 'Internal server error: Invalid payment request data constructed.';
         }
    } else {
         // Fallback for unknown error structure
         console.error('Cashfree Error: Unknown error structure:', error);
    }

    return { success: false, error: errorMessage };
  }
}

