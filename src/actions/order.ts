'use server';

import { Cashfree } from 'cashfree-pg';

// Initialize Cashfree - Ensure environment variables are set
Cashfree.XClientId = process.env.CASHFREE_APP_ID!;
Cashfree.XClientSecret = process.env.CASHFREE_SECRET_KEY!;
Cashfree.XEnvironment = Cashfree.Environment.PRODUCTION; // Or Cashfree.Environment.SANDBOX

interface OrderStatusResponse {
  success: boolean;
  order_status?: string; // e.g., "PAID", "ACTIVE", "EXPIRED", "FAILED"
  transaction_status?: string; // e.g., "SUCCESS", "PENDING", "FAILED"
  payment_amount?: number;
  error?: string;
}

export async function getOrderStatus(orderId: string): Promise<OrderStatusResponse> {
  if (!process.env.CASHFREE_APP_ID || !process.env.CASHFREE_SECRET_KEY) {
    console.error('Cashfree API keys are not configured.');
    return { success: false, error: 'Payment gateway configuration error.' };
  }

  if (!orderId) {
    return { success: false, error: 'Order ID is required.' };
  }

  try {
    console.log(`Cashfree Get Order Request for order_id: ${orderId}`);
    const response = await Cashfree.PGOrderFetch(orderId);
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
     const statusCode = error.response?.status;
     const errorMessage = error.response?.data?.message || error.message || 'An unexpected error occurred while fetching order status.';

     if (statusCode === 404) {
        return { success: false, error: 'Order not found.' };
     }

    return { success: false, error: errorMessage };
  }
}
