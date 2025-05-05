'use server';

import { Cashfree } from 'cashfree-pg';

interface OrderStatusResponse {
  success: boolean;
  order_status?: string; // e.g., "PAID", "ACTIVE", "EXPIRED", "FAILED"
  transaction_status?: string; // e.g., "SUCCESS", "PENDING", "FAILED"
  payment_amount?: number;
  error?: string;
}

// --- Removed getCashfreeOrderStatusInstance - Will use static configuration ---

// Function to configure Cashfree SDK statically (v4.x style) for status check
function configureCashfreeSDKForStatus() {
  console.log('Cashfree Order Status Info: Configuring SDK statically (v4.x style) for status check...');
  const appId = process.env.CASHFREE_APP_ID;
  const secretKey = process.env.CASHFREE_SECRET_KEY;

  // **Crucial Check**: Ensure environment variables are loaded.
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

  // **Set static properties for v4.x style SDK usage**
  Cashfree.XClientId = appId;
  Cashfree.XClientSecret = secretKey;
  Cashfree.XEnvironment = cashfreeEnv;
  // Specify API version (required for older SDK style used by v4.x)
  Cashfree.XApiVersion = "2023-08-01"; // Use the same recent stable version as in payment.ts

  console.log(`Cashfree Order Status Info: Statically configured SDK in ${cashfreeEnv === Cashfree.Environment.PRODUCTION ? 'PRODUCTION' : 'SANDBOX'} mode for status check.`);
  console.log(`Cashfree Order Status Info: Using API Version: ${Cashfree.XApiVersion}`);

   // **Verification**: Check if static properties were set (basic check)
   if (!Cashfree.XClientId || !Cashfree.XClientSecret || !Cashfree.XEnvironment || !Cashfree.XApiVersion) {
        console.error('Cashfree Order Status FATAL Error: Failed to set static SDK properties (XClientId, XClientSecret, XEnvironment, XApiVersion) for status check.');
        throw new Error('Payment SDK configuration error for status check: Failed to set static properties.');
   } else {
        console.log('Cashfree Order Status Info: Static SDK properties successfully set for status check.');
   }
}


export async function getOrderStatus(orderId: string): Promise<OrderStatusResponse> {

  if (!orderId) {
    return { success: false, error: 'Order ID is required.' };
  }

   // **Configure SDK FIRST before making the call**
   try {
     configureCashfreeSDKForStatus();
   } catch (sdkError: any) {
      // Catch configuration errors specifically
     console.error("Cashfree Order Status Error: Failed to configure SDK during getOrderStatus.", sdkError);
      // Provide a clearer error message
     return { success: false, error: `Payment SDK configuration error for status check: ${sdkError.message || "SDK properties missing. Please check server logs."}` };
   }


  // **Check if the static method exists (important sanity check)**
   if (typeof Cashfree.PGFetchOrder !== 'function') {
        console.error('Cashfree Order Status FATAL Error: Static method `Cashfree.PGFetchOrder` not found. SDK might be corrupted, incorrectly installed/imported, or configuration failed.');
        return { success: false, error: 'Payment SDK configuration error: FetchOrder method is not available. Please check server logs and SDK setup.' };
    }

  console.log('Cashfree Order Status Info: Static method `Cashfree.PGFetchOrder` found. Proceeding with API call (v4.x style).');


  try {
    console.log(`Cashfree Get Order Request (v4.x style) for order_id: ${orderId}`);

    // *** Use the static 'PGFetchOrder' method (v4.x SDK style) ***
    // The API version is now set statically in configureCashfreeSDKForStatus
    const response = await Cashfree.PGFetchOrder(orderId);
    // Avoid logging full response in production unless debugging
    console.log('Cashfree Get Order Response keys (v4.x) (if available):', response ? Object.keys(response) : 'null/undefined');
    // Log specific fields safely
    console.log('Cashfree Get Order Response Data (v4.x) (if available):', response?.data ? { order_id: response.data.order_id, cf_order_id: response.data.cf_order_id, order_status: response.data.order_status } : 'No data');


    if (response.data) {
       // Check if order_status exists, otherwise report potentially incomplete data
        if (typeof response.data.order_status !== 'string') { // Check type as well
             console.warn(`Order status missing or not a string for order ${orderId}. Response data:`, response.data);
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
    console.error(`Cashfree Error: Exception during Cashfree.PGFetchOrder call for order ${orderId}:`, error);

     let errorMessage = 'An unexpected error occurred while fetching order status.';
     let statusCode: number | undefined;

     // Check if the error itself has a 'response' property (Axios-like error structure from SDK)
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
                     // Use codes commonly returned by Cashfree for auth issues
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
         if (errorMessage.includes('Cashfree.PGFetchOrder is not a function')) {
             errorMessage = 'Payment SDK configuration error: FetchOrder method missing (check SDK version/init).'
         } else if (errorMessage.includes('Payment SDK configuration error')) {
              // Catching the specific error from configureCashfreeSDKForStatus or similar checks
              console.error('Cashfree Order Status Diagnosis: SDK configuration failed, possibly due to missing environment variables (CASHFREE_APP_ID, CASHFREE_SECRET_KEY) or failure to set static properties.');
              errorMessage = 'Payment SDK configuration failed for status check. Check server configuration.';
         }
     } else {
         console.error('Cashfree Order Status Error: Unknown error structure caught:', error);
         errorMessage = `An unknown error occurred during status check: ${JSON.stringify(error)}`;
     }

    return { success: false, error: errorMessage };
  }
}
