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
  paymentMode: 'online' | 'cod'; // Add paymentMode
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

// Environment Variable Check at Module Level (Fail Fast)
const CF_APP_ID = process.env.CF_APP_ID;
const CF_SECRET_KEY = process.env.CF_SECRET_KEY;
const NEXT_PUBLIC_APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:9002'; // Default if not set

if (!CF_APP_ID && process.env.NODE_ENV === 'production') {
  console.error('FATAL CONFIGURATION ERROR: CF_APP_ID environment variable is MISSING.');
  throw new Error('Server configuration error: Payment Gateway App ID is not configured.');
}
if (!CF_SECRET_KEY && process.env.NODE_ENV === 'production') {
  console.error('FATAL CONFIGURATION ERROR: CF_SECRET_KEY environment variable is MISSING.');
  throw new Error('Server configuration error: Payment Gateway Secret Key is not configured.');
}
console.log(`Payment Action: Using CF_APP_ID starting with: ${CF_APP_ID ? CF_APP_ID.substring(0, 4) : 'N/A'}...`); // Log prefix only
console.log(`Payment Action: Using NEXT_PUBLIC_APP_URL: ${NEXT_PUBLIC_APP_URL}`);


// Determine Cashfree environment based on App ID prefix
const isProductionKey = CF_APP_ID && !CF_APP_ID.startsWith('TEST');
const cashfreeEnv = isProductionKey ? Cashfree.Environment.PRODUCTION : Cashfree.Environment.SANDBOX;
console.log(`Payment Action: Determined Cashfree Environment: ${cashfreeEnv} (Production Key: ${isProductionKey})`);

// Singleton instance of Cashfree SDK
let cashfreeInstance: Cashfree | null = null;

function getCashfreeInstance(): Cashfree {
  if (cashfreeInstance) {
    // Quick check on existing instance validity (basic)
    if (typeof cashfreeInstance.orders?.create === 'function') {
      // console.log('Payment Action: Reusing existing valid Cashfree SDK instance.');
      return cashfreeInstance;
    } else {
      console.warn('Payment Action: Existing Cashfree SDK instance seems invalid. Re-initializing...');
      cashfreeInstance = null; // Force re-initialization
    }
  }

  console.log(`Payment Action: Initializing new Cashfree SDK instance for environment: ${cashfreeEnv}...`);
  try {
    // Initialize using the constructor (v5.x style)
    const instance = new Cashfree(cashfreeEnv, CF_APP_ID!, CF_SECRET_KEY!); // We already checked they exist
    console.log(`Payment Action: SDK instance created in ${cashfreeEnv} mode.`);

    // **Crucial Check**: Verify the necessary methods exist IMMEDIATELY
    if (!instance || typeof instance !== 'object' || typeof instance.orders?.create !== 'function') {
      console.error("Payment Action FATAL Error: SDK instance invalid IMMEDIATELY after creation. Missing 'orders.create'. Instance keys:", instance ? Object.keys(instance) : 'null', 'Orders keys:', instance?.orders ? Object.keys(instance.orders): 'N/A');
      throw new Error('Payment SDK failed internal consistency check after initialization (missing orders.create method).');
    } else {
      console.log("Payment Action: SDK instance passed initial validation (has orders.create).");
    }

    cashfreeInstance = instance;
    return cashfreeInstance;
  } catch (initError: any) {
    console.error('Payment Action FATAL Error: Failed to initialize Cashfree SDK instance.', initError);
    // Add more details if available
    if (initError.message?.includes('Authentication')) {
         console.error('Payment Action Diagnosis: Authentication likely failed during init. Check CF_APP_ID and CF_SECRET_KEY against the environment (' + cashfreeEnv + ').');
    }
    throw new Error(`Payment SDK initialization error: ${initError.message}`);
  }
}


