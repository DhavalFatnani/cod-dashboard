import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface CreateDepositFromSuperBundleRequest {
  superbundle_ids: string[];
  deposit_number: string;
  deposit_date: string;
  deposit_slip_url?: string;
  bank_account?: string;
  actual_amount_received?: number;
  metadata?: Record<string, any>;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        ...corsHeaders,
        "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
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
      .select("role, sm_id, sm_name")
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
    let path = url.pathname;
    if (path.includes("/sm-superbundle-deposits/")) {
      path = "/" + path.split("/sm-superbundle-deposits/")[1];
    } else if (path.startsWith("/sm-superbundle-deposits")) {
      path = path.replace("/sm-superbundle-deposits", "");
    }
    if (!path.startsWith("/")) {
      path = "/" + path;
    }

    // Route: POST /create (create deposit from superbundle(s))
    if (req.method === "POST" && (path === "/create" || path === "/")) {
      if (profile.role !== "sm" && profile.role !== "admin") {
        return new Response(
          JSON.stringify({ error: "Only SMs can create deposits from superbundles" }),
          {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const data: CreateDepositFromSuperBundleRequest = await req.json();

      if (!data.superbundle_ids || data.superbundle_ids.length === 0) {
        return new Response(
          JSON.stringify({ error: "At least one superbundle_id is required" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      if (!data.deposit_number || !data.deposit_date) {
        return new Response(
          JSON.stringify({ error: "deposit_number and deposit_date are required" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Get superbundles
      const { data: superbundles, error: superbundlesError } = await supabaseClient
        .from("asm_superbundles")
        .select("*")
        .in("id", data.superbundle_ids)
        .in("status", ["READY_FOR_HANDOVER", "HANDEDOVER_TO_SM"]);

      if (superbundlesError) {
        throw superbundlesError;
      }

      if (!superbundles || superbundles.length === 0) {
        return new Response(
          JSON.stringify({ error: "No valid superbundles found (must be READY_FOR_HANDOVER or HANDEDOVER_TO_SM)" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Check if all superbundles are assigned to SM (unless admin)
      if (profile.role === "sm") {
        const invalidSuperbundles = superbundles.filter(
          (sb) => sb.sm_id !== profile.sm_id && sb.sm_id !== null
        );
        if (invalidSuperbundles.length > 0) {
          return new Response(
            JSON.stringify({
              error: "Some superbundles are not assigned to this SM",
              invalid_superbundles: invalidSuperbundles.map((sb) => sb.id),
            }),
            {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }
      }

      // Calculate expected amount from superbundles
      const expectedAmount = superbundles.reduce(
        (sum, sb) => sum + parseFloat(String(sb.validated_amount || sb.expected_amount)),
        0
      );

      // Validate bank amount if provided
      const actualAmount = data.actual_amount_received || expectedAmount;
      const validationStatus =
        Math.abs(actualAmount - expectedAmount) < 0.01 ? "VALIDATED" : "MISMATCH";

      // Get ASM info from first superbundle
      const asmId = superbundles[0].asm_id;
      const { data: asmProfile } = await supabaseClient
        .from("users")
        .select("full_name, asm_id")
        .eq("asm_id", asmId)
        .single();

      const asmName = asmProfile?.full_name || `ASM ${asmId}`;

      // Create deposit
      const { data: deposit, error: depositError } = await supabaseClient
        .from("deposits")
        .insert({
          deposit_number: data.deposit_number,
          asm_id: asmId,
          asm_name: asmName,
          total_amount: actualAmount,
          expected_amount: expectedAmount,
          actual_amount_received: actualAmount,
          deposit_slip_url: data.deposit_slip_url || null,
          deposit_date: data.deposit_date,
          bank_account: data.bank_account || null,
          status: "PENDING",
          validation_status: validationStatus,
          metadata: data.metadata || {},
        })
        .select()
        .single();

      if (depositError) {
        throw depositError;
      }

      // Get all orders from superbundles via bundles
      const { data: superbundleBundles } = await supabaseClient
        .from("asm_superbundle_bundles")
        .select("bundle_id")
        .in("superbundle_id", data.superbundle_ids);

      if (!superbundleBundles || superbundleBundles.length === 0) {
        return new Response(
          JSON.stringify({ error: "No bundles found in superbundles" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const bundleIds = superbundleBundles.map((sb) => sb.bundle_id);

      const { data: bundleOrders } = await supabaseClient
        .from("rider_bundle_orders")
        .select("order_id")
        .in("bundle_id", bundleIds);

      if (!bundleOrders || bundleOrders.length === 0) {
        return new Response(
          JSON.stringify({ error: "No orders found in bundles" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const orderIds = bundleOrders.map((bo) => bo.order_id);

      // Get order amounts
      const { data: orders } = await supabaseClient
        .from("orders")
        .select("id, cod_amount, collected_amount")
        .in("id", orderIds);

      // Create deposit-order mappings
      const depositOrders = (orders || []).map((order) => ({
        deposit_id: deposit.id,
        order_id: order.id,
        amount: parseFloat(String(order.collected_amount || order.cod_amount || 0)),
        collection_status: "COLLECTED" as const,
      }));

      const { error: depositOrdersError } = await supabaseClient
        .from("deposit_orders")
        .insert(depositOrders);

      if (depositOrdersError) {
        // Rollback deposit creation
        await supabaseClient.from("deposits").delete().eq("id", deposit.id);
        throw depositOrdersError;
      }

      // Update superbundle statuses to INCLUDED_IN_DEPOSIT
      const { error: updateSuperbundlesError } = await supabaseClient
        .from("asm_superbundles")
        .update({
          status: "INCLUDED_IN_DEPOSIT",
          deposit_id: deposit.id,
          updated_at: new Date().toISOString(),
        })
        .in("id", data.superbundle_ids);

      if (updateSuperbundlesError) {
        console.error("Error updating superbundles:", updateSuperbundlesError);
      }

      // Update orders to DEPOSITED state
      const { error: updateOrdersError } = await supabaseClient
        .from("orders")
        .update({
          money_state: "DEPOSITED",
          deposited_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .in("id", orderIds);

      if (updateOrdersError) {
        console.error("Error updating orders:", updateOrdersError);
      }

      // Create DEPOSITED events for orders
      const depositEvents = (orders || []).map((order) => ({
        order_id: order.id,
        asm_id: asmId,
        asm_name: asmName,
        event_type: "DEPOSITED" as const,
        amount: parseFloat(String(order.collected_amount || order.cod_amount || 0)),
        notes: `Deposit ${data.deposit_number} created from superbundle(s)`,
        metadata: {
          deposit_id: deposit.id,
          superbundle_ids: data.superbundle_ids,
        },
      }));

      const { error: eventsError } = await supabaseClient
        .from("asm_events")
        .insert(depositEvents);

      if (eventsError) {
        console.error("Error creating deposit events:", eventsError);
      }

      return new Response(
        JSON.stringify({
          success: true,
          deposit: {
            ...deposit,
            expected_amount: expectedAmount,
            actual_amount_received: actualAmount,
            validation_status: validationStatus,
          },
          order_count: depositOrders.length,
          superbundle_count: superbundles.length,
        }),
        {
          status: 201,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Route: GET /deposit/:depositId (get deposit detail with linked bundles/orders)
    if (req.method === "GET" && path.startsWith("/deposit/")) {
      const depositId = path.replace("/deposit/", "");

      const { data: deposit, error: depositError } = await supabaseClient
        .from("deposits")
        .select("*")
        .eq("id", depositId)
        .single();

      if (depositError || !deposit) {
        return new Response(
          JSON.stringify({ error: "Deposit not found" }),
          {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Get linked superbundles
      const { data: superbundles } = await supabaseClient
        .from("asm_superbundles")
        .select(`
          *,
          asm_superbundle_bundles (
            bundle_id,
            rider_bundles (
              id,
              rider_id,
              rider_name,
              expected_amount,
              status,
              rider_bundle_orders (
                order_id,
                orders (
                  id,
                  order_number,
                  cod_amount,
                  collected_amount,
                  money_state
                )
              )
            )
          )
        `)
        .eq("deposit_id", depositId);

      // Get deposit orders
      const { data: depositOrders } = await supabaseClient
        .from("deposit_orders")
        .select(`
          *,
          orders (
            id,
            order_number,
            cod_amount,
            collected_amount,
            money_state
          )
        `)
        .eq("deposit_id", depositId);

      return new Response(
        JSON.stringify({
          success: true,
          deposit,
          superbundles: superbundles || [],
          deposit_orders: depositOrders || [],
        }),
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
