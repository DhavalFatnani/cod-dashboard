import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface RiderEvent {
  order_number: string;
  rider_id: string;
  rider_name?: string;
  event_type: "COLLECTED" | "DISPATCHED" | "CANCELLED" | "RTO";
  amount?: number;
  notes?: string;
  location?: { lat: number; lng: number };
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

    const eventData: RiderEvent = await req.json();

    // Validate required fields
    if (!eventData.order_number || !eventData.rider_id || !eventData.event_type) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Find order
    const { data: order, error: orderError } = await supabaseClient
      .from("orders")
      .select("*")
      .eq("order_number", eventData.order_number)
      .single();

    if (orderError || !order) {
      return new Response(
        JSON.stringify({ error: "Order not found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Insert rider event (triggers will update order state)
    const { data: riderEvent, error } = await supabaseClient
      .from("rider_events")
      .insert({
        order_id: order.id,
        rider_id: eventData.rider_id,
        rider_name: eventData.rider_name,
        event_type: eventData.event_type,
        amount: eventData.amount || order.cod_amount,
        notes: eventData.notes,
        location: eventData.location,
        metadata: eventData.metadata || {},
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    // Log audit event
    await supabaseClient.rpc("log_audit_event", {
      p_action: eventData.event_type,
      p_resource_type: "rider_event",
      p_resource_id: riderEvent.id,
      p_new_values: riderEvent,
    });

    return new Response(JSON.stringify({ success: true, event: riderEvent }), {
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

