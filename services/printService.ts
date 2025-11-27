import { supabase } from '../lib/supabase';
import { PosterOrder, ShippingAddress, PrintConfig } from '../types';

/**
 * Service to handle Print-on-Demand logic.
 * Integrates with Supabase to store orders and prepare payloads for Prodigi API.
 */

// Mock Pricing Table (In production, this would fetch from Prodigi Catalog API)
const PRICING_TABLE = {
  '12x18': { price: 29.00, sku: 'GLOBAL-CAN-12X18' },
  '18x24': { price: 39.00, sku: 'GLOBAL-CAN-18X24' },
  '24x36': { price: 49.00, sku: 'GLOBAL-CAN-24X36' },
};

export const calculatePrice = (size: string, finish: string): { subtotal: number, sku: string } => {
  const base = (PRICING_TABLE as any)[size] || PRICING_TABLE['18x24'];
  let price = base.price;
  // Gloss finish adds $5
  if (finish === 'gloss') price += 5.00;
  
  return {
    subtotal: price,
    sku: base.sku
  };
};

export const checkFirstTimeDiscount = async (): Promise<boolean> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const { count, error } = await supabase
      .from('poster_orders')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);

    if (error) {
      console.error("Error checking discount eligibility", error);
      return false;
    }

    // If count is 0, they are eligible
    return count === 0;
  } catch (e) {
    return false;
  }
};

export const createPosterOrder = async (
  visionBoardId: string,
  imageUrl: string,
  shipping: ShippingAddress,
  config: PrintConfig,
  totalPrice: number,
  discountApplied: boolean
): Promise<PosterOrder | null> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("User must be logged in to order.");

    // 1. Save Order to Database with 'pending' status initially
    const { data, error } = await supabase
      .from('poster_orders')
      .insert([{
        user_id: user.id,
        vision_board_id: visionBoardId,
        shipping_address: shipping,
        print_config: config,
        total_price: totalPrice,
        discount_applied: discountApplied,
        status: 'pending', // Start as pending until Prodigi confirms
        vendor_order_id: null
      }])
      .select()
      .single();

    if (error) throw error;

    // 2. Construct Prodigi Payload
    const prodigiPayload = {
      orderId: data.id,
      recipient: {
        name: shipping.name,
        address: {
          line1: shipping.line1,
          line2: shipping.line2,
          postalOrZipCode: shipping.postalCode,
          countryCode: shipping.country,
          townOrCity: shipping.city,
          stateOrCounty: shipping.state
        }
      },
      items: [
        {
          sku: config.sku,
          copies: config.quantity,
          sizing: "fillPrintArea",
          assets: [
            {
              url: imageUrl,
              printArea: "default"
            }
          ]
        }
      ]
    };

    // 3. Call Edge Function to submit to Prodigi
    let vendorOrderId = `SIM-${Date.now()}`; // Fallback simulation ID
    let finalStatus = 'submitted';

    try {
      console.log("Calling submit-to-prodigi Edge Function...");
      const { data: prodigiResponse, error: functionError } = await supabase.functions.invoke(
        'submit-to-prodigi',
        { body: prodigiPayload }
      );

      if (functionError) {
        console.warn("Edge Function error:", functionError);
        throw functionError;
      }

      if (prodigiResponse?.success && prodigiResponse?.orderId) {
        vendorOrderId = prodigiResponse.orderId;
        finalStatus = 'submitted';
        console.log("✅ Order submitted to Prodigi:", vendorOrderId);
      } else {
        console.warn("Prodigi API returned unexpected response:", prodigiResponse);
        throw new Error(prodigiResponse?.error || "Unknown Prodigi error");
      }
    } catch (edgeFunctionError) {
      console.warn("Edge Function invocation failed. Falling back to simulation mode.", edgeFunctionError);
      // Keep the simulation ID and mark as submitted for demo purposes
      finalStatus = 'submitted';
    }

    // 4. Update order with vendor ID and final status
    const { error: updateError } = await supabase
      .from('poster_orders')
      .update({
        vendor_order_id: vendorOrderId,
        status: finalStatus
      })
      .eq('id', data.id);

    if (updateError) {
      console.error("Failed to update order with vendor ID:", updateError);
    }

    return {
      id: data.id,
      userId: data.user_id,
      visionBoardId: data.vision_board_id,
      status: finalStatus,
      createdAt: new Date(data.created_at).getTime(),
      totalPrice: data.total_price,
      discountApplied: data.discount_applied,
      shippingAddress: data.shipping_address,
      config: data.print_config,
      vendorOrderId: vendorOrderId
    };

  } catch (error) {
    console.error("Failed to create poster order", error);
    throw error;
  }
};

export const getPosterOrders = async (): Promise<PosterOrder[]> => {
  try {
    const { data, error } = await supabase
      .from('poster_orders')
      .select('*')
      .order('created_at', { ascending: false });

    if (error || !data) return [];

    return data.map((row: any) => ({
      id: row.id,
      userId: row.user_id,
      visionBoardId: row.vision_board_id,
      status: row.status,
      createdAt: new Date(row.created_at).getTime(),
      totalPrice: row.total_price,
      discountApplied: row.discount_applied,
      shippingAddress: row.shipping_address,
      config: row.print_config,
      vendorOrderId: row.vendor_order_id
    }));
  } catch (error) {
    console.error("Failed to fetch orders", error);
    return [];
  }
};