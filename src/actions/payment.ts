
'use server';

import { Cashfree } from 'cashfree-pg';
import { v4 as uuidv4 } from 'uuid';
import type { CartItem } from '@/app/page'; // Assuming CartItem type is exported

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

// Initialize Cashfree SDK instance globally or within a helper function if preferred
// Ensure environment variables are loaded correctly
let cashfree: Cashfree | null = null;

function getCashfreeInstance(): Cashfree {
  if (cashfree) {
     // Check if the existing instance is still valid (basic check)
     if (typeof cashfree.orders?.create === 'function') {
       console.log('Cashfree Info: Reusing existing valid SDK instance.');
       return cashfree;
     } else {
        console.warn('Cashfree Warning: Existing SDK instance appears invalid. Re-initializing...');
        cashfree = null; // Force re-initialization
     }
  }

  console.log('Cashfree Info: Attempting to initialize new SDK instance...');
  const appId = process.env.CASHFREE_APP_ID;
  const secretKey = process.env.CASHFREE_SECRET_KEY;

  if (!appId || !secretKey) {
    console.error('Cashfree FATAL Error: CASHFREE_APP_ID or CASHFREE_SECRET_KEY environment variables are not set.');
    throw new Error('Payment gateway configuration error. Server environment variables missing.');
  }

  // Determine environment based on NODE_ENV or a specific Cashfree env variable
  const cashfreeEnv = process.env.NODE_ENV === 'production'
                        ? Cashfree.Environment.PRODUCTION
                        : Cashfree.Environment.SANDBOX;

  console.log(`Cashfree Info: Initializing SDK (v5+) in ${cashfreeEnv === Cashfree.Environment.PRODUCTION ? 'PRODUCTION' : 'SANDBOX'} mode.`);
  console.log(`Cashfree Info: Using App ID starting with: ${appId.substring(0, 6)}...`); // Log first few chars for verification

  try {
    // --- SDK v5+ Initialization ---
    const instance = new Cashfree(cashfreeEnv, appId, secretKey); // Initialize locally first
    console.log('Cashfree Info: SDK v5+ instance construction attempted.');

    // *** Add detailed check here ***
    // Verify the structure of the newly created instance BEFORE assigning it globally
    if (!instance || typeof instance.orders !== 'object' || instance.orders === null || typeof instance.orders.create !== 'function') {
        console.error('Cashfree FATAL Error: Newly created SDK instance is invalid or missing `orders.create` method immediately after construction. Instance:', instance);
        // Attempt to log keys of the instance if it exists, to help debug structure
        if(instance) {
             console.error('Cashfree FATAL Error: Keys found on invalid instance:', Object.keys(instance));
        }
        cashfree = null; // Ensure global remains null
        throw new Error('Payment SDK internal structure error after initialization. Check logs.');
    }

    console.log('Cashfree Info: SDK v5+ instance created successfully and seems valid.');
    cashfree = instance; // Assign to global variable only if valid
    return cashfree;
  } catch (configError: any) {
    console.error('Cashfree FATAL Error: Error during Cashfree SDK v5+ initialization or validation:', configError);
    cashfree = null; // Reset on error
    // Throw a more specific error to be caught by the caller
    throw new Error(`Payment SDK initialization failed: ${configError.message || 'Failed to configure SDK.'}`);
  }
}


