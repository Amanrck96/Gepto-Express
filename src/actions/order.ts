
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

// Function to configure and initialize Cashfree SDK (v5.x style) for status check
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
   console.log(`Cashfree Order Status Info: Using App ID (from env): ${appId}`); // Log the actual App ID
  // Do not log the secret key

  // Determine environment based on App ID prefix (TEST or production)
   const isTestKey = appId.startsWith('TEST');
   const cashfreeEnv = isTestKey ? Cashfree.Environment.SANDBOX : Cashfree.Environment.PRODUCTION;
   console.log(`Cashfree Order Status Info: Determined environment: ${cashfreeEnv} (App ID starts with ${isTestKey ? 'TEST' : 'Prod'})`);


  try {
    // **Initialize using the constructor (v5.x style with positional arguments)**
    const cashfree = new Cashfree(cashfreeEnv, appId, secretKey);
    console.log(`Cashfree Order Status Info: SDK instance initialized in ${cashfreeEnv} mode for status check.`);

    // **Immediate Check**: Check for the specific method needed (orders.fetch)
    if (!cashfree || typeof cashfree.orders?.fetch !== 'function') {
      console.error("Cashfree Order Status FATAL Error: SDK instance invalid IMMEDIATELY after initialization (missing 'orders' property or 'orders.fetch'). Instance:", cashfree);
      throw new Error('Payment SDK failed internal consistency check after initialization for status check (missing orders property or fetch method).');
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
    // TODO: Add database check to confirm coin deduction
    return {
      success: true,
      order_status: 'PAID',
      transaction_status: 'SUCCESS',
      payment_amount: 0,
      isCoinOrder: true,
    };
  }


   let cashfree: Cashfree;
   try {
     cashfree = initializeCashfreeSDKForStatus();
   } catch (sdkError: any) {
     console.error("Cashfree Order Status Error: Failed to initialize SDK during getOrderStatus.", sdkError);
     return { success: false, error: `Payment SDK initialization error for status check: ${sdkError.message || "Check server logs."}` };
   }

   // **Redundant Check (Defense in depth)** - Ensure orders.fetch is still present
   if (!cashfree || typeof cashfree !== 'object' || typeof cashfree.orders !== 'object' || typeof cashfree.orders.fetch !== 'function') {
        console.error("Cashfree Order Status FATAL Error: SDK instance appears invalid before fetch call (missing 'orders' property or 'orders.fetch'). Instance:", cashfree ? Object.keys(cashfree) : 'null', cashfree?.orders ? Object.keys(cashfree.orders) : 'no orders prop');
        return { success: false, error: 'Payment SDK configuration error for status check: SDK failed to initialize properly (missing orders property or fetch method).' };
    } else {
        console.log("Cashfree Order Status Info: SDK instance validated again before calling orders.fetch.");
    }


  try {
    console.log(`Cashfree Get Order Request (v5.x style) for order_id: ${orderId}`);

    // *** Use the instance 'orders.fetch' method (v5.x SDK style) ***
    const response = await cashfree.orders.fetch(orderId);
    console.log('Cashfree Get Order Response keys (v5.x) (if available):', response ? Object.keys(response) : 'null/undefined');
    console.log('Cashfree Get Order Response Data (v5.x) (if available):', response ? { order_id: response.order_id, cf_order_id: response.cf_order_id, order_status: response.order_status } : 'No data');


    if (response) {
        if (typeof response.order_status !== 'string') {
             console.warn(`Order status missing or not a string for order ${orderId}. Response data:`, response);
             if (response.order_id && response.cf_order_id) {
                return { success: true, order_status: 'PENDING', error: 'Order status not yet available from gateway.' };
             } else {
                 console.error(`Incomplete order data for ${orderId} - missing order_status and potentially other key fields.`);
                return { success: false, error: 'Incomplete order data received from payment gateway.' };
             }
        }

      return {
        success: true,
        order_status: response.order_status.toUpperCase() as OrderStatusResponse['order_status'],
        // Cashfree v5 SDK might not have transaction_status directly on fetch response
        // Adjust based on actual API response if needed.
        // transaction_status: response.transaction_status,
        payment_amount: response.order_amount,
        isCoinOrder: false,
      };
    } else {
      console.error(`Cashfree returned null or undefined response for order ${orderId}`);
      return { success: false, error: 'No data received from payment gateway when fetching order status.' };
    }
  } catch (error: any) {
    console.error(`Cashfree Error: Exception during cashfree.orders.fetch call for order ${orderId}:`, error);

     let errorMessage = 'An unexpected error occurred while fetching order status.';
     let statusCode: number | undefined;

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
              console.error('Cashfree Diagnosis: SDK object malformed or init failed. Check `initializeCashfreeSDKForStatus`. Ensure `cashfree-pg` version >= 5.');
             errorMessage = 'Payment SDK configuration error: orders.fetch method missing (check SDK init/version >= 5).'
         } else if (errorMessage.includes('Payment SDK initialization error') || errorMessage.includes('Payment gateway configuration error')) {
              console.error('Cashfree Order Status Diagnosis: SDK init/config failed. Check env vars or instance creation.');
              errorMessage = 'Payment SDK configuration failed for status check. Check server configuration.';
         } else if (errorMessage.includes('internal consistency check')) {
              console.error('Cashfree Diagnosis: SDK internal consistency check failed during init. Check env vars and SDK instantiation in `initializeCashfreeSDKForStatus`.');
              errorMessage = 'Payment SDK configuration error for status check: Internal consistency check failed during initialization.';
         }
     } else {
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
