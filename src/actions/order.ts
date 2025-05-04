
'use server';

import { Cashfree } from 'cashfree-pg';

interface OrderStatusResponse {
  success: boolean;
  order_status?: string; // e.g., "PAID", "ACTIVE", "EXPIRED", "FAILED"
  transaction_status?: string; // e.g., "SUCCESS", "PENDING", "FAILED"
  payment_amount?: number;
  error?: string;
}

// Initialize Cashfree SDK instance globally or within a helper function if preferred
let cashfreeOrderStatusInstance: Cashfree | null = null;

function getCashfreeOrderStatusInstance(): Cashfree {
  if (cashfreeOrderStatusInstance) {
     // Check if the existing instance is still valid (basic check)
      if (typeof cashfreeOrderStatusInstance.orders?.fetch === 'function') {
         console.log('Cashfree Order Status Info: Reusing existing valid SDK instance for status check.');
         return cashfreeOrderStatusInstance;
      } else {
         console.warn('Cashfree Order Status Warning: Existing SDK instance for status check appears invalid. Re-initializing...');
         cashfreeOrderStatusInstance = null; // Force re-initialization
      }
  }

  console.log('Cashfree Order Status Info: Attempting to initialize new SDK instance for status check...');
  const appId = process.env.CASHFREE_APP_ID;
  const secretKey = process.env.CASHFREE_SECRET_KEY;

  if (!appId || !secretKey) {
    console.error('Cashfree Order Status FATAL Error: CASHFREE_APP_ID or CASHFREE_SECRET_KEY environment variables are not set.');
    throw new Error('Payment gateway configuration error for order status check. Server environment variables missing.');
  }

  // Determine environment - Use PRODUCTION or SANDBOX based on your setup
   const cashfreeEnv = process.env.NODE_ENV === 'production'
                        ? Cashfree.Environment.PRODUCTION
                        : Cashfree.Environment.SANDBOX;
   console.log(`Cashfree Order Status Info: Initializing SDK (v5+) in ${cashfreeEnv === Cashfree.Environment.PRODUCTION ? 'PRODUCTION' : 'SANDBOX'} mode for order status check.`);
   console.log(`Cashfree Order Status Info: Using App ID starting with: ${appId.substring(0, 6)}...`); // Log first few chars


   try {
    // --- SDK v5+ Initialization ---
    const instance = new Cashfree(cashfreeEnv, appId, secretKey); // Initialize locally first
    console.log('Cashfree Order Status Info: SDK v5+ instance construction attempted for status check.');

    // *** Add detailed check here ***
    // Verify the structure of the newly created instance BEFORE assigning it globally
     if (!instance || typeof instance.orders !== 'object' || instance.orders === null || typeof instance.orders.fetch !== 'function') {
        console.error('Cashfree Order Status FATAL Error: Newly created SDK instance is invalid or missing `orders.fetch` method immediately after construction for status check. Instance:', instance);
         // Attempt to log keys of the instance if it exists, to help debug structure
         if(instance) {
              console.error('Cashfree Order Status FATAL Error: Keys found on invalid instance:', Object.keys(instance));
         }
        cashfreeOrderStatusInstance = null; // Ensure global remains null
        throw new Error('Payment SDK internal structure error after initialization for status check. Check logs.');
     }


    console.log('Cashfree Order Status Info: SDK v5+ instance created successfully and seems valid for status checks.');
    cashfreeOrderStatusInstance = instance; // Assign to global variable only if valid
    return cashfreeOrderStatusInstance;
   } catch (configError: any) {
     console.error('Cashfree Order Status FATAL Error: Error during Cashfree SDK v5+ initialization or validation for order status:', configError);
     cashfreeOrderStatusInstance = null; // Reset on error
     throw new Error(`Payment SDK initialization error for status check: ${configError.message || 'Failed to configure SDK.'}`);
   }
}


