
'use server';

import { Cashfree } from 'cashfree-pg';

interface OrderStatusResponse {
  success: boolean;
  order_status?: string; // e.g., "PAID", "ACTIVE", "EXPIRED", "FAILED", "PENDING"
  transaction_status?: string; // e.g., "SUCCESS", "PENDING", "FAILED"
  payment_amount?: number;
  error?: string;
  isCoinOrder?: boolean; // Flag to indicate if it was a Gepto Coin order
}

// Environment Variable Check at Module Level (Fail Fast) - Consistent with payment.ts
const CF_APP_ID = process.env.CF_APP_ID;
const CF_SECRET_KEY = process.env.CF_SECRET_KEY;

if (!CF_APP_ID) {
  console.error('FATAL CONFIGURATION ERROR (Order Status): CF_APP_ID environment variable is MISSING.');
  throw new Error('Server configuration error: Payment Gateway App ID is not configured.');
}
if (!CF_SECRET_KEY) {
  console.error('FATAL CONFIGURATION ERROR (Order Status): CF_SECRET_KEY environment variable is MISSING.');
  throw new Error('Server configuration error: Payment Gateway Secret Key is not configured.');
}
console.log(`Order Status Action: Using CF_APP_ID starting with: ${CF_APP_ID.substring(0, 4)}...`); // Log prefix only


// Determine Cashfree environment based on App ID prefix - Consistent with payment.ts
const isProductionKey = !CF_APP_ID.startsWith('TEST');
const cashfreeEnv = isProductionKey ? Cashfree.Environment.PRODUCTION : Cashfree.Environment.SANDBOX;
console.log(`Order Status Action: Determined Cashfree Environment: ${cashfreeEnv} (Production Key: ${isProductionKey})`);


// Singleton instance of Cashfree SDK for status checks
let cashfreeStatusInstance: Cashfree | null = null;

function getCashfreeStatusInstance(): Cashfree {
  if (cashfreeStatusInstance) {
    // Quick check on existing instance validity (basic)
    if (typeof cashfreeStatusInstance.orders?.fetch === 'function') {
      // console.log('Order Status Action: Reusing existing valid Cashfree SDK instance.');
      return cashfreeStatusInstance;
    } else {
      console.warn('Order Status Action: Existing Cashfree SDK instance seems invalid. Re-initializing...');
      cashfreeStatusInstance = null; // Force re-initialization
    }
  }

  console.log(`Order Status Action: Initializing new Cashfree SDK instance for environment: ${cashfreeEnv}...`);
  try {
    // Initialize using the constructor (v5.x style)
    const instance = new Cashfree(cashfreeEnv, CF_APP_ID!, CF_SECRET_KEY!); // We already checked they exist
    console.log(`Order Status Action: SDK instance created in ${cashfreeEnv} mode.`);

    // **Crucial Check**: Verify the necessary methods exist IMMEDIATELY
    if (!instance || typeof instance !== 'object' || typeof instance.orders?.fetch !== 'function') {
      console.error("Order Status Action FATAL Error: SDK instance invalid IMMEDIATELY after creation. Missing 'orders.fetch'. Instance keys:", instance ? Object.keys(instance) : 'null', 'Orders keys:', instance?.orders ? Object.keys(instance.orders): 'N/A');
      throw new Error('Payment SDK failed internal consistency check after initialization (missing orders.fetch method).');
    } else {
      console.log("Order Status Action: SDK instance passed initial validation (has orders.fetch).");
    }

    cashfreeStatusInstance = instance;
    return cashfreeStatusInstance;
  } catch (initError: any) {
    console.error('Order Status Action FATAL Error: Failed to initialize Cashfree SDK instance.', initError);
     if (initError.message?.includes('Authentication')) {
         console.error('Order Status Action Diagnosis: Authentication likely failed during init. Check CF_APP_ID and CF_SECRET_KEY against the environment (' + cashfreeEnv + ').');
    }
    throw new Error(`Payment SDK initialization error for status check: ${initError.message}`);
  }
}


