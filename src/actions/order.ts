
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

// Function to configure and initialize Cashfree SDK (v5.x style)
// It now RETURNS the initialized instance.
function initializeCashfreeSDKForStatus() {
  console.log('Cashfree Order Status Info: Initializing SDK instance (v5.x style) for status check...');
  // ** Use CF_APP_ID and CF_SECRET_KEY from .env.local **
  const appId = process.env.CF_APP_ID;
  const secretKey = process.env.CF_SECRET_KEY;

  if (!appId) {
     console.error('Cashfree Order Status FATAL Error: CF_APP_ID environment variable is MISSING.');
     throw new Error('Payment gateway configuration error for status check: App ID missing.');
   }
    if (!secretKey) {
     console.error('Cashfree Order Status FATAL Error: CF_SECRET_KEY environment variable is MISSING.');
     throw new Error('Payment gateway configuration error for status check: Secret Key missing.');
   }
   console.log(`Cashfree Order Status Info: Using App ID starting with: ${appId.substring(0, 6)}...`);
  // Do not log the secret key

  // Determine environment
   // ** Ensure NODE_ENV is set to 'production' in your deployment environment **
  const isProduction = process.env.NODE_ENV === 'production';
  const cashfreeEnv = isProduction
                        ? Cashfree.Environment.PRODUCTION
                        : Cashfree.Environment.SANDBOX;
  console.log(`Cashfree Order Status Info: Determined environment: ${isProduction ? 'PRODUCTION' : 'SANDBOX'} (NODE_ENV=${process.env.NODE_ENV})`);


  try {
    // **Initialize using the constructor (v5.x style with positional arguments)**
    const cashfree = new Cashfree(cashfreeEnv, appId, secretKey);
    console.log(`Cashfree Order Status Info: SDK instance initialized in ${cashfreeEnv} mode for status check.`);

    // **Immediate Check**: Add a quick check after initialization
    // Check for the specific method needed (orders.fetch)
    if (!cashfree || typeof cashfree.orders?.fetch !== 'function') {
      console.error("Cashfree Order Status FATAL Error: SDK instance invalid IMMEDIATELY after initialization (missing 'orders.fetch').", cashfree);
      throw new Error('Payment SDK failed internal consistency check after initialization for status check.');
    } else {
        console.log("Cashfree Order Status Info: SDK instance passed initial validation (has orders.fetch).");
    }

    return cashfree; // Return the instance
   } catch (initError: any) {
      console.error('Cashfree Order Status FATAL Error: Failed to initialize Cashfree SDK instance for status check or failed initial check.', initError);
      throw new Error(`Payment SDK initialization error for status check: ${initError.message}`);
  }
}