export async function initiatePayment(
  input: InitiatePaymentInput
): Promise<InitiatePaymentResponse> {
  const { items, totalAmount, customerDetails } = input;
  let paymentInstance: Cashfree;

  // Ensure SDK instance is ready
   try {
     paymentInstance = getCashfreeInstance();
   } catch (sdkError: any) {
      // Catch initialization errors specifically
     console.error("Cashfree Error: Failed to get SDK instance during initiatePayment.", sdkError);
     // Provide a clearer error message based on the caught error
     return { success: false, error: `Payment SDK initialization error: ${sdkError.message || "Payment SDK could not be initialized."}` };
   }

  if (totalAmount <= 0) {
      console.error(`Cashfree Error: Invalid order amount: ${totalAmount}`);
      return { success: false, error: 'Invalid order amount.' };
  }
   if (!customerDetails || !customerDetails.customerId || !customerDetails.customerEmail || !customerDetails.customerPhone) {
      console.error('Cashfree Error: Invalid customer details provided.', customerDetails);
      return { success: false, error: 'Missing required customer details (ID, Email, Phone).' };
   }

  const orderId = `GEPTO-${uuidv4()}`; // Generate a unique order ID

  // Construct return URL, ensuring HTTPS as required by Cashfree
  let appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:9002';

  // --- HTTPS Enforcement for return URL ---
  // Force HTTPS for production or if explicitly set, allow HTTP ONLY for localhost
  const isLocalhost = appUrl.startsWith('http://localhost');
  const needsHttps = process.env.NODE_ENV === 'production' || appUrl.startsWith('https://') || (!isLocalhost && !appUrl.startsWith('http://'));

  if (needsHttps && !appUrl.startsWith('https://')) {
      if (appUrl.startsWith('http://') && !isLocalhost) {
          console.warn(`Cashfree Warning: App URL (${appUrl}) uses http. Forcing https for Cashfree return_url as it's not localhost.`);
          appUrl = appUrl.replace('http://', 'https://');
      } else if (!isLocalhost) {
          console.warn(`Cashfree Warning: App URL (${appUrl}) does not specify protocol. Assuming https for Cashfree return_url.`);
          appUrl = `https://${appUrl}`;
      }
  } else if (isLocalhost) {
      console.log(`Cashfree Info: Using HTTP return URL for localhost development: ${appUrl}`);
  }
   // --- End HTTPS Enforcement ---


  const returnUrl = `${appUrl}/order/status?order_id=${orderId}`; // URL to redirect after payment
  console.log(`Cashfree Info: Using return URL: ${returnUrl}`);


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
      console.error('Cashfree FATAL Error: The constructed `request` object is unexpectedly null or undefined before calling orders.create.');
      return { success: false, error: 'Internal server error: Failed to construct payment request data.' };
  }

  // **Diagnosis Step 2: Log the exact request object being sent**
  console.log('Cashfree Info: Preparing to call cashfree.orders.create with request object:', JSON.stringify(request, null, 2));


  // **Diagnosis Step 3: Re-check the SDK instance JUST before the API call**
   if (!paymentInstance || typeof paymentInstance.orders !== 'object' || paymentInstance.orders === null) {
        // This error should ideally be caught during getCashfreeInstance, but double-check
        console.error('Cashfree FATAL Error: Cashfree SDK instance is invalid or missing the `orders` property *before* API call. This should not happen if getCashfreeInstance worked.');
        return { success: false, error: 'Payment SDK configuration error: SDK properties missing unexpectedly. Please check server logs.' };
   }
   // Check if the create method exists, again double-checking
    if (typeof paymentInstance.orders.create !== 'function') {
        console.error('Cashfree FATAL Error: Method `cashfree.orders.create` not found *before* API call. SDK might be corrupted or incorrectly initialized.');
        return { success: false, error: 'Payment SDK configuration error: CreateOrder method is not available unexpectedly. Please check server logs.' };
    }

  console.log('Cashfree Info: Method `cashfree.orders.create` found. Proceeding with API call (v5+ style).');


  try {
    // *** Use the instance method 'orders.create' (v5+ SDK style) ***
    // Important: Ensure `request` is passed correctly
    const response = await paymentInstance.orders.create(request);

    console.log('Cashfree Info: Order creation response received.');
    // Avoid logging the full response in production, maybe just keys or status
    console.log('Cashfree Debug: API Response keys:', response ? Object.keys(response) : 'null/undefined');


    if (response.data && response.data.payment_session_id) {
      console.log(`Cashfree Info: Successfully created payment session: ${response.data.payment_session_id} for order: ${orderId}`);
      return {
        success: true,
        payment_session_id: response.data.payment_session_id,
        order_id: orderId, // Return the generated order_id
      };
    } else {
      // Handle cases where response.data exists but payment_session_id is missing
      const errorMessage = response?.data?.message || 'Failed to create payment session (no session ID received).';
      console.error('Cashfree Error: Failed to create payment session after API call.', response?.data || 'No data in response');
       // Log the structure of the error response data if available
      if (response?.data) {
          console.error('Cashfree Error: Structure of response.data on failure:', response.data);
      }
      return { success: false, error: errorMessage, order_id: orderId }; // Include order_id even on failure if available
    }
  } catch (error: any) {
    console.error('Cashfree Error: Exception during cashfree.orders.create call:', error);

    let errorMessage = 'An unexpected error occurred during payment initiation.';
    let statusCode: number | undefined;

     // Check if the error itself has a 'response' property (Axios-like error structure)
     if (error.response) {
        statusCode = error.response.status;
        const responseData = error.response.data; // This might contain { message, code, type } from Cashfree
        console.error('Cashfree Error: Detailed API Error Response Data:', responseData || error.response); // Log the actual error data

        if (responseData && typeof responseData === 'object') {
            if (responseData.message) {
                 errorMessage = responseData.message;
                 if (responseData.code) {
                    errorMessage += ` (Code: ${responseData.code})`;
                     // *** Specific check for Authentication Failed ***
                     if (responseData.code === 'authentication_failed' || responseData.code === 'request_failed') {
                         console.error("Cashfree Authentication Error: The provided API keys (App ID/Secret Key) are likely incorrect or invalid for the current environment (Sandbox/Production). Please verify your .env.local or server environment variables.");
                         errorMessage = `Authentication failed with Cashfree. Please check API credentials and environment settings. (Code: ${responseData.code})`;
                     }
                 }
            } else {
                // Fallback if structure is unexpected
                 errorMessage = `Cashfree API Error: Status ${statusCode}. Response data: ${JSON.stringify(responseData)}`;
            }
        } else {
            errorMessage = `Cashfree API Error: Status ${statusCode}. No structured data received.`;
        }
     } else if (error instanceof Error) { // Handle standard JavaScript Error objects
        errorMessage = error.message;
        console.error('Cashfree Error: Non-API Error details:', error); // Log the full error object

        // Check for specific messages that might indicate SDK issues
         if (errorMessage.includes('cashfree.orders.create is not a function')) {
             errorMessage = 'Payment SDK configuration error: CreateOrder method missing (check SDK version/init).'
         } else if (errorMessage.includes('Required parameter CreateOrderRequest was null or undefined')) {
             // Should be caught earlier now, but keep as a fallback
             console.error('Cashfree Diagnosis: SDK threw "CreateOrderRequest was null or undefined" error *before* API call. This indicates an internal issue with request construction or SDK state.');
             errorMessage = 'Internal server error: Invalid payment request data constructed.';
         } else if (errorMessage.includes('Payment SDK initialization failed')) {
             // Catching the specific error from getCashfreeInstance
              console.error('Cashfree Diagnosis: SDK initialization failed, possibly due to configuration issues (check App ID, Secret Key, Environment in .env files or server config) or internal SDK problems.');
              errorMessage = 'Payment SDK initialization failed. Check server configuration.';
         } else if (errorMessage.includes('missing orders property')) {
             // Catching the specific error from the check before API call
              console.error('Cashfree Diagnosis: SDK instance is missing the `orders` property. Initialization might have failed silently or SDK version issue.');
              errorMessage = 'Payment SDK initialization error: SDK structure incorrect.';
         } else if (errorMessage.includes('Payment SDK internal structure error')) {
             // Catching the specific error from getCashfreeInstance validation
              console.error('Cashfree Diagnosis: SDK instance structure was invalid immediately after creation.');
              errorMessage = 'Payment SDK failed to initialize properly. Check server logs for details.';
         }

     } else {
         // Handle cases where the caught object is not a standard error
         console.error('Cashfree Error: Unknown error structure caught:', error);
         errorMessage = `An unknown error occurred: ${JSON.stringify(error)}`;
     }

    return { success: false, error: errorMessage, order_id: orderId }; // Include order_id on failure
  }
}
