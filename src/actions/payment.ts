
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
  useGeptoCoins: boolean; // Flag to indicate if Gepto Coins should be used
  geptoCoinBalance: number; // Current Gepto Coin balance
}

// Define the expected response structure
interface InitiatePaymentResponse {
  success: boolean;
  payment_session_id?: string;
  order_id?: string;
  error?: string;
  redirectUrl?: string; // In case direct redirect is needed
  message?: string; // Optional message (e.g., for Gepto Coin usage)
}

// Function to configure and initialize Cashfree SDK (v5.x style)
// It now RETURNS the initialized instance.
function initializeCashfreeSDK() {
  console.log('Cashfree Info: Initializing SDK instance (v5.x style)...');
  const appId = process.env.CASHFREE_APP_ID;
  const secretKey = process.env.CASHFREE_SECRET_KEY;

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

  try {
    // **Initialize using the constructor (v5.x style with positional arguments)**
    const cashfree = new Cashfree(cashfreeEnv, appId, secretKey);
    console.log(`Cashfree Info: SDK instance initialized in ${cashfreeEnv === Cashfree.Environment.PRODUCTION ? 'PRODUCTION' : 'SANDBOX'} mode.`);

    // **Immediate Check**: Add a quick check after initialization
    if (!cashfree || typeof cashfree.orders?.create !== 'function') {
        console.error("Cashfree FATAL Error: SDK instance invalid IMMEDIATELY after initialization (missing 'orders.create').", cashfree);
        // Throw an error that will be caught below and propagated
        throw new Error('Payment SDK failed internal consistency check after initialization.');
    } else {
        console.log("Cashfree Info: SDK instance passed initial validation (has orders.create).");
    }

    return cashfree; // Return the instance
  } catch (initError: any) {
      console.error('Cashfree FATAL Error: Failed to initialize Cashfree SDK instance or failed initial check.', initError);
      // Ensure the error message is informative
      throw new Error(`Payment SDK initialization error: ${initError.message}`);
  }
}


