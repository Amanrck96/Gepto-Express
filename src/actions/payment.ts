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

// --- Removed getCashfreeInstance - Will use static configuration ---

// Function to configure Cashfree SDK statically (v4.x style)
function configureCashfreeSDK() {
  console.log('Cashfree Info: Configuring SDK statically (v4.x style)...');
  const appId = process.env.CASHFREE_APP_ID;
  const secretKey = process.env.CASHFREE_SECRET_KEY;

  // **Crucial Check**: Ensure environment variables are loaded.
  if (!appId) {
    console.error('Cashfree FATAL Error: CASHFREE_APP_ID environment variable is MISSING.');
    throw new Error('Payment gateway configuration error: App ID missing.');
  }
   if (!secretKey) {
    console.error('Cashfree FATAL Error: CASHFREE_SECRET_KEY environment variable is MISSING.');
    throw new Error('Payment gateway configuration error: Secret Key missing.');
  }
  console.log(`Cashfree Info: Using App ID starting with: ${appId.substring(0, 6)}...`);
  // Do not log the secret key


  // Determine environment based on NODE_ENV or a specific Cashfree env variable
  const cashfreeEnv = process.env.NODE_ENV === 'production'
                        ? Cashfree.Environment.PRODUCTION
                        : Cashfree.Environment.SANDBOX;

  // **Set static properties for v4.x style SDK usage**
  Cashfree.XClientId = appId;
  Cashfree.XClientSecret = secretKey;
  Cashfree.XEnvironment = cashfreeEnv;
  // Specify API version (required for older SDK style used by v4.x)
  Cashfree.XApiVersion = "2023-08-01"; // Use a recent stable version

  console.log(`Cashfree Info: Statically configured SDK in ${cashfreeEnv === Cashfree.Environment.PRODUCTION ? 'PRODUCTION' : 'SANDBOX'} mode.`);
  console.log(`Cashfree Info: Using API Version: ${Cashfree.XApiVersion}`);

  // **Verification**: Check if static properties were set (basic check)
  if (!Cashfree.XClientId || !Cashfree.XClientSecret || !Cashfree.XEnvironment || !Cashfree.XApiVersion) {
       console.error('Cashfree FATAL Error: Failed to set static SDK properties (XClientId, XClientSecret, XEnvironment, XApiVersion).');
       throw new Error('Payment SDK configuration error: Failed to set static properties.');
  } else {
       console.log('Cashfree Info: Static SDK properties successfully set.');
  }
}