export async function getOrderStatus(orderId: string): Promise<OrderStatusResponse> {

  if (!orderId || typeof orderId !== 'string' || orderId.trim() === '') {
    return { success: false, error: 'Invalid Order ID provided.' };
  }

  // 1. Handle Gepto Coin Orders (Internal Check)
  if (orderId.startsWith('GEPTO-COINS-')) {
    console.log(`Order Status Action: Order ${orderId} identified as a Gepto Coin order.`);
    // --- TODO: Add Database Check ---
    // This is essential to confirm the coin transaction associated with this order ID
    // actually completed successfully in your system.
    // If the DB shows the coin deduction failed or is pending, return appropriate status.
    // For now, assume success if it's a GEPTO-COINS ID.
    // Example: const coinTxStatus = await getCoinTransactionStatus(orderId);
    // if (coinTxStatus === 'SUCCESS') { ... } else { return { ... status: 'FAILED' ...}}
    console.log(`---> TODO: Verify internal status of Gepto Coin order ${orderId} in database <---`);
    // --- End TODO ---
    return {
      success: true,
      order_status: 'PAID', // Assuming successful coin deduction
      transaction_status: 'SUCCESS',
      payment_amount: 0, // Coins have no monetary value in this context
      isCoinOrder: true,
    };
  }

  // 2. Initialize Cashfree SDK for regular orders
   let cashfree: Cashfree;
   try {
     cashfree = getCashfreeStatusInstance();
   } catch (sdkError: any) {
     console.error("Order Status Action Error: Failed to get/initialize SDK instance during getOrderStatus.", sdkError);
     return { success: false, error: `Payment SDK initialization failed for status check: ${sdkError.message}` };
   }

   // --- Redundant Check (Defense in depth) --- Should have been caught by getCashfreeStatusInstance
   if (!cashfree || typeof cashfree.orders?.fetch !== 'function') {
        console.error("Order Status Action FATAL Error: SDK instance invalid before fetch call (consistency check).", cashfree ? Object.keys(cashfree) : 'null');
        return { success: false, error: 'Internal Server Error: Payment SDK is not configured correctly for status check (failed redundant check).' };
    }
   // console.log("Order Status Action: SDK instance validated again before calling orders.fetch.");


  // 3. Call Cashfree API to Fetch Order Status
  try {
    console.log(`Order Status Action: Calling cashfree.orders.fetch for order_id: ${orderId}`);

    // *** Use the instance 'orders.fetch' method (v5.x SDK style) ***
    const response = await cashfree.orders.fetch(orderId);
    console.log(`Order Status Action Info: Cashfree order fetch API call successful for order ${orderId}.`);
    // console.log('Order Status Action Debug: API Response keys:', response ? Object.keys(response) : 'null/undefined');
    // console.log('Order Status Action Debug: API Response data (subset):', response ? { order_id: response.order_id, cf_order_id: response.cf_order_id, order_status: response.order_status, order_amount: response.order_amount } : 'No data');


    if (response && response.order_id) { // Check if we got a valid response object with order_id
        // Validate the structure minimally
        if (typeof response.order_status !== 'string') {
             console.warn(`Order Status Action Warning: order_status missing or not a string for order ${orderId}. Marking as PENDING. Response data:`, response);
             // Return PENDING if status is missing but other details seem okay
             return {
                success: true,
                order_status: 'PENDING',
                payment_amount: response.order_amount,
                error: 'Order status not yet available from gateway.',
                isCoinOrder: false
             };
        }

         // Normalize status to uppercase for consistency
        const status = response.order_status.toUpperCase() as OrderStatusResponse['order_status'];

        // Potentially map Cashfree statuses to your internal statuses if needed
        // e.g., if Cashfree returns 'ACTIVE', maybe you treat it as 'PENDING'

        return {
            success: true,
            order_status: status,
            // Note: Cashfree v5 SDK fetch might not have transaction_status directly.
            // You might need to fetch transactions separately if required.
            // transaction_status: response.transaction_status, // Uncomment if available
            payment_amount: response.order_amount,
            isCoinOrder: false, // It's not a GEPTO-COINS order if we reached here
        };
    } else {
      console.error(`Order Status Action Error: Cashfree returned invalid or empty response for order ${orderId}. Response:`, response);
      return { success: false, error: 'Failed to retrieve valid status data from payment gateway.' };
    }
  } catch (error: any) {
    console.error(`Order Status Action Error: Exception during cashfree.orders.fetch call for order ${orderId}:`, error);

    let userFriendlyError = 'Could not retrieve order status. Please try again or contact support.';
    let loggedError = 'An unexpected error occurred while fetching order status.';
    let statusCode: number | undefined;

    // --- Detailed Error Parsing ---
     if (error.response && error.response.data) { // Axios-like error structure
        statusCode = error.response.status;
        const responseData = error.response.data;
        console.error('Order Status Action Error: Detailed API Error Response Data:', responseData);

        loggedError = `Cashfree API Error (Status Check): Status ${statusCode}. Code: ${responseData.code}. Message: ${responseData.message}. Type: ${responseData.type}.`;

        if (responseData.message) {
            userFriendlyError = responseData.message; // Use Cashfree's message
            if (responseData.code) {
                 userFriendlyError += ` (Code: ${responseData.code})`;
                 if (['authentication_failed', 'request_failed', 'authorization_failed'].includes(responseData.code) || responseData.type === 'authentication_error') {
                      console.error("Order Status Action Authentication Error: Verify API keys/environment.");
                      userFriendlyError = `Authentication failed during status check. Please contact support.`;
                  } else if (statusCode === 404 || responseData.type === 'not_found_error' || responseData.code === 'order_id_not_found') {
                       console.warn(`Order Status Action: Order ${orderId} not found via API.`);
                       userFriendlyError = 'Order not found.';
                  } else {
                       userFriendlyError = `Payment gateway error during status check. (Code: ${responseData.code})`;
                  }
             } else {
                 userFriendlyError = `Payment gateway error: Status ${statusCode}. Please try again.`;
             }
        } else {
             loggedError = `Cashfree API Error (Status Check): Status ${statusCode}. No structured data.`;
             userFriendlyError = `Payment gateway returned an error (Status ${statusCode}) during status check. Please try again.`;
        }
     } else if (error instanceof Error) { // General JavaScript errors
         loggedError = `Non-API Error (Status Check): ${error.name}: ${error.message}`;
         console.error('Order Status Action Error: Non-API Error details:', error.name, error.message, error.stack);

         if (error.message.includes('orders.fetch is not a function')) {
              console.error('Order Status Action Diagnosis: SDK object malformed/init failed. Check `getCashfreeStatusInstance`. Ensure `cashfree-pg` version >= 5.');
              userFriendlyError = 'Payment SDK configuration error (Status Check). Please contact support. (Err: Method Missing)';
              loggedError += ' - SDK object missing orders.fetch.';
         } else if (error.message.includes('Payment SDK initialization error') || error.message.includes('Payment gateway configuration error')) {
              console.error('Order Status Action Diagnosis: SDK init/config failed. Check env vars or instance creation.');
              userFriendlyError = 'Payment SDK configuration failed (Status Check). Please contact support. (Err: Init Failed)';
              loggedError += ' - SDK initialization or config issue.';
         } else if (error.message.includes('internal consistency check')) {
             console.error('Order Status Action Diagnosis: SDK internal consistency check failed. Check env vars/SDK instantiation.');
             userFriendlyError = 'Payment SDK configuration error (Status Check). Please contact support. (Err: Consistency Check Failed)';
             loggedError += ' - SDK internal consistency check failed.';
         } else {
              userFriendlyError = 'An unexpected technical issue occurred retrieving status. Please try again later.';
         }
          // Only add the generic message if a more specific one wasn't set
         if (userFriendlyError === 'Could not retrieve order status. Please try again or contact support.') {
             userFriendlyError = `An error occurred retrieving status: ${error.message}`;
         }
     } else { // Unknown error structure
         console.error('Order Status Action Error: Unknown error structure caught:', error);
         try {
             loggedError = `Unknown error during status check: ${JSON.stringify(error)}`;
         } catch (stringifyError) {
             loggedError = 'An unknown and unstringifyable error occurred during order status check.';
         }
         userFriendlyError = 'An unexpected error occurred retrieving order status. Please contact support.';
     }

    // Log the detailed error internally, return the user-friendly one
    console.error("Logged Error (Status Check):", loggedError);
    return { success: false, error: userFriendlyError, isCoinOrder: false }; // Assume not coin order on error
  }
}