export async function initiatePayment(
  input: InitiatePaymentInput
): Promise<InitiatePaymentResponse> {
  const { items, totalAmount, customerDetails, useGeptoCoins, geptoCoinBalance } = input;
  let effectiveTotalAmount = totalAmount;
  let coinsUsed = 0;

  // 1. Handle Gepto Coin Logic
  if (useGeptoCoins && geptoCoinBalance > 0) {
    const amountToCoverWithCoins = Math.min(totalAmount, geptoCoinBalance);
    effectiveTotalAmount = totalAmount - amountToCoverWithCoins;
    coinsUsed = amountToCoverWithCoins;
    console.log(`Gepto Coins Applied: ${coinsUsed}. New amount: ${effectiveTotalAmount}`);

    // If coins cover the entire amount
    if (effectiveTotalAmount <= 0) {
      console.log("Order fully paid with Gepto Coins. Skipping payment gateway.");
      // Simulate a successful order creation without calling Cashfree
      const orderId = `GEPTO-COINS-${uuidv4()}`; // Unique ID for coin-only orders
      // TODO: Deduct coins from user's wallet in your database here!
      return {
        success: true,
        order_id: orderId,
        message: `Order placed successfully using ${coinsUsed} Gepto Coins.`,
      };
    }
  }

  // 2. Proceed with Cashfree Payment if remaining amount > 0
  let cashfree: Cashfree; // Variable to hold the SDK instance
  try {
    // **Initialize SDK instance FIRST**
    cashfree = initializeCashfreeSDK();
  } catch (configError: any) {
     console.error("Cashfree Error: Failed to initialize SDK during initiatePayment.", configError);
     // Return a specific error message indicating initialization failure
     return { success: false, error: `Payment SDK initialization error: ${configError.message || "Check server logs."}` };
  }

  // **Redundant Check (Defense in depth)**: Check if the initialized instance looks valid
  if (!cashfree || typeof cashfree !== 'object' || typeof cashfree.orders !== 'object' || typeof cashfree.orders.create !== 'function') {
      console.error("Cashfree FATAL Error: SDK instance appears invalid or incomplete before creating order (missing 'orders.create' method).", cashfree);
      return { success: false, error: 'Payment SDK initialization error: Payment SDK failed to initialize properly (missing orders property).' };
  } else {
      console.log("Cashfree Info: SDK instance validated again before calling orders.create.");
  }


  if (effectiveTotalAmount <= 0) {
      console.error(`Cashfree Error: Invalid order amount after coin deduction: ${effectiveTotalAmount}`);
      // This case should technically be handled above, but added as safety
      return { success: false, error: 'Invalid order amount after applying discounts.' };
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
   const needsHttps = process.env.NODE_ENV === 'production' || appUrl.startsWith('https://') || (!isLocalhost && !appUrl.startsWith('http://')); // Needs HTTPS if production, already https, or not localhost and not explicitly http

   if (needsHttps && !appUrl.startsWith('https://')) {
       if (appUrl.startsWith('http://') && !isLocalhost) {
           console.warn(`Cashfree Warning: App URL (${appUrl}) uses http. Forcing https for Cashfree return_url as it's not localhost.`);
           appUrl = appUrl.replace('http://', 'https://');
       } else if (!appUrl.startsWith('http://') && !appUrl.startsWith('https://') && !isLocalhost) {
           // If no protocol and not localhost, assume https
           console.warn(`Cashfree Warning: App URL (${appUrl}) does not specify protocol. Assuming https for Cashfree return_url.`);
           appUrl = `https://${appUrl}`;
       }
       // Cashfree requires HTTPS for return_url even for sandbox localhost now.
       else if (isLocalhost && appUrl.startsWith('http://')) {
            console.warn(`Cashfree Warning: Forcing https for localhost return URL (${appUrl}) as required by Cashfree.`);
            appUrl = appUrl.replace('http://', 'https://');
       }
   }


  // Re-check after potential modification
  if (!appUrl.startsWith('https://')) {
       console.error(`Cashfree Error: Final return URL (${appUrl}) must be HTTPS.`);
       return { success: false, error: 'Invalid return URL configuration: Must use HTTPS.' };
  }
   // --- End HTTPS Enforcement ---


  const returnUrl = `${appUrl}/order/status?order_id=${orderId}`; // URL to redirect after payment
  console.log(`Cashfree Info: Using return URL: ${returnUrl}`);


  // **Construct the request object matching Cashfree PGCreateOrder requirements (v5 SDK)**
  const request = {
    order_amount: effectiveTotalAmount, // Use the amount after coin deduction
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
    order_note: `Order from Gepto Express. ${coinsUsed > 0 ? `Paid ${coinsUsed.toFixed(2)} with Gepto Coins.` : ''}`.trim(),
     // Optional: Add expiry time (e.g., 15 minutes)
    order_expiry_time: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
  };

  // **Critical Check**: Ensure the request object is correctly formed and not null/undefined.
  if (!request || typeof request !== 'object' || !request.order_id || !request.customer_details || !request.order_meta || !request.order_meta.return_url) {
      console.error('Cashfree FATAL Error: The constructed `request` object is invalid or missing required fields before calling orders.create.', request);
      // Provide a more specific error message
      return { success: false, error: 'Internal server error: Failed to construct valid payment request data. Check server logs.' };
  }

  // **Detailed Log**: Log the exact request object being sent to Cashfree for debugging.
  console.log('Cashfree Info: Preparing to call cashfree.orders.create (v5.x style) with request object:', JSON.stringify(request, null, 2));


  try {
    // *** Use the instance 'orders.create' method (v5.x SDK style) ***
    const response = await cashfree.orders.create(request);

    console.log('Cashfree Info: Order creation response received.');
    console.log('Cashfree Debug: API Response keys:', response ? Object.keys(response) : 'null/undefined');
    console.log('Cashfree Debug: API Response data (session ID, order ID):', response ? { payment_session_id: response.payment_session_id, order_id: response.order_id } : 'null/undefined');


    if (response && response.payment_session_id) {
      console.log(`Cashfree Info: Successfully created payment session: ${response.payment_session_id} for order: ${orderId}`);
       // TODO: If coins were used, deduct them from the user's wallet in your database NOW, before returning success.
      if (coinsUsed > 0) {
         console.log(`TODO: Deduct ${coinsUsed} Gepto Coins from user ${customerDetails.customerId}'s balance.`);
         // Add your database update logic here
       }
      return {
        success: true,
        payment_session_id: response.payment_session_id,
        order_id: orderId, // Return the generated order_id
        message: coinsUsed > 0 ? `Applied ${coinsUsed.toFixed(2)} Gepto Coins.` : undefined,
      };
    } else {
      const errorMessage = (response as any)?.message || 'Failed to create payment session (no session ID received).';
      console.error('Cashfree Error: Failed to create payment session after API call.', response || 'No response object');
      if (response) {
          console.error('Cashfree Error: Structure of response on failure:', response);
      }
      return { success: false, error: errorMessage, order_id: orderId };
    }
  } catch (error: any) {
    console.error('Cashfree Error: Exception during cashfree.orders.create call:', error);

    let errorMessage = 'An unexpected error occurred during payment initiation.';
    let statusCode: number | undefined;

     if (error.response && error.response.data) {
        statusCode = error.response.status;
        const responseData = error.response.data;
        console.error('Cashfree Error: Detailed API Error Response Data:', responseData);

        if (responseData && typeof responseData === 'object') {
            if (responseData.message) {
                 errorMessage = responseData.message;
                 if (responseData.code) {
                    errorMessage += ` (Code: ${responseData.code})`;
                     if (['authentication_failed', 'request_failed', 'authorization_failed'].includes(responseData.code) || responseData.type === 'authentication_error') {
                         console.error("Cashfree Authentication Error: Verify API keys (App ID/Secret Key) and environment (Sandbox/Production).");
                         errorMessage = `Authentication failed with Cashfree. Check credentials/environment. (Code: ${responseData.code})`;
                     } else if (responseData.type === 'invalid_request_error' && responseData.message?.includes('return_url')) {
                          console.error("Cashfree Invalid Request Error: Check return_url format (must be HTTPS).");
                          errorMessage = `Invalid return URL format: ${responseData.message} (Code: ${responseData.code})`;
                     } else if (responseData.code === 'order_meta.return_url_invalid') {
                          console.error("Cashfree Invalid Request Error: The return_url is invalid (must be HTTPS).");
                          errorMessage = `Invalid return URL: ${responseData.message} (Code: ${responseData.code})`;
                     }
                 }
            } else {
                 errorMessage = `Cashfree API Error: Status ${statusCode}. Response: ${JSON.stringify(responseData)}`;
            }
        } else {
            errorMessage = `Cashfree API Error: Status ${statusCode}. No structured data.`;
        }
     } else if (error instanceof Error) {
        errorMessage = error.message;
        console.error('Cashfree Error: Non-API Error details:', error);

        if (errorMessage.includes('cashfree.orders.create is not a function')) {
             errorMessage = 'Payment SDK configuration error: orders.create method missing (check SDK initialization/version).'
         } else if (errorMessage.includes('Required parameter CreateOrderRequest was null or undefined')) {
             console.error('Cashfree Diagnosis: SDK threw "CreateOrderRequest was null or undefined". Issue with `request` object construction or SDK state.');
             errorMessage = 'Internal server error: Invalid payment request data constructed.';
         } else if (errorMessage.includes('Payment SDK initialization error') || errorMessage.includes('Payment gateway configuration error')) {
              console.error('Cashfree Diagnosis: SDK initialization/configuration failed. Check environment variables (CASHFREE_APP_ID, CASHFREE_SECRET_KEY) and instance creation.');
              errorMessage = 'Payment SDK configuration failed. Check server configuration.';
         }
     } else {
         console.error('Cashfree Error: Unknown error structure caught:', error);
         errorMessage = `An unknown error occurred: ${JSON.stringify(error)}`;
     }

    return { success: false, error: errorMessage, order_id: orderId };
  }
}

