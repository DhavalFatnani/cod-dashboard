import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface UpdateOrderReasonRequest {
  order_id: string;
  non_collected_reason?: string;
  future_collection_possible?: boolean;
  expected_collection_date?: string;
}

interface SubmitHandoverRequest {
  asm_id: string;
  handover_date: string;
  expected_amount: number;
  handover_data_file_url?: string;
  metadata?: Record<string, any>;
}

interface BulkUpdateReasonsRequest {
  orders: Array<{
    order_number: string;
    collection_status: 'COLLECTED' | 'NOT_COLLECTED';
    non_collection_reason?: string;
    future_collection_possible?: boolean;
    expected_collection_date?: string;
  }>;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        ...corsHeaders,
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Max-Age": "86400",
      },
    });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

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

    // Verify user
    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser(token);

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid authentication" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get user profile
    const { data: profile } = await supabaseClient
      .from("users")
      .select("role, asm_id, sm_id")
      .eq("id", user.id)
      .single();

    if (!profile) {
      return new Response(
        JSON.stringify({ error: "User profile not found" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const url = new URL(req.url);
    // Extract path after /functions/v1/asm-handover
    // Full path might be: /functions/v1/asm-handover/update-order-reason
    let path = url.pathname;
    if (path.includes("/asm-handover/")) {
      path = "/" + path.split("/asm-handover/")[1];
    } else if (path.startsWith("/asm-handover")) {
      path = path.replace("/asm-handover", "");
    }
    
    // Ensure path starts with /
    if (!path.startsWith("/")) {
      path = "/" + path;
    }

    // Route: POST /update-order-reason
    if (req.method === "POST" && path === "/update-order-reason") {
      if (profile.role !== "asm" && profile.role !== "admin") {
        return new Response(
          JSON.stringify({ error: "Only ASMs can update order reasons" }),
          {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const data: UpdateOrderReasonRequest = await req.json();

      if (!data.order_id) {
        return new Response(
          JSON.stringify({ error: "Missing order_id" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Verify order belongs to ASM (or is unassigned)
      const { data: order } = await supabaseClient
        .from("orders")
        .select("asm_id, payment_type, cod_type, money_state")
        .eq("id", data.order_id)
        .single();

      if (!order) {
        return new Response(
          JSON.stringify({ error: "Order not found" }),
          {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Verify it's a COD Hard Cash order
      if (order.payment_type !== "COD" || order.cod_type !== "COD_HARD") {
        return new Response(
          JSON.stringify({ error: "Order must be a COD Hard Cash order" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Allow if order is unassigned (asm_id is null) or belongs to this ASM
      if (profile.role === "asm" && order.asm_id !== null && order.asm_id !== profile.asm_id) {
        return new Response(
          JSON.stringify({ error: "Order does not belong to this ASM" }),
          {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Update order
      const updateData: any = {
        asm_collection_reason_updated_at: new Date().toISOString(),
      };

      if (data.non_collected_reason !== undefined) {
        updateData.asm_non_collected_reason = data.non_collected_reason;
      }
      if (data.future_collection_possible !== undefined) {
        updateData.asm_future_collection_possible = data.future_collection_possible;
      }
      if (data.expected_collection_date !== undefined) {
        updateData.asm_expected_collection_date = data.expected_collection_date || null;
      }

      const { data: updatedOrder, error: updateError } = await supabaseClient
        .from("orders")
        .update(updateData)
        .eq("id", data.order_id)
        .select()
        .single();

      if (updateError) {
        throw updateError;
      }

      return new Response(
        JSON.stringify({ success: true, order: updatedOrder }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Route: POST /bulk-update-reasons
    if (req.method === "POST" && path === "/bulk-update-reasons") {
      if (profile.role !== "asm" && profile.role !== "admin") {
        return new Response(
          JSON.stringify({ error: "Only ASMs can bulk update reasons" }),
          {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const data: BulkUpdateReasonsRequest = await req.json();

      if (!data.orders || data.orders.length === 0) {
        return new Response(
          JSON.stringify({ error: "No orders provided" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const results = [];
      const errors = [];

      for (const orderData of data.orders) {
        // Find order by order_number
        const { data: order } = await supabaseClient
          .from("orders")
          .select("id, asm_id")
          .eq("order_number", orderData.order_number)
          .single();

        if (!order) {
          errors.push({
            order_number: orderData.order_number,
            error: "Order not found",
          });
          continue;
        }

        if (profile.role === "asm" && order.asm_id !== profile.asm_id) {
          errors.push({
            order_number: orderData.order_number,
            error: "Order does not belong to this ASM",
          });
          continue;
        }

        const updateData: any = {
          asm_collection_reason_updated_at: new Date().toISOString(),
        };

        if (orderData.collection_status === "NOT_COLLECTED") {
          updateData.asm_non_collected_reason = orderData.non_collection_reason || null;
          updateData.asm_future_collection_possible = orderData.future_collection_possible || false;
          updateData.asm_expected_collection_date = orderData.expected_collection_date || null;
        } else {
          // If collected, clear non-collection fields
          updateData.asm_non_collected_reason = null;
          updateData.asm_future_collection_possible = false;
          updateData.asm_expected_collection_date = null;
        }

        const { error: updateError } = await supabaseClient
          .from("orders")
          .update(updateData)
          .eq("id", order.id);

        if (updateError) {
          errors.push({
            order_number: orderData.order_number,
            error: updateError.message,
          });
        } else {
          results.push({
            order_number: orderData.order_number,
            success: true,
          });
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          updated: results.length,
          errors: errors.length,
          results,
          errors: errors.length > 0 ? errors : undefined,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Route: POST /submit
    if (req.method === "POST" && path === "/submit") {
      if (profile.role !== "asm" && profile.role !== "admin") {
        return new Response(
          JSON.stringify({ error: "Only ASMs can submit handover data" }),
          {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const data: SubmitHandoverRequest & { collected_order_ids?: string[] } = await req.json();

      if (!data.asm_id || !data.handover_date || !data.expected_amount) {
        return new Response(
          JSON.stringify({ error: "Missing required fields" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      if (profile.role === "asm" && data.asm_id !== profile.asm_id) {
        return new Response(
          JSON.stringify({ error: "ASM ID mismatch" }),
          {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Get ASM name
      const { data: asmProfile } = await supabaseClient
        .from("users")
        .select("full_name, asm_id")
        .eq("asm_id", data.asm_id)
        .single();

      const asmName = asmProfile?.full_name || `ASM ${data.asm_id}`;

      // Create handover data record
      const { data: handoverData, error: insertError } = await supabaseClient
        .from("asm_handover_data")
        .insert({
          asm_id: data.asm_id,
          handover_date: data.handover_date,
          expected_amount: data.expected_amount,
          handover_data_file_url: data.handover_data_file_url,
          status: "PENDING",
          metadata: data.metadata || {},
        })
        .select()
        .single();

      if (insertError) {
        throw insertError;
      }

      // Update order states: Create HANDOVER_TO_ASM events for collected orders
      if (data.collected_order_ids && data.collected_order_ids.length > 0) {
        // Get orders that are in COLLECTED_BY_RIDER state
        const { data: orders } = await supabaseClient
          .from("orders")
          .select("id, cod_amount, money_state")
          .in("id", data.collected_order_ids)
          .eq("money_state", "COLLECTED_BY_RIDER")
          .eq("payment_type", "COD")
          .eq("cod_type", "COD_HARD");

        if (orders && orders.length > 0) {
          // Create HANDOVER_TO_ASM events for these orders
          const handoverEvents = orders.map((order) => ({
            order_id: order.id,
            asm_id: data.asm_id,
            asm_name: asmName,
            event_type: "HANDOVER_TO_ASM" as const,
            amount: order.cod_amount,
            notes: `Handover submitted to SM on ${data.handover_date}`,
            metadata: {
              handover_data_id: handoverData.id,
              ...data.metadata,
            },
          }));

          const { error: eventError } = await supabaseClient
            .from("asm_events")
            .insert(handoverEvents);

          if (eventError) {
            console.error("Error creating handover events:", eventError);
            // Don't fail the entire request, but log the error
          }
        }
      }

      return new Response(
        JSON.stringify({ success: true, handover_data: handoverData }),
        {
          status: 201,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Route: GET /data/:asmId
    if (req.method === "GET" && path.startsWith("/data/")) {
      const asmId = path.replace("/data/", "");

      if (!asmId) {
        return new Response(
          JSON.stringify({ error: "Missing ASM ID" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Check permissions
      if (
        profile.role !== "admin" &&
        profile.role !== "sm" &&
        profile.role !== "finance" &&
        (profile.role !== "asm" || profile.asm_id !== asmId)
      ) {
        return new Response(
          JSON.stringify({ error: "Insufficient permissions" }),
          {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const { data: handoverData, error: fetchError } = await supabaseClient
        .from("asm_handover_data")
        .select("*")
        .eq("asm_id", asmId)
        .order("created_at", { ascending: false });

      if (fetchError) {
        throw fetchError;
      }

      return new Response(
        JSON.stringify({ success: true, handover_data: handoverData }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({ error: "Route not found" }),
      {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
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

