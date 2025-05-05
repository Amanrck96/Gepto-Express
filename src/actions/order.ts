
'use server';

import { Cashfree } from 'cashfree-pg';

interface OrderStatusResponse {
  success: boolean;
  order_status?: string; // e.g., "PAID", "ACTIVE", "EXPIRED", "FAILED", "PENDING"
  transaction_status?: string; // e.g., "SUCCESS", "PENDING", "FAILED"
  payment_amount?: number;
  error?: string;
}

// Function to configure and initialize Cashfree SDK (v5.x style)
// It now RETURNS the initialized instance.
function initializeCashfreeSDKForStatus() {
  console.log('Cashfree Order Status Info: Initializing SDK instance (v5.x style) for status check...');
  const appId = process.env.CASHFREE_APP_ID;
  const secretKey = process.env.CASHFREE_SECRET_KEY;

  if (!appId) {
     console.error('Cashfree Order Status FATAL Error: CASHFREE_APP_ID environment variable is MISSING.');
     throw new Error('Payment gateway configuration error for status check: App ID missing.');
   }
    if (!secretKey) {
     console.error('Cashfree Order Status FATAL Error: CASHFREE_SECRET_KEY environment variable is MISSING.');
     throw new Error('Payment gateway configuration error for status check: Secret Key missing.');
   }
   console.log(`Cashfree Order Status Info: Using App ID starting with: ${appId.substring(0, 6)}...`);
  // Do not log the secret key

  // Determine environment
  const cashfreeEnv = process.env.NODE_ENV === 'production'
                        ? Cashfree.Environment.PRODUCTION
                        : Cashfree.Environment.SANDBOX;

  try {
    // **Initialize using the constructor (v5.x style)**
    const cashfree = new Cashfree(cashfreeEnv, appId, secretKey);
    console.log(`Cashfree Order Status Info: SDK instance initialized in ${cashfreeEnv === Cashfree.Environment.PRODUCTION ? 'PRODUCTION' : 'SANDBOX'} mode for status check.`);
    // No need to set XApiVersion for v5 constructor initialization
    return cashfree; // Return the instance
   } catch (initError: any) {
      console.error('Cashfree Order Status FATAL Error: Failed to initialize Cashfree SDK instance for status check.', initError);
      throw new Error(`Payment SDK initialization error for status check: ${initError.message}`);
  }
}


export async function getOrderStatus(orderId: string): Promise<OrderStatusResponse> {

  if (!orderId) {
    return { success: false, error: 'Order ID is required.' };
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

  // **Check if the initialized instance looks valid (basic check for 'orders' property)**
   if (!cashfree || typeof cashfree !== 'object' || typeof cashfree.orders !== 'object' || typeof cashfree.orders.fetch !== 'function') {
        console.error("Cashfree Order Status FATAL Error: SDK instance appears invalid or incomplete after initialization (missing 'orders.fetch' method).", cashfree);
        return { success: false, error: 'Payment SDK configuration error for status check: Payment SDK failed to initialize properly (missing orders property).' };
    } else {
        console.log("Cashfree Order Status Info: SDK instance validated (contains orders.fetch method). Proceeding with API call (v5.x style).");
    }


  try {
    console.log(`Cashfree Get Order Request (v5.x style) for order_id: ${orderId}`);

    // *** Use the instance 'orders.fetch' method (v5.x SDK style) ***
    // The API version is typically handled internally by the v5 SDK instance.
    const response = await cashfree.orders.fetch(orderId);
    // Avoid logging full response in production unless debugging
    console.log('Cashfree Get Order Response keys (v5.x) (if available):', response ? Object.keys(response) : 'null/undefined');
    // Log specific fields safely
    console.log('Cashfree Get Order Response Data (v5.x) (if available):', response ? { order_id: response.order_id, cf_order_id: response.cf_order_id, order_status: response.order_status } : 'No data');


    if (response) {
       // Check if order_status exists, otherwise report potentially incomplete data
       // v5 returns the full order object, so check directly on response
        if (typeof response.order_status !== 'string') { // Check type as well
             console.warn(`Order status missing or not a string for order ${orderId}. Response data:`, response);
             if (response.order_id && response.cf_order_id) {
                // If we have IDs but no status, likely still processing or an edge case
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
        transaction_status: response.transaction_status, // Often useful too
        payment_amount: response.order_amount,
      };
    } else {
      console.error(`Cashfree returned null or undefined response for order ${orderId}`);
      return { success: false, error: 'No data received from payment gateway when fetching order status.' };
    }
  } catch (error: any) {
    console.error(`Cashfree Error: Exception during cashfree.orders.fetch call for order ${orderId}:`, error);

     let errorMessage = 'An unexpected error occurred while fetching order status.';
     let statusCode: number | undefined;

     // Check if the error object itself might contain response-like data
     if (error.response && error.response.data) {
        statusCode = error.response.status;
        const responseData = error.response.data; // Might contain { message, code, type }
        console.error('Cashfree Order Status Error: Detailed API Error Response Data:', responseData);

        if (responseData && typeof responseData === 'object') {
            if (responseData.message) {
                 errorMessage = responseData.message;
                 if (responseData.code) {
                     errorMessage += ` (Code: ${responseData.code})`;
                     // *** Specific check for Authentication Failed ***
                     if (['authentication_failed', 'request_failed', 'authorization_failed'].includes(responseData.code) || responseData.type === 'authentication_error') {
                          console.error("Cashfree Order Status Authentication Error: The provided API keys (App ID/Secret Key) are likely incorrect or invalid for the current environment (Sandbox/Production). Please verify your .env.local or server environment variables.");
                          errorMessage = `Authentication failed with Cashfree during status check. Check API credentials/environment. (Code: ${responseData.code})`;
                      } else if (statusCode === 404 || responseData.type === 'not_found_error' || responseData.code === 'order_id_not_found') {
                           console.warn(`Cashfree Order Status: Order ${orderId} not found.`);
                           errorMessage = 'Order not found.';
                      }
                 }
            } else {
                 errorMessage = `Cashfree API Error during status check: Status ${statusCode}. Response data: ${JSON.stringify(responseData)}`;
            }
        } else {
             errorMessage = `Cashfree API Error during status check: Status ${statusCode}. No structured data received.`;
        }
     } else if (error instanceof Error) { // Handle standard JavaScript Error objects
        errorMessage = error.message;
        console.error('Cashfree Order Status Error: Non-API Error details:', error);

        // Check for specific messages that might indicate SDK issues
         if (errorMessage.includes('cashfree.orders.fetch is not a function')) {
             errorMessage = 'Payment SDK configuration error: orders.fetch method missing (check SDK initialization/version).'
         } else if (errorMessage.includes('Payment SDK initialization error') || errorMessage.includes('Payment gateway configuration error')) {
              // Catching the specific error from initializeCashfreeSDKForStatus or similar checks
              console.error('Cashfree Order Status Diagnosis: SDK initialization/configuration failed, possibly due to missing environment variables (CASHFREE_APP_ID, CASHFREE_SECRET_KEY) or instance creation failure.');
              errorMessage = 'Payment SDK configuration failed for status check. Check server configuration.';
         }
     } else {
         console.error('Cashfree Order Status Error: Unknown error structure caught:', error);
         errorMessage = `An unknown error occurred during status check: ${JSON.stringify(error)}`;
     }

    return { success: false, error: errorMessage };
  }
}
