
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
  // ** Use CF_APP_ID and CF_SECRET_KEY from .env.local **
  const appId = process.env.CF_APP_ID;
  const secretKey = process.env.CF_SECRET_KEY;

  if (!appId) {
    console.error('Cashfree FATAL Error: CF_APP_ID environment variable is MISSING.');
    throw new Error('Payment gateway configuration error: App ID missing.');
  }
  if (!secretKey) {
    console.error('Cashfree FATAL Error: CF_SECRET_KEY environment variable is MISSING.');
    throw new Error('Payment gateway configuration error: Secret Key missing.');
  }
  console.log(`Cashfree Info: Using App ID (from env): ${appId}`); // Log the actual App ID being used
  // Do not log the secret key

  // Determine environment based on NODE_ENV or keys (force SANDBOX for TEST keys)
  // ** Explicitly use SANDBOX if using TEST keys, regardless of NODE_ENV **
  const isTestKey = appId.startsWith('TEST');
  const cashfreeEnv = isTestKey ? Cashfree.Environment.SANDBOX : Cashfree.Environment.PRODUCTION;

  console.log(`Cashfree Info: Determined environment: ${cashfreeEnv} (App ID starts with ${isTestKey ? 'TEST' : 'Prod'})`);


  try {
    // **Initialize using the constructor (v5.x style with positional arguments)**
    const cashfree = new Cashfree(cashfreeEnv, appId, secretKey);
    console.log(`Cashfree Info: SDK instance initialized in ${cashfreeEnv} mode.`);

    // **Immediate Check**: Add a quick check after initialization
    if (!cashfree || typeof cashfree.orders?.create !== 'function') {
        console.error("Cashfree FATAL Error: SDK instance invalid IMMEDIATELY after initialization (missing 'orders.create'). Instance:", cashfree);
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
    console.log(`Gepto Coins Applied: ${coinsUsed}. New amount: ${effectiveTotalAmount.toFixed(2)}`);

    if (effectiveTotalAmount <= 0.009) {
      console.log("Order fully paid with Gepto Coins. Skipping payment gateway.");
      const orderId = `GEPTO-COINS-${uuidv4()}`;
      console.log(`TODO: Deduct ${coinsUsed} Gepto Coins from user ${customerDetails.customerId}'s balance.`);
      return {
        success: true,
        order_id: orderId,
        message: `Order placed successfully using ${coinsUsed} Gepto Coins.`,
      };
    }
    effectiveTotalAmount = Math.max(0, effectiveTotalAmount);
  }

  // 2. Proceed with Cashfree Payment if remaining amount > 0
  let cashfree: Cashfree;
  try {
    cashfree = initializeCashfreeSDK();
  } catch (configError: any) {
     console.error("Cashfree Error: Failed to initialize SDK during initiatePayment.", configError);
     return { success: false, error: `Payment SDK initialization error: ${configError.message || "Check server logs."}` };
  }

  // **Redundant Check (Defense in depth)**
  if (!cashfree || typeof cashfree !== 'object' || typeof cashfree.orders !== 'object' || typeof cashfree.orders.create !== 'function') {
      console.error("Cashfree FATAL Error: SDK instance appears invalid before creating order (missing 'orders.create'). Instance:", cashfree ? Object.keys(cashfree) : 'null', cashfree?.orders ? Object.keys(cashfree.orders) : 'no orders prop');
      return { success: false, error: 'Payment SDK initialization error: SDK failed to initialize properly (missing crucial methods). Check server logs.' };
  } else {
      console.log("Cashfree Info: SDK instance validated again before calling orders.create.");
  }

  if (effectiveTotalAmount <= 0.009) {
      console.error(`Cashfree Error: Invalid order amount after coin deduction: ${effectiveTotalAmount}`);
      return { success: false, error: 'Invalid order amount after applying discounts.' };
  }
   if (!customerDetails || !customerDetails.customerId || !customerDetails.customerEmail || !customerDetails.customerPhone) {
      console.error('Cashfree Error: Invalid customer details provided.', customerDetails);
      return { success: false, error: 'Missing required customer details (ID, Email, Phone).' };
   }

  const orderId = `GEPTO-${uuidv4()}`;

  // Construct return URL using NEXT_PUBLIC_APP_URL
  let appUrl = process.env.NEXT_PUBLIC_APP_URL;
   if (!appUrl) {
      console.warn('Cashfree Warning: NEXT_PUBLIC_APP_URL not set, defaulting to http://localhost:9002');
      appUrl = 'http://localhost:9002';
  }


  // --- HTTPS Handling for return URL ---
  // Cashfree generally requires HTTPS for non-localhost URLs in production.
  // For sandbox/test keys, HTTP localhost might work, but HTTPS is safer.
  const isLocalhost = appUrl.includes('localhost') || appUrl.includes('127.0.0.1');
  const isProductionEnv = process.env.NODE_ENV === 'production';
  let finalReturnUrl: string;

  if (isProductionEnv && !isLocalhost && !appUrl.startsWith('https://')) {
      console.warn(`Cashfree Warning: Production environment detected but NEXT_PUBLIC_APP_URL (${appUrl}) is not HTTPS. Attempting to force HTTPS for return_url.`);
      finalReturnUrl = appUrl.replace('http://', 'https://');
       if (!finalReturnUrl.startsWith('https://')) { // If it didn't start with http://
          finalReturnUrl = `https://${appUrl}`;
       }
      console.log(`Cashfree Info: Forced HTTPS return URL: ${finalReturnUrl}`);
  } else {
      finalReturnUrl = appUrl; // Use as is for localhost or if already HTTPS
  }

  // Append the order status path and query parameter
  const returnUrlPath = `/order/status?order_id=${orderId}`;
  const fullReturnUrl = `${finalReturnUrl}${returnUrlPath}`;


  // Final check on the return URL format
  if (!isLocalhost && !fullReturnUrl.startsWith('https://') && isProductionEnv) {
      console.error(`Cashfree FATAL Error: Cannot proceed. Final return URL (${fullReturnUrl}) MUST BE HTTPS for non-localhost addresses in production environment.`);
      return { success: false, error: 'Invalid return URL configuration: Production environment requires HTTPS for non-localhost return URLs.' };
  } else {
      console.log(`Cashfree Info: Using final return URL: ${fullReturnUrl}`);
  }
  // --- End HTTPS Handling ---


  const finalOrderAmount = parseFloat(effectiveTotalAmount.toFixed(2));

  const request = {
    order_amount: finalOrderAmount,
    order_currency: 'INR',
    order_id: orderId,
    customer_details: {
      customer_id: customerDetails.customerId,
      customer_email: customerDetails.customerEmail,
      customer_phone: customerDetails.customerPhone,
      customer_name: customerDetails.customerName || customerDetails.customerEmail.split('@')[0],
    },
    order_meta: {
      return_url: fullReturnUrl, // Use the validated full URL
      // notify_url: `${appUrl}/api/webhooks/cashfree`, // Optional webhook URL
    },
    order_note: `Order from Gepto Express. ${coinsUsed > 0 ? `Paid ${coinsUsed.toFixed(2)} with Gepto Coins.` : ''}`.trim(),
    order_expiry_time: new Date(Date.now() + 15 * 60 * 1000).toISOString(), // 15 min expiry
  };


  if (!request || typeof request !== 'object' || !request.order_id || !request.customer_details || !request.order_meta || !request.order_meta.return_url || typeof request.order_amount !== 'number' || isNaN(request.order_amount) || request.order_amount <= 0) {
      console.error('Cashfree FATAL Error: The constructed `request` object is invalid or missing required fields before calling orders.create.', request);
      return { success: false, error: `Internal server error: Failed to construct valid payment request data. Check server logs. Amount: ${request?.order_amount}, Type: ${typeof request?.order_amount}` };
  }

  console.log('Cashfree Info: Preparing to call cashfree.orders.create (v5.x style) with request object:', JSON.stringify(request, null, 2));


  try {
    // *** Use the instance 'orders.create' method (v5.x SDK style) ***
    const response = await cashfree.orders.create(request);

    console.log('Cashfree Info: Order creation response received.');
    console.log('Cashfree Debug: API Response keys:', response ? Object.keys(response) : 'null/undefined');
    console.log('Cashfree Debug: API Response data (session ID, order ID):', response ? { payment_session_id: response.payment_session_id, order_id: response.order_id } : 'null/undefined');


    if (response && response.payment_session_id) {
      console.log(`Cashfree Info: Successfully created payment session: ${response.payment_session_id} for order: ${orderId}`);
      if (coinsUsed > 0) {
         console.log(`TODO: Deduct ${coinsUsed} Gepto Coins from user ${customerDetails.customerId}'s balance.`);
         // await deductGeptoCoins(customerDetails.customerId, coinsUsed);
       }
      return {
        success: true,
        payment_session_id: response.payment_session_id,
        order_id: orderId,
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
                         console.error("Cashfree Authentication Error: Verify API keys (App ID/Secret Key) and environment (Sandbox/Production). Ensure NODE_ENV matches keys and keys match environment.");
                         errorMessage = `Authentication failed with Cashfree. Check credentials/environment. (Code: ${responseData.code})`;
                     } else if (responseData.type === 'invalid_request_error' && (responseData.message?.includes('return_url') || responseData.code === 'order_meta.return_url_invalid')) {
                          console.error("Cashfree Invalid Request Error: Check return_url format (must be HTTPS for production/non-local). Current URL:", fullReturnUrl);
                          errorMessage = `Invalid return URL format: ${responseData.message}. Ensure it is HTTPS for production. (Code: ${responseData.code})`;
                     } else if (responseData.code === 'idempotency_error') {
                          console.warn(`Cashfree Warning: Idempotency error for order ${orderId}. Order might already exist.`);
                          errorMessage = `Order with ID ${orderId} might already exist. Please check status or try again later. (Code: ${responseData.code})`;
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
        console.error('Cashfree Error: Non-API Error details:', error.name, error.message, error.stack);

        if (errorMessage.includes('cashfree.orders.create is not a function')) {
             console.error('Cashfree Diagnosis: SDK object malformed or init failed. Check `initializeCashfreeSDK`.');
             errorMessage = 'Payment SDK configuration error: orders.create method missing (check SDK init/version).'
         } else if (errorMessage.includes('Required parameter CreateOrderRequest was null or undefined')) {
             console.error('Cashfree Diagnosis: SDK threw "CreateOrderRequest was null or undefined". Issue with `request` object or SDK state. Request:', JSON.stringify(request, null, 2));
             errorMessage = 'Internal server error: Invalid payment request data constructed.';
         } else if (errorMessage.includes('Payment SDK initialization error') || errorMessage.includes('Payment gateway configuration error')) {
              console.error('Cashfree Diagnosis: SDK init/config failed. Check env vars (CF_APP_ID, CF_SECRET_KEY) and `initializeCashfreeSDK`.');
              errorMessage = 'Payment SDK configuration failed. Check server configuration.';
         }
     } else {
         console.error('Cashfree Error: Unknown error structure caught:', error);
         try {
            errorMessage = `An unknown error occurred: ${JSON.stringify(error)}`;
         } catch (stringifyError) {
            errorMessage = 'An unknown and unstringifyable error occurred during payment initiation.';
         }
     }

    return { success: false, error: errorMessage, order_id: orderId };
  }
}
