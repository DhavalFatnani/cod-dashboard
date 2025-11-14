import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface WMSOrder {
  order_id: string;
  order_number: string;
  store_id: string;
  store_name?: string;
  customer_name?: string;
  customer_phone?: string;
  payment_type: "COD" | "PREPAID";
  cod_type?: "COD_HARD" | "COD_QR";
  order_amount: number;
  cod_amount?: number;
  wms_created_at?: string;
  metadata?: Record<string, any>;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const orderData: WMSOrder = await req.json();

    // Validate required fields
    if (!orderData.order_id || !orderData.order_number || !orderData.store_id) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Check if order already exists (idempotency)
    const { data: existingOrder } = await supabaseClient
      .from("orders")
      .select("id")
      .eq("order_number", orderData.order_number)
      .single();

    if (existingOrder) {
      return new Response(
        JSON.stringify({
          message: "Order already exists",
          order_id: existingOrder.id,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Insert order
    const { data: order, error } = await supabaseClient
      .from("orders")
      .insert({
        order_number: orderData.order_number,
        store_id: orderData.store_id,
        store_name: orderData.store_name,
        customer_name: orderData.customer_name,
        customer_phone: orderData.customer_phone,
        payment_type: orderData.payment_type,
        cod_type: orderData.cod_type || null,
        order_amount: orderData.order_amount,
        cod_amount:
          orderData.payment_type === "COD"
            ? orderData.cod_amount || orderData.order_amount
            : 0,
        money_state:
          orderData.payment_type === "COD" ? "UNCOLLECTED" : "NOT_APPLICABLE",
        wms_order_id: orderData.order_id,
        wms_created_at: orderData.wms_created_at
          ? new Date(orderData.wms_created_at).toISOString()
          : new Date().toISOString(),
        metadata: orderData.metadata || {},
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    // Log audit event
    await supabaseClient.rpc("log_audit_event", {
      p_action: "ORDER_CREATED",
      p_resource_type: "order",
      p_resource_id: order.id,
      p_new_values: order,
    });

    return new Response(JSON.stringify({ success: true, order }), {
      status: 201,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