export async function getOrderStatus(orderId: string): Promise<OrderStatusResponse> {
   let paymentInstance: Cashfree;

  if (!orderId) {
    return { success: false, error: 'Order ID is required.' };
  }

   // Ensure SDK instance is ready
   try {
     paymentInstance = getCashfreeOrderStatusInstance();
   } catch (sdkError: any) {
      // Catch initialization errors specifically
     console.error("Cashfree Order Status Error: Failed to get SDK instance during getOrderStatus.", sdkError);
      // Provide a clearer error message
     return { success: false, error: `Payment SDK initialization error for status check: ${sdkError.message || "Payment SDK could not be initialized."}` };
   }


  // **Diagnosis Step 1: Re-check the SDK instance JUST before the API call**
   if (!paymentInstance || typeof paymentInstance.orders !== 'object' || paymentInstance.orders === null) {
         // This error should ideally be caught during getCashfreeOrderStatusInstance, but double-check
        console.error('Cashfree Order Status FATAL Error: Cashfree SDK instance is invalid or missing the `orders` property *before* fetch API call. This should not happen.');
        return { success: false, error: 'Payment SDK configuration error: SDK properties missing unexpectedly for status check. Please check server logs.' };
   }
   // Check if the fetch method exists, again double-checking
    if (typeof paymentInstance.orders.fetch !== 'function') {
        console.error('Cashfree Order Status FATAL Error: Method `cashfree.orders.fetch` not found *before* fetch API call. SDK might be corrupted or incorrectly initialized.');
        return { success: false, error: 'Payment SDK configuration error: FetchOrder method is not available unexpectedly for status check. Please check server logs.' };
    }

  console.log('Cashfree Order Status Info: Method `cashfree.orders.fetch` found. Proceeding with API call (v5+ style).');


  try {
    console.log(`Cashfree Get Order Request (v5+) for order_id: ${orderId}`);

    // *** Use the instance method 'orders.fetch' (v5+ SDK style) ***
    const response = await paymentInstance.orders.fetch(orderId);
    // Avoid logging full response in production unless debugging
    console.log('Cashfree Get Order Response keys (v5+) (if available):', response ? Object.keys(response) : 'null/undefined');
    console.log('Cashfree Get Order Response Data (v5+) (if available):', response?.data); // Log safely


    if (response.data) {
       // Check if order_status exists, otherwise report potentially incomplete data
        if (typeof response.data.order_status !== 'string') { // Check type as well
             console.warn(`Order status missing or not a string for order ${orderId}`, response.data);
             if (response.data.order_id && response.data.cf_order_id) {
                // If we have IDs but no status, likely still processing or an edge case
                return { success: true, order_status: 'PENDING', error: 'Order status not yet available from gateway.' };
             } else {
                 console.error(`Incomplete order data for ${orderId} - missing order_status and potentially other key fields.`);
                return { success: false, error: 'Incomplete order data received from payment gateway.' };
             }
        }

      return {
        success: true,
        order_status: response.data.order_status.toUpperCase() as OrderStatusResponse['order_status'],
        transaction_status: response.data.transaction_status, // Often useful too
        payment_amount: response.data.order_amount,
      };
    } else {
      console.error(`Cashfree returned no data property in the response for order ${orderId}`);
      // Log the raw response if data property is missing but response exists
      if (response) {
          console.error('Cashfree Order Status Error: Raw response received without data property:', response);
      }
      return { success: false, error: 'No data received from payment gateway when fetching order status.' };
    }
  } catch (error: any) {
    console.error(`Cashfree Error: Exception during cashfree.orders.fetch call for order ${orderId}:`, error);

     let errorMessage = 'An unexpected error occurred while fetching order status.';
     let statusCode: number | undefined;

     // Check if the error itself has a 'response' property (Axios-like error structure)
     if (error.response) {
        statusCode = error.response.status;
        const responseData = error.response.data; // Might contain { message, code, type }
        console.error('Cashfree Order Status Error: Detailed API Error Response Data:', responseData || error.response);

        if (responseData && typeof responseData === 'object') {
            if (responseData.message) {
                 errorMessage = responseData.message;
                 if (responseData.code) {
                     errorMessage += ` (Code: ${responseData.code})`;
                     // *** Specific check for Authentication Failed ***
                      if (responseData.code === 'authentication_failed' || responseData.code === 'request_failed') {
                          console.error("Cashfree Order Status Authentication Error: The provided API keys (App ID/Secret Key) are likely incorrect or invalid for the current environment (Sandbox/Production). Please verify your .env.local or server environment variables.");
                          errorMessage = `Authentication failed with Cashfree during status check. Check API credentials/environment. (Code: ${responseData.code})`;
                      } else if (statusCode === 404) {
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
             errorMessage = 'Payment SDK configuration error: FetchOrder method missing (check SDK version/init).'
         } else if (errorMessage.includes('Payment SDK initialization error')) {
              // Catching the specific error from getCashfreeOrderStatusInstance
              console.error('Cashfree Order Status Diagnosis: SDK initialization failed, possibly due to configuration issues (check App ID, Secret Key, Environment) or internal problems.');
              errorMessage = 'Payment SDK initialization failed for status check. Check server configuration.';
         } else if (errorMessage.includes('missing orders property')) {
              // Catching the specific error from the check before API call
              console.error('Cashfree Order Status Diagnosis: SDK instance is missing the `orders` property. Initialization might have failed silently or SDK version issue.');
              errorMessage = 'Payment SDK initialization error: SDK structure incorrect for status check.';
         } else if (errorMessage.includes('Payment SDK internal structure error')) {
              // Catching the specific error from getCashfreeOrderStatusInstance validation
              console.error('Cashfree Order Status Diagnosis: SDK instance structure was invalid immediately after creation for status check.');
              errorMessage = 'Payment SDK failed to initialize properly for status check. Check server logs for details.';
         }
     } else {
         console.error('Cashfree Order Status Error: Unknown error structure caught:', error);
         errorMessage = `An unknown error occurred during status check: ${JSON.stringify(error)}`;
     }

    return { success: false, error: errorMessage };
  }
}