export async function getOrderStatus(orderId: string): Promise<OrderStatusResponse> {

  if (!orderId) {
    return { success: false, error: 'Order ID is required.' };
  }

  // Check if it's a Gepto Coin order
  if (orderId.startsWith('GEPTO-COINS-')) {
    console.log(`Order ${orderId} identified as a Gepto Coin order.`);
    // Assume coin orders are always successful once created
    // TODO: You might want to add a check in your database to confirm coin deduction
    return {
      success: true,
      order_status: 'PAID', // Treat as paid
      transaction_status: 'SUCCESS',
      payment_amount: 0, // No cash involved
      isCoinOrder: true,
    };
  }


   let cashfree: Cashfree; // Variable to hold the SDK instance
   try {
     // **Initialize SDK instance FIRST**
     cashfree = initializeCashfreeSDKForStatus();
   } catch (sdkError: any) {
      // Catch initialization errors specifically
     console.error("Cashfree Order Status Error: Failed to initialize SDK during getOrderStatus.", sdkError);
      // Provide a clearer error message
     return { success: false, error: `Payment SDK initialization error for status check: ${sdkError.message || "Check server logs."}` };
   }

   // **Redundant Check (Defense in depth)**: Check if the initialized instance looks valid
   // Check for the specific method needed (orders.fetch)
   if (!cashfree || typeof cashfree !== 'object' || typeof cashfree.orders !== 'object' || typeof cashfree.orders.fetch !== 'function') {
        console.error("Cashfree Order Status FATAL Error: SDK instance appears invalid or incomplete before fetch call (missing 'orders.fetch' method).", cashfree);
        return { success: false, error: 'Payment SDK configuration error for status check: Payment SDK failed to initialize properly (missing orders property).' };
    } else {
        console.log("Cashfree Order Status Info: SDK instance validated again before calling orders.fetch.");
    }


  try {
    console.log(`Cashfree Get Order Request (v5.x style) for order_id: ${orderId}`);

    // *** Use the instance 'orders.fetch' method (v5.x SDK style) ***
    const response = await cashfree.orders.fetch(orderId);
    // Log essential info, avoid full response in production unless debugging
    console.log('Cashfree Get Order Response keys (v5.x) (if available):', response ? Object.keys(response) : 'null/undefined');
    console.log('Cashfree Get Order Response Data (v5.x) (if available):', response ? { order_id: response.order_id, cf_order_id: response.cf_order_id, order_status: response.order_status } : 'No data');


    if (response) {
       // Check if order_status exists, otherwise report potentially incomplete data
        if (typeof response.order_status !== 'string') {
             console.warn(`Order status missing or not a string for order ${orderId}. Response data:`, response);
             // If essential IDs exist, it might just be pending confirmation
             if (response.order_id && response.cf_order_id) {
                // Treat as PENDING as a safe default if status is missing but order exists
                return { success: true, order_status: 'PENDING', error: 'Order status not yet available from gateway.' };
             } else {
                 console.error(`Incomplete order data for ${orderId} - missing order_status and potentially other key fields.`);
                return { success: false, error: 'Incomplete order data received from payment gateway.' };
             }
        }

      return {
        success: true,
        order_status: response.order_status.toUpperCase() as OrderStatusResponse['order_status'],
        // Include transaction_status if available and useful
        transaction_status: response.transaction_status, // Often useful too
        payment_amount: response.order_amount,
        isCoinOrder: false, // It's a Cashfree order
      };
    } else {
      console.error(`Cashfree returned null or undefined response for order ${orderId}`);
      return { success: false, error: 'No data received from payment gateway when fetching order status.' };
    }
  } catch (error: any) {
    console.error(`Cashfree Error: Exception during cashfree.orders.fetch call for order ${orderId}:`, error);

     let errorMessage = 'An unexpected error occurred while fetching order status.';
     let statusCode: number | undefined;

     // Check Cashfree specific error structure
     if (error.response && error.response.data) {
        statusCode = error.response.status;
        const responseData = error.response.data;
        console.error('Cashfree Order Status Error: Detailed API Error Response Data:', responseData);

        if (responseData && typeof responseData === 'object') {
            if (responseData.message) {
                 errorMessage = responseData.message;
                 if (responseData.code) {
                     errorMessage += ` (Code: ${responseData.code})`;
                     if (['authentication_failed', 'request_failed', 'authorization_failed'].includes(responseData.code) || responseData.type === 'authentication_error') {
                          console.error("Cashfree Order Status Authentication Error: Verify API keys/environment.");
                          errorMessage = `Authentication failed with Cashfree during status check. Check API credentials/environment. (Code: ${responseData.code})`;
                      } else if (statusCode === 404 || responseData.type === 'not_found_error' || responseData.code === 'order_id_not_found') {
                           console.warn(`Cashfree Order Status: Order ${orderId} not found.`);
                           errorMessage = 'Order not found.';
                      }
                 }
            } else {
                 errorMessage = `Cashfree API Error during status check: Status ${statusCode}. Response: ${JSON.stringify(responseData)}`;
            }
        } else {
             errorMessage = `Cashfree API Error during status check: Status ${statusCode}. No structured data.`;
        }
     } else if (error instanceof Error) {
         // Handle general JavaScript errors
        errorMessage = error.message;
        console.error('Cashfree Order Status Error: Non-API Error details:', error.name, error.message, error.stack);

         if (errorMessage.includes('cashfree.orders.fetch is not a function')) {
              console.error('Cashfree Diagnosis: SDK object seems malformed or initialization failed. Check `initializeCashfreeSDKForStatus` function.');
             errorMessage = 'Payment SDK configuration error: orders.fetch method missing (check SDK initialization/version).'
         } else if (errorMessage.includes('Payment SDK initialization error') || errorMessage.includes('Payment gateway configuration error')) {
              console.error('Cashfree Order Status Diagnosis: SDK initialization/configuration failed. Check env vars (CF_APP_ID, CF_SECRET_KEY) or instance creation.');
              errorMessage = 'Payment SDK configuration failed for status check. Check server configuration.';
         }
     } else {
         // Handle unexpected error types
         console.error('Cashfree Order Status Error: Unknown error structure caught:', error);
         try {
             errorMessage = `An unknown error occurred during status check: ${JSON.stringify(error)}`;
         } catch (stringifyError) {
             errorMessage = 'An unknown and unstringifyable error occurred during order status check.';
         }
     }

    return { success: false, error: errorMessage, isCoinOrder: false };
  }
}


