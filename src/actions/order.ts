
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
    return cashfreeOrderStatusInstance;
  }

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
    cashfreeOrderStatusInstance = new Cashfree(cashfreeEnv, appId, secretKey);
    console.log('Cashfree Order Status Info: SDK v5+ instance created successfully for status checks.');
    return cashfreeOrderStatusInstance;
   } catch (configError: any) {
     console.error('Cashfree Order Status FATAL Error: Error during Cashfree SDK v5+ initialization for order status:', configError);
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
     console.error("Cashfree Order Status Error: Failed to get SDK instance.", sdkError);
     return { success: false, error: sdkError.message || "Payment SDK could not be initialized for status check." };
   }


  // **Diagnosis Step 1: Check if the SDK instance and the 'orders' property exist**
   if (!paymentInstance || typeof paymentInstance.orders !== 'object' || paymentInstance.orders === null) {
        console.error('Cashfree Order Status FATAL Error: Cashfree SDK instance is invalid or missing the `orders` property for status check.');
        return { success: false, error: 'Payment SDK configuration error: SDK properties missing for status check. Please check server logs.' };
   }
   // Check if the fetch method exists
    if (typeof paymentInstance.orders.fetch !== 'function') {
        console.error('Cashfree Order Status FATAL Error: Method `cashfree.orders.fetch` not found. SDK might be improperly initialized, version mismatch, or corrupted installation.');
        return { success: false, error: 'Payment SDK configuration error: FetchOrder method is not available for status check. Please check server logs.' };
    }

  console.log('Cashfree Order Status Info: Method `cashfree.orders.fetch` found. Proceeding with API call (v5+ style).');


  try {
    console.log(`Cashfree Get Order Request (v5+) for order_id: ${orderId}`);

    // *** Use the instance method 'orders.fetch' (v5+ SDK style) ***
    const response = await paymentInstance.orders.fetch(orderId);
    console.log('Cashfree Get Order Response Data (v5+) (if available):', response?.data); // Log safely

    if (response.data) {
       // Check if order_status exists, otherwise report potentially incomplete data
        if (!response.data.order_status) {
             console.warn(`Order status missing for order ${orderId}`, response.data);
             if (response.data.order_id && response.data.cf_order_id) {
                // If we have IDs but no status, likely still processing or an edge case
                return { success: true, order_status: 'PENDING', error: 'Order status not yet available from gateway.' };
             } else {
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
      console.error(`Cashfree returned no data for order ${orderId}`);
      return { success: false, error: 'No data received from payment gateway when fetching order status.' };
    }
  } catch (error: any) {
    console.error(`Cashfree Error: Exception during cashfree.orders.fetch call for order ${orderId}:`, error);

     let errorMessage = 'An unexpected error occurred while fetching order status.';
     let statusCode: number | undefined;

     if (error.response) {
        // Error from the Cashfree API (e.g., 4xx, 5xx)
        statusCode = error.response.status;
        const responseData = error.response.data;
        if (responseData && responseData.message) {
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
             errorMessage = `Cashfree API Error during status check: Status ${statusCode}. No specific message.`;
        }
        console.error('Cashfree Order Status Error: Detailed API Error Response:', responseData || error.response);
     } else if (error.message) { // Handle errors not from Cashfree API
        errorMessage = error.message;
        if (!error.response) {
             console.error('Cashfree Order Status Error: Non-API Error details:', error);
        }
        // Check for specific SDK-related errors based on messages
         if (errorMessage.includes('cashfree.orders.fetch is not a function')) {
             errorMessage = 'Payment SDK configuration error: FetchOrder method missing (check SDK version/init).'
         } else if (errorMessage.includes('Payment SDK initialization error')) {
              console.error('Cashfree Order Status Diagnosis: SDK initialization failed, possibly due to configuration issues (check App ID, Secret Key, Environment) or internal problems.');
              errorMessage = 'Payment SDK initialization failed for status check. Check server configuration.';
         }
     } else {
         console.error('Cashfree Order Status Error: Unknown error structure:', error);
     }

    return { success: false, error: errorMessage };
  }
}

    