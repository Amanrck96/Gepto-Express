
'use server';

import { Cashfree } from 'cashfree-pg';

interface OrderStatusResponse {
  success: boolean;
  order_status?: string; // e.g., "PAID", "ACTIVE", "EXPIRED", "FAILED"
  transaction_status?: string; // e.g., "SUCCESS", "PENDING", "FAILED"
  payment_amount?: number;
  error?: string;
}

// Define the Cashfree API version date (required for v4 SDK)
// Use a recent, valid version date from Cashfree docs if needed.
const CASHFREE_API_VERSION = "2023-08-01";

export async function getOrderStatus(orderId: string): Promise<OrderStatusResponse> {
  const appId = process.env.CASHFREE_APP_ID;
  const secretKey = process.env.CASHFREE_SECRET_KEY;

  if (!appId || !secretKey) {
    console.error('Cashfree API keys are not configured.');
    return { success: false, error: 'Payment gateway configuration error.' };
  }

  if (!orderId) {
    return { success: false, error: 'Order ID is required.' };
  }

   // Configure Cashfree SDK globally for static methods (v4 style)
   // Determine environment - Use PRODUCTION since production keys were provided
   const cashfreeEnv = Cashfree.Environment.PRODUCTION; // Use Enum for safety
   console.log(`Cashfree Info: Configuring Cashfree SDK in ${cashfreeEnv === Cashfree.Environment.PRODUCTION ? 'PRODUCTION' : 'SANDBOX'} mode for order status check.`);

   try {
     Cashfree.XClientId = appId;
     Cashfree.XClientSecret = secretKey;
     Cashfree.XEnvironment = cashfreeEnv;
     console.log('Cashfree Info: SDK configured globally for order status check.');
   } catch (configError: any) {
     console.error('Cashfree Error: Error during Cashfree SDK configuration for order status:', configError);
     return { success: false, error: `Payment SDK configuration error: ${configError.message || 'Unknown configuration error.'}` };
   }

  try {
    console.log(`Cashfree Get Order Request for order_id: ${orderId}`);
    // Use the static PGFetchOrder method with the API version (v4 style)
    const response = await Cashfree.PGFetchOrder(CASHFREE_API_VERSION, orderId);
    console.log('Cashfree Get Order Response:', response.data);

    if (response.data) {
       // Check if order_status exists, otherwise report potentially incomplete data
        if (!response.data.order_status) {
             console.warn(`Order status missing for order ${orderId}`, response.data);
             // Decide how to handle this - maybe treat as PENDING or FAILED?
             // For now, let's return success: false if essential status is missing
             if (response.data.order_id && response.data.cf_order_id) {
                // If we have IDs but no status, likely still processing or an edge case
                return { success: true, order_status: 'PENDING', error: 'Order status not yet available.' };
             } else {
                return { success: false, error: 'Incomplete order data received from gateway.' };
             }
        }

      return {
        success: true,
        order_status: response.data.order_status,
        transaction_status: response.data.transaction_status, // Often useful too
        payment_amount: response.data.order_amount,
      };
    } else {
      // This case might indicate a network issue or unexpected empty response
      console.error(`Cashfree returned no data for order ${orderId}`);
      return { success: false, error: 'No data received from payment gateway.' };
    }
  } catch (error: any) {
    console.error(`Error fetching status for order ${orderId}:`, error);
    // Handle specific Cashfree errors if possible (e.g., 404 for order not found)
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
        console.error('Detailed Cashfree Error:', error.response.data || error);
     } else if (error.message) {
        errorMessage = error.message;
     }


     if (statusCode === 404) {
        return { success: false, error: 'Order not found.' };
     }

    return { success: false, error: errorMessage };
  }
}

