import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface CreateBundleRequest {
  order_ids: string[];
  denomination_breakdown: Record<string, number>; // e.g., {"2000": 5, "500": 10}
  photo_proofs: string[]; // Supabase Storage URLs
  digital_signoff: boolean;
  asm_id?: string; // Optional: assign to specific ASM
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        ...corsHeaders,
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
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
      .select("role, rider_id, rider_name")
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
    if (path.includes("/rider-bundles/")) {
      path = "/" + path.split("/rider-bundles/")[1];
    } else if (path.startsWith("/rider-bundles")) {
      path = path.replace("/rider-bundles", "");
    }
    if (!path.startsWith("/")) {
      path = "/" + path;
    }

    // Route: POST / (create bundle)
    if (req.method === "POST" && (path === "/" || path === "")) {
      if (profile.role !== "rider" && profile.role !== "admin") {
        return new Response(
          JSON.stringify({ error: "Only riders can create bundles" }),
          {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const data: CreateBundleRequest = await req.json();

      if (!data.order_ids || data.order_ids.length === 0) {
        return new Response(
          JSON.stringify({ error: "At least one order_id is required" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      if (!data.denomination_breakdown || Object.keys(data.denomination_breakdown).length === 0) {
        return new Response(
          JSON.stringify({ error: "denomination_breakdown is required" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      if (!data.digital_signoff) {
        return new Response(
          JSON.stringify({ error: "Digital signoff is required" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Verify orders belong to rider and are in COLLECTED_BY_RIDER state
      const { data: orders, error: ordersError } = await supabaseClient
        .from("orders")
        .select("id, order_number, cod_amount, collected_amount, money_state, bundle_id, rider_id")
        .in("id", data.order_ids)
        .eq("payment_type", "COD")
        .in("cod_type", ["COD_HARD", "COD_QR"]);

      if (ordersError) {
        throw ordersError;
      }

      if (!orders || orders.length === 0) {
        return new Response(
          JSON.stringify({ error: "No valid COD orders found" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Check if all orders belong to rider (unless admin)
      if (profile.role === "rider") {
        const invalidOrders = orders.filter(
          (o) => o.rider_id !== profile.rider_id || o.money_state !== "COLLECTED_BY_RIDER" || o.bundle_id !== null
        );
        if (invalidOrders.length > 0) {
          return new Response(
            JSON.stringify({
              error: "Some orders are not available for bundling",
              invalid_orders: invalidOrders.map((o) => o.order_number),
            }),
            {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }
      }

      // Calculate expected amount from orders
      const expectedAmount = orders.reduce(
        (sum, o) => sum + parseFloat(String(o.collected_amount || o.cod_amount || 0)),
        0
      );

      // Validate denomination breakdown sums to expected amount
      let calculatedAmount = 0;
      for (const [denomination, count] of Object.entries(data.denomination_breakdown)) {
        calculatedAmount += parseFloat(denomination) * count;
      }

      if (Math.abs(calculatedAmount - expectedAmount) > 0.01) {
        return new Response(
          JSON.stringify({
            error: "Denomination breakdown does not match expected amount",
            expected_amount: expectedAmount,
            calculated_amount: calculatedAmount,
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Create bundle
      const riderId = profile.role === "admin" ? (data as any).rider_id || profile.rider_id : profile.rider_id;
      const riderName = profile.rider_name || `Rider ${riderId}`;

      const { data: bundle, error: bundleError } = await supabaseClient
        .from("rider_bundles")
        .insert({
          rider_id: riderId,
          rider_name: riderName,
          asm_id: data.asm_id || null,
          expected_amount: expectedAmount,
          denomination_breakdown: data.denomination_breakdown,
          photo_proofs: data.photo_proofs || [],
          digital_signoff: data.digital_signoff,
          status: "CREATED",
        })
        .select()
        .single();

      if (bundleError) {
        throw bundleError;
      }

      // Create bundle-order mappings
      const bundleOrders = data.order_ids.map((orderId) => ({
        bundle_id: bundle.id,
        order_id: orderId,
      }));

      const { error: mappingError } = await supabaseClient
        .from("rider_bundle_orders")
        .insert(bundleOrders);

      if (mappingError) {
        // Rollback bundle creation
        await supabaseClient.from("rider_bundles").delete().eq("id", bundle.id);
        throw mappingError;
      }

      // Trigger will update orders to BUNDLED state
      // Return bundle with validated amount
      return new Response(
        JSON.stringify({
          bundle_id: bundle.id,
          expected_amount: expectedAmount,
          validated_amount: calculatedAmount,
          status: bundle.status,
        }),
        {
          status: 201,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Route: GET / (list bundles for rider)
    if (req.method === "GET" && (path === "/" || path === "")) {
      const riderId = url.searchParams.get("rider_id");
      const status = url.searchParams.get("status");

      // Riders can only see their own bundles (unless admin)
      const queryRiderId = profile.role === "admin" ? riderId : profile.rider_id;

      if (!queryRiderId && profile.role !== "admin") {
        return new Response(
          JSON.stringify({ error: "rider_id is required" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      let query = supabaseClient
        .from("rider_bundles")
        .select(`
          *,
          rider_bundle_orders (
            order_id,
            orders (
              id,
              order_number,
              cod_amount,
              collected_amount
            )
          )
        `)
        .eq("rider_id", queryRiderId);

      if (status) {
        query = query.eq("status", status);
      }

      query = query.order("created_at", { ascending: false });

      const { data: bundles, error: bundlesError } = await query;

      if (bundlesError) {
        throw bundlesError;
      }

      return new Response(
        JSON.stringify({ success: true, bundles }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Route: GET /:bundleId (get bundle detail)
    if (req.method === "GET" && path.startsWith("/") && path !== "/") {
      const bundleId = path.replace("/", "");

      const { data: bundle, error: bundleError } = await supabaseClient
        .from("rider_bundles")
        .select(`
          *,
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
        `)
        .eq("id", bundleId)
        .single();

      if (bundleError) {
        if (bundleError.code === "PGRST116") {
          return new Response(
            JSON.stringify({ error: "Bundle not found" }),
            {
              status: 404,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }
        throw bundleError;
      }

      // Check permissions
      if (
        profile.role !== "admin" &&
        profile.role !== "finance" &&
        (profile.role !== "rider" || bundle.rider_id !== profile.rider_id) &&
        (profile.role !== "asm" || bundle.asm_id !== profile.asm_id)
      ) {
        return new Response(
          JSON.stringify({ error: "Insufficient permissions" }),
          {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      return new Response(
        JSON.stringify({ success: true, bundle }),
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
