
'use server';

import { Cashfree, CashfreeConfig } from 'cashfree-pg'; // Import Cashfree

interface OrderStatusResponse {
  success: boolean;
  order_status?: string; // e.g., "PAID", "ACTIVE", "EXPIRED", "FAILED"
  transaction_status?: string; // e.g., "SUCCESS", "PENDING", "FAILED"
  payment_amount?: number;
  error?: string;
}

// Define the Cashfree API version date (Required for v4 SDK)
const CASHFREE_API_VERSION = "2023-08-01";

export async function getOrderStatus(orderId: string): Promise<OrderStatusResponse> {
  const appId = process.env.CASHFREE_APP_ID;
  const secretKey = process.env.CASHFREE_SECRET_KEY;

  if (!appId || !secretKey) {
    console.error('Cashfree Error: CASHFREE_APP_ID or CASHFREE_SECRET_KEY are not configured.');
    return { success: false, error: 'Payment gateway configuration error. Server environment variables missing.' };
  }

  if (!orderId) {
    return { success: false, error: 'Order ID is required.' };
  }

   // Determine environment - Use PRODUCTION or SANDBOX based on your setup
   const cashfreeEnv = process.env.NODE_ENV === 'production'
                        ? Cashfree.Environment.PRODUCTION
                        : Cashfree.Environment.SANDBOX;
   console.log(`Cashfree Info: Configuring Cashfree SDK in ${cashfreeEnv === Cashfree.Environment.PRODUCTION ? 'PRODUCTION' : 'SANDBOX'} mode for order status check (v4.x).`);

   try {
    // --- SDK v4.x Configuration ---
    // Set credentials and environment directly on the Cashfree class
    Cashfree.XClientId = appId;
    Cashfree.XClientSecret = secretKey;
    Cashfree.XEnvironment = cashfreeEnv;
    // Cashfree.XApiVersion = CASHFREE_API_VERSION; // Optional

    console.log('Cashfree Info: SDK v4.x configured for order status check using static properties.');
     if (!Cashfree.XClientId || !Cashfree.XClientSecret) {
        throw new Error('Failed to set Cashfree static configuration properties.');
     }

   } catch (configError: any) {
     console.error('Cashfree Error: Error during Cashfree SDK v4.x configuration for order status:', configError);
     return { success: false, error: `Payment SDK configuration error: ${configError.message || 'Failed to configure SDK.'}` };
   }


  try {
    console.log(`Cashfree Get Order Request for order_id: ${orderId}`);
    console.log(`Cashfree Info: Using API Version: ${CASHFREE_API_VERSION}`);


    // **Diagnosis: Check if the PGFetchOrder static method exists**
    if (typeof Cashfree.PGFetchOrder !== 'function') {
      console.error('Cashfree FATAL Error: Static method `Cashfree.PGFetchOrder` not found. SDK might be improperly initialized, version mismatch, or corrupted installation.');
      return { success: false, error: 'Payment SDK configuration error: FetchOrder method is not available. Please check server logs.' };
    }
    console.log('Cashfree Info: Static method `Cashfree.PGFetchOrder` found. Proceeding with API call (v4.x style).');


    // *** Use the static method 'PGFetchOrder' with API version as the first argument (v4.x SDK style) ***
    const response = await Cashfree.PGFetchOrder(CASHFREE_API_VERSION, orderId);
    console.log('Cashfree Get Order Response Data (if available):', response?.data); // Log safely

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
        order_status: response.data.order_status,
        transaction_status: response.data.transaction_status, // Often useful too
        payment_amount: response.data.order_amount,
      };
    } else {
      console.error(`Cashfree returned no data for order ${orderId}`);
      return { success: false, error: 'No data received from payment gateway when fetching order status.' };
    }
  } catch (error: any) {
    console.error(`Error during PGFetchOrder call for order ${orderId}:`, error);

     let errorMessage = 'An unexpected error occurred while fetching order status.';
     let statusCode: number | undefined;

     if (error.response) {
        statusCode = error.response.status;
        if (error.response.data && error.response.data.message) {
             errorMessage = error.response.data.message;
             if (error.response.data.code) {
                errorMessage += ` (Code: ${error.response.data.code})`;
             }
        }
        console.error('Detailed Cashfree API Error:', error.response.data || error);
     } else if (error.message) {
        errorMessage = error.message;
         if (errorMessage.includes('Cashfree.PGFetchOrder is not a function')) {
             errorMessage = 'Payment SDK initialization error: FetchOrder method missing.'
         } else {
            console.error('Cashfree Non-API Error details:', error);
         }
     } else {
         console.error('Cashfree Error: Unknown error structure:', error);
     }


     if (statusCode === 404) {
        return { success: false, error: 'Order not found.' };
     }

    return { success: false, error: errorMessage };
  }
}