export async function initiatePayment(
  input: InitiatePaymentInput
): Promise<InitiatePaymentResponse> {
  const { items, totalAmount, customerDetails } = input;

  // **Configure SDK FIRST before any other logic**
  try {
    configureCashfreeSDK();
  } catch (configError: any) {
     console.error("Cashfree Error: Failed to configure SDK during initiatePayment.", configError);
     // Return a specific error message indicating configuration failure
     return { success: false, error: `Payment SDK configuration error: ${configError.message || "SDK properties missing. Please check server logs."}` };
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
  const isLocalhost = appUrl.startsWith('http://localhost');
  const needsHttps = process.env.NODE_ENV === 'production' || appUrl.startsWith('https://') || (!isLocalhost); // Needs HTTPS if production, already https, or not localhost

  if (needsHttps && !appUrl.startsWith('https://')) {
      if (appUrl.startsWith('http://') && !isLocalhost) {
          console.warn(`Cashfree Warning: App URL (${appUrl}) uses http. Forcing https for Cashfree return_url as it's not localhost.`);
          appUrl = appUrl.replace('http://', 'https://');
      } else if (!appUrl.startsWith('http://') && !appUrl.startsWith('https://') && !isLocalhost) {
           // If no protocol and not localhost, assume https
          console.warn(`Cashfree Warning: App URL (${appUrl}) does not specify protocol. Assuming https for Cashfree return_url.`);
          appUrl = `https://${appUrl}`;
      }
      // If it's localhost, keep http as is (Cashfree sandbox allows http localhost return URLs)
  }

  if (!isLocalhost && !appUrl.startsWith('https://')) {
       console.error(`Cashfree Error: Final return URL (${appUrl}) must be HTTPS for non-localhost environments.`);
       return { success: false, error: 'Invalid return URL configuration: Must use HTTPS for non-localhost.' };
  }
   // --- End HTTPS Enforcement ---


  const returnUrl = `${appUrl}/order/status?order_id=${orderId}`; // URL to redirect after payment
  console.log(`Cashfree Info: Using return URL: ${returnUrl}`);


  // **Construct the request object matching Cashfree PGCreateOrder v4.x requirements**
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
      // notify_url: `${appUrl}/api/webhooks/cashfree`, // Optional: Server-to-server notification URL also needs HTTPS if non-localhost
    },
    order_note: `Order from Gepto Express for ${items.length} items.`,
     // Optional: Add expiry time (e.g., 15 minutes)
    order_expiry_time: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
  };

  // **Critical Check**: Ensure the request object is correctly formed and not null/undefined.
  if (!request || typeof request !== 'object' || !request.order_id || !request.customer_details || !request.order_meta) {
      console.error('Cashfree FATAL Error: The constructed `request` object is invalid or missing required fields before calling PGCreateOrder.', request);
      // Provide a more specific error message
      return { success: false, error: 'Internal server error: Failed to construct valid payment request data. Check server logs.' };
  }

  // **Detailed Log**: Log the exact request object being sent to Cashfree for debugging.
  // Avoid logging sensitive details like full customer info in production logs if possible, but essential for debugging now.
  console.log('Cashfree Info: Preparing to call Cashfree.PGCreateOrder (v4.x style) with request object:', JSON.stringify(request, null, 2));


  // **Check if the static method exists (important sanity check)**
   if (typeof Cashfree.PGCreateOrder !== 'function') {
        console.error('Cashfree FATAL Error: Static method `Cashfree.PGCreateOrder` not found. SDK might be corrupted, incorrectly installed/imported, or configuration failed.');
        return { success: false, error: 'Payment SDK configuration error: CreateOrder method is not available. Please check server logs and SDK setup.' };
    }

  console.log('Cashfree Info: Static method `Cashfree.PGCreateOrder` found. Proceeding with API call (v4.x style).');


  try {
    // *** Use the static 'PGCreateOrder' method (v4.x SDK style) ***
    // The API version is set statically in configureCashfreeSDK
    const response = await Cashfree.PGCreateOrder(request);

    console.log('Cashfree Info: Order creation response received.');
    // Log structure or specific fields rather than full response in production
    console.log('Cashfree Debug: API Response keys:', response ? Object.keys(response) : 'null/undefined');
    console.log('Cashfree Debug: API Response data (session ID, order ID):', response?.data ? { payment_session_id: response.data.payment_session_id, order_id: response.data.order_id } : 'No data');


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
    console.error('Cashfree Error: Exception during Cashfree.PGCreateOrder call:', error);

    let errorMessage = 'An unexpected error occurred during payment initiation.';
    let statusCode: number | undefined;

     // Check if the error itself has a 'response' property (Axios-like error structure from SDK)
     if (error.response && error.response.data) {
        statusCode = error.response.status;
        const responseData = error.response.data; // This might contain { message, code, type } from Cashfree
        console.error('Cashfree Error: Detailed API Error Response Data:', responseData); // Log the actual error data

        if (responseData && typeof responseData === 'object') {
            if (responseData.message) {
                 errorMessage = responseData.message;
                 if (responseData.code) {
                    errorMessage += ` (Code: ${responseData.code})`;
                     // *** Specific check for Authentication Failed ***
                     // Use codes commonly returned by Cashfree for auth issues
                     if (['authentication_failed', 'request_failed', 'authorization_failed'].includes(responseData.code) || responseData.type === 'authentication_error') {
                         console.error("Cashfree Authentication Error: The provided API keys (App ID/Secret Key) are likely incorrect or invalid for the current environment (Sandbox/Production). Please verify your .env.local or server environment variables.");
                         errorMessage = `Authentication failed with Cashfree. Please check API credentials and environment settings. (Code: ${responseData.code})`;
                     } else if (responseData.type === 'invalid_request_error' && responseData.message?.includes('return_url')) {
                          console.error("Cashfree Invalid Request Error: Check the return_url format. Ensure it's HTTPS (unless localhost) and correctly formed.");
                          errorMessage = `Invalid return URL format: ${responseData.message} (Code: ${responseData.code})`;
                     } else if (responseData.code === 'order_meta.return_url_invalid') {
                          console.error("Cashfree Invalid Request Error: The return_url is invalid. Ensure it's HTTPS for non-localhost environments.");
                          errorMessage = `Invalid return URL: ${responseData.message} (Code: ${responseData.code})`;
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
         if (errorMessage.includes('Cashfree.PGCreateOrder is not a function')) {
             errorMessage = 'Payment SDK configuration error: CreateOrder method missing (check SDK version/init).'
         } else if (errorMessage.includes('Required parameter CreateOrderRequest was null or undefined')) {
             // This indicates the 'request' object passed to PGCreateOrder was bad *before* the API call
             console.error('Cashfree Diagnosis: SDK threw "CreateOrderRequest was null or undefined" error. This points to an internal issue with the `request` object construction or SDK state before the API call was made.');
             errorMessage = 'Internal server error: Invalid payment request data constructed.';
         } else if (errorMessage.includes('Payment SDK configuration error')) {
             // Catching the specific error from configureCashfreeSDK or similar checks
              console.error('Cashfree Diagnosis: SDK configuration failed, possibly due to missing environment variables (CASHFREE_APP_ID, CASHFREE_SECRET_KEY) or failure to set static properties.');
              errorMessage = 'Payment SDK configuration failed. Check server environment variables and SDK setup.';
         }

     } else {
         // Handle cases where the caught object is not a standard error
         console.error('Cashfree Error: Unknown error structure caught:', error);
         errorMessage = `An unknown error occurred: ${JSON.stringify(error)}`;
     }

    // Always include the orderId if generated, helps correlation
    return { success: false, error: errorMessage, order_id: orderId };
  }
}