export async function initiatePayment(
  input: InitiatePaymentInput
): Promise<InitiatePaymentResponse> {
  const { items, totalAmount, customerDetails, useGeptoCoins, geptoCoinBalance, paymentMode } = input;
  let effectiveTotalAmount = totalAmount;
  let coinsUsed = 0;

  // 1. Validate Input Data
  if (!items || items.length === 0) {
    return { success: false, error: 'Cannot initiate payment for an empty cart.' };
  }
  if (typeof totalAmount !== 'number' || totalAmount < 0) {
     return { success: false, error: `Invalid total amount: ${totalAmount}.` };
  }
  if (!customerDetails || !customerDetails.customerId || !customerDetails.customerEmail || !customerDetails.customerPhone) {
    console.error('Payment Action Error: Invalid customer details provided.', customerDetails);
    return { success: false, error: 'Missing required customer details (ID, Email, Phone).' };
  }
   if (!customerDetails.customerEmail.includes('@')) { // Basic email format check
       return { success: false, error: 'Invalid customer email format.' };
   }
   if (!/^\d{10,}$/.test(customerDetails.customerPhone)) { // Basic phone format check (at least 10 digits)
      return { success: false, error: 'Invalid customer phone number format.' };
   }


  // 2. Handle Gepto Coin Logic
  if (useGeptoCoins && geptoCoinBalance > 0) {
    const amountToCoverWithCoins = Math.min(totalAmount, geptoCoinBalance);
    // Ensure effectiveTotalAmount doesn't become negative due to floating point issues
    effectiveTotalAmount = Math.max(0, totalAmount - amountToCoverWithCoins);
    coinsUsed = amountToCoverWithCoins;
    console.log(`Payment Action: Gepto Coins Applied: ${coinsUsed.toFixed(0)}. Original Amount: ${totalAmount.toFixed(2)}, New Amount: ${effectiveTotalAmount.toFixed(2)}`);

    // Check if the order is fully covered by coins (using a small tolerance for floating point)
    if (effectiveTotalAmount < 0.01 && paymentMode !== 'cod') {
      console.log("Payment Action: Order fully paid with Gepto Coins. Skipping payment gateway.");
      const orderId = `GEPTO-COINS-${uuidv4()}`;
      // --- TODO: Implement Actual Coin Deduction Logic ---
      // This is CRITICAL. This action should ideally happen *after* confirming order success,
      // possibly via a webhook or status check, to avoid deducting coins for failed orders.
      // For now, we log it.
      console.log(`---> TODO: Deduct ${coinsUsed.toFixed(0)} Gepto Coins from user ${customerDetails.customerId}'s balance for order ${orderId} <---`);
      // Placeholder: Assume deduction is successful for now to proceed
      // await deductGeptoCoins(customerDetails.customerId, coinsUsed);
      // --- End TODO ---
      return {
        success: true,
        order_id: orderId, // Return the GEPTO-COINS order ID
        message: `Order placed successfully using ${coinsUsed.toFixed(0)} Gepto Coins.`,
      };
    }
  }

   // Ensure final amount is valid for payment gateway
   const finalOrderAmount = parseFloat(effectiveTotalAmount.toFixed(2));
   if (finalOrderAmount <= 0 && paymentMode !== 'cod') {
     console.error(`Payment Action Error: Invalid final order amount after deductions: ${finalOrderAmount}`);
     return { success: false, error: 'Order amount must be positive after applying discounts.' };
   }

   if (paymentMode === 'cod') {
        const orderId = `GEPTO-COD-${uuidv4()}`;
        console.log(`Payment Action: Order placed with Cash on Delivery. Order ID: ${orderId}`);
        return {
            success: true,
            order_id: orderId,
            message: 'Order placed successfully with Cash on Delivery.',
        };
    }


  // 3. Initialize Cashfree SDK
  let cashfree: Cashfree;
  try {
    cashfree = getCashfreeInstance();
  } catch (sdkError: any) {
    console.error("Payment Action Error: Failed to get/initialize SDK instance during initiatePayment.", sdkError);
    return { success: false, error: `Payment SDK initialization failed: ${sdkError.message}` };
  }

  // --- Redundant Check (Defense in depth) --- Should have been caught by getCashfreeInstance
  if (!cashfree || typeof cashfree.orders?.create !== 'function') {
      console.error("Payment Action FATAL Error: SDK instance invalid before creating order (consistency check).", cashfree ? Object.keys(cashfree) : 'null');
      return { success: false, error: 'Internal Server Error: Payment SDK is not configured correctly (failed redundant check).' };
  }
  // console.log("Payment Action: SDK instance validated again before calling orders.create.");


  // 4. Construct Cashfree Order Request
  const orderId = `GEPTO-${uuidv4()}`; // Unique Order ID for Cashfree

  // --- Construct and Validate Return URL ---
  const appUrl = NEXT_PUBLIC_APP_URL; // Use constant defined at top
  const isLocalhost = appUrl.includes('localhost') || appUrl.includes('127.0.0.1');
  let finalReturnUrl: string;

  if (isProductionKey && !isLocalhost && !appUrl.startsWith('https://')) {
      console.warn(`Payment Action Warning: Production keys detected but NEXT_PUBLIC_APP_URL (${appUrl}) is not HTTPS. Attempting to force HTTPS for return_url.`);
      // Basic forcing, might need adjustment based on actual URL structure
      finalReturnUrl = appUrl.replace(/^http:/, 'https');
      if (!finalReturnUrl.startsWith('https://')) { // If it didn't start with http://
          finalReturnUrl = `https://${appUrl.split('//').pop()}`; // Try removing scheme and adding https
      }
      console.log(`Payment Action: Forced HTTPS return URL base: ${finalReturnUrl}`);
  } else {
      finalReturnUrl = appUrl; // Use as is for localhost, test keys, or if already HTTPS
  }

  // Append the order status path and query parameter
  const returnUrlPath = `/order/status?order_id=${orderId}`;
  const fullReturnUrl = `${finalReturnUrl.replace(/\/$/, '')}${returnUrlPath}`; // Ensure no double slash

  // Final CRITICAL check for Production HTTPS
  if (isProductionKey && !isLocalhost && !fullReturnUrl.startsWith('https://')) {
      console.error(`Payment Action FATAL Error: Cannot proceed. Final return URL (${fullReturnUrl}) MUST BE HTTPS for non-localhost addresses when using production keys.`);
      return { success: false, error: 'Invalid application URL configuration: Production payments require HTTPS return URLs.' };
  } else {
      console.log(`Payment Action: Using final return URL: ${fullReturnUrl}`);
  }
  // --- End Return URL Handling ---


  const request = {
    order_amount: finalOrderAmount,
    order_currency: 'INR',
    order_id: orderId,
    customer_details: {
      customer_id: customerDetails.customerId,
      customer_email: customerDetails.customerEmail,
      customer_phone: customerDetails.customerPhone,
      // Provide a default name if not available, avoiding undefined
      customer_name: customerDetails.customerName || customerDetails.customerEmail.split('@')[0] || `User_${customerDetails.customerId}`,
    },
    order_meta: {
      return_url: fullReturnUrl, // Use the validated HTTPS URL for production
      // Optional: Add webhook URL for server-to-server notifications
      // notify_url: `${finalReturnUrl.split('/order/status')[0]}/api/webhooks/cashfree`,
    },
    order_note: `Order from Gepto Express. ${coinsUsed > 0 ? `${coinsUsed.toFixed(0)} coins applied.` : ''}`.trim(),
    order_expiry_time: new Date(Date.now() + 15 * 60 * 1000).toISOString(), // 15 min expiry from now
  };

  // **Crucial**: Validate the request object *before* sending to Cashfree
  if (!request || typeof request.order_amount !== 'number' || request.order_amount <= 0 || !request.order_id || !request.customer_details || !request.order_meta?.return_url || !request.customer_details.customer_id || !request.customer_details.customer_email || !request.customer_details.customer_phone) {
      console.error('Payment Action FATAL Error: The constructed `request` object is invalid or missing required fields before calling orders.create.', JSON.stringify(request, null, 2));
      // Mask sensitive details before logging potentially
      const safeLogRequest = { ...request, customer_details: { ...request.customer_details, customer_phone: '********' + request.customer_details.customer_phone.slice(-4) } };
      console.error('Invalid Request Object (sanitized):', JSON.stringify(safeLogRequest, null, 2));
      return { success: false, error: 'Internal server error: Failed to construct valid payment request data. Please contact support.' };
  }


  console.log(`Payment Action: Preparing to call cashfree.orders.create for order ${orderId} with amount ${finalOrderAmount} for online payment...`);
  // console.log('Payment Action DEBUG: Full request object:', JSON.stringify(request, null, 2)); // Sensitive, use with caution

  // 5. Call Cashfree API to Create Order
  try {
    // *** Use the instance 'orders.create' method (v5.x SDK style) ***
    const response = await cashfree.orders.create(request);

    console.log(`Payment Action Info: Cashfree order creation API call successful for order ${orderId}.`);
    // console.log('Payment Action Debug: API Response keys:', response ? Object.keys(response) : 'null/undefined');
    // console.log('Payment Action Debug: API Response data (session ID, order ID):', response ? { payment_session_id: response.payment_session_id, order_id: response.order_id } : 'null/undefined');

    if (response && response.payment_session_id) {
      console.log(`Payment Action Success: Created payment session ${response.payment_session_id} for order ${orderId}`);
      // --- TODO: Implement Actual Coin Deduction Logic (as mentioned above) ---
      if (coinsUsed > 0) {
         console.log(`---> TODO: Deduct ${coinsUsed.toFixed(0)} Gepto Coins from user ${customerDetails.customerId}'s balance for order ${orderId} <---`);
         // await deductGeptoCoins(customerDetails.customerId, coinsUsed); // Add actual deduction logic here, potentially after payment confirmation
      }
      // --- End TODO ---
      return {
        success: true,
        payment_session_id: response.payment_session_id,
        order_id: orderId, // Return the GEPTO- order ID
        message: coinsUsed > 0 ? `Applied ${coinsUsed.toFixed(0)} Gepto Coins.` : undefined,
      };
    } else {
      // This case might indicate an API issue where success was reported but no session ID came back.
      const errorMessage = (response as any)?.message || 'Cashfree API returned success but missing payment_session_id.';
      console.error(`Payment Action Error: Failed to create payment session for order ${orderId}. API response lacking session ID.`, response || 'No response object');
      return { success: false, error: errorMessage, order_id: orderId };
    }
  } catch (error: any) {
    console.error(`Payment Action Error: Exception during cashfree.orders.create call for order ${orderId}:`, error);

    let userFriendlyError = 'Payment initiation failed. Please try again or contact support.';
    let loggedError = 'An unexpected error occurred during payment initiation.';
    let statusCode: number | undefined;

     // --- Detailed Error Parsing ---
     if (error.response && error.response.data) { // Axios-like error structure
        statusCode = error.response.status;
        const responseData = error.response.data;
        console.error('Payment Action Error: Detailed API Error Response Data:', responseData);

        loggedError = `Cashfree API Error: Status ${statusCode}. Code: ${responseData.code}. Message: ${responseData.message}. Type: ${responseData.type}.`;

        if (responseData.message) {
            userFriendlyError = responseData.message; // Use Cashfree's message if available
             if (responseData.code) {
                 userFriendlyError += ` (Code: ${responseData.code})`;
                 if (['authentication_failed', 'request_failed', 'authorization_failed'].includes(responseData.code) || responseData.type === 'authentication_error') {
                     console.error("Payment Action Authentication Error: Verify API keys (CF_APP_ID/CF_SECRET_KEY) and environment ("+ cashfreeEnv +").");
                     userFriendlyError = `Authentication failed with payment gateway. Please contact support.`; // Don't expose code directly
                 } else if (responseData.type === 'invalid_request_error') {
                      if (responseData.message?.includes('return_url')) {
                         console.error("Payment Action Invalid Request Error: Check return_url format (must be HTTPS for production). URL:", fullReturnUrl);
                         userFriendlyError = `Invalid configuration for return URL. Please contact support.`;
                      } else if (responseData.message?.includes('customer_details.customer_phone')) {
                           userFriendlyError = 'Invalid customer phone number provided.';
                      } else if (responseData.message?.includes('order_amount')) {
                             userFriendlyError = 'Invalid order amount specified.';
                      } else {
                           userFriendlyError = `Invalid request sent to payment gateway. (Code: ${responseData.code})`;
                      }
                 } else if (responseData.code === 'idempotency_error') {
                      console.warn(`Payment Action Warning: Idempotency error for order ${orderId}. Order might already exist or network issue.`);
                      userFriendlyError = `Order ${orderId} might be processing or already exists. Please check status or try again in a few moments.`;
                 }
             } else {
                 userFriendlyError = `Payment gateway error: Status ${statusCode}. Please try again.`;
             }
        } else {
             loggedError = `Cashfree API Error: Status ${statusCode}. No structured data.`;
             userFriendlyError = `Payment gateway returned an error (Status ${statusCode}). Please try again.`;
        }
     } else if (error instanceof Error) { // General JavaScript errors
        loggedError = `Non-API Error: ${error.name}: ${error.message}`;
        console.error('Payment Action Error: Non-API Error details:', error.name, error.message, error.stack);

        if (error.message.includes('orders.create is not a function')) {
             console.error('Payment Action Diagnosis: SDK object malformed/init failed. Check `getCashfreeInstance`. Ensure `cashfree-pg` version >= 5.');
             userFriendlyError = 'Payment SDK configuration error. Please contact support. (Err: Method Missing)';
             loggedError += ' - SDK object missing orders.create.';
         } else if (error.message.includes('Payment SDK initialization error') || error.message.includes('Payment gateway configuration error')) {
              console.error('Payment Action Diagnosis: SDK init/config failed. Check env vars (CF_APP_ID, CF_SECRET_KEY) and `getCashfreeInstance`.');
              userFriendlyError = 'Payment SDK configuration failed. Please contact support. (Err: Init Failed)';
              loggedError += ' - SDK initialization or config issue.';
         } else if (error.message.includes('internal consistency check')) {
             console.error('Payment Action Diagnosis: SDK internal consistency check failed. Check env vars and SDK instantiation in `getCashfreeInstance`.');
             userFriendlyError = 'Payment SDK configuration error. Please contact support. (Err: Consistency Check Failed)';
              loggedError += ' - SDK internal consistency check failed.';
         } else {
             userFriendlyError = 'An unexpected technical issue occurred. Please try again later.';
         }
         // Only add the generic message if a more specific one wasn't set
         if (userFriendlyError === 'Payment initiation failed. Please try again or contact support.') {
             userFriendlyError = `An error occurred: ${error.message}`;
         }

     } else { // Unknown error structure
         console.error('Payment Action Error: Unknown error structure caught:', error);
         try {
            loggedError = `Unknown error during payment initiation: ${JSON.stringify(error)}`;
         } catch (stringifyError) {
            loggedError = 'An unknown and unstringifyable error occurred during payment initiation.';
         }
         userFriendlyError = 'An unexpected error occurred during payment initiation. Please contact support.';
     }

    // Log the detailed error internally, return the user-friendly one
    console.error("Logged Error:", loggedError);
    return { success: false, error: userFriendlyError, order_id: orderId };
  }
}
