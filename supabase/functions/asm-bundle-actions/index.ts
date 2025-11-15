import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface AcceptBundleRequest {
  bundle_id: string;
  denomination_breakdown: {
    [denomination: string]: number; // e.g., { "2000": 5, "500": 10, "100": 20 }
  };
  action_id?: string; // For idempotency
}

interface RejectBundleRequest {
  bundle_id: string;
  rejection_reason: string;
  action_id?: string; // For idempotency
}

interface RequestJustificationRequest {
  order_id: string;
  justification_request_reason?: string;
}

interface CreateSuperBundleRequest {
  bundle_ids: string[];
  denomination_breakdown: {
    [denomination: string]: number;
  };
  asm_id: string;
  action_id?: string; // For idempotency
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
    // Extract path after /functions/v1/asm-bundle-actions
    let path = url.pathname;
    if (path.includes("/asm-bundle-actions/")) {
      path = "/" + path.split("/asm-bundle-actions/")[1];
    } else if (path.startsWith("/asm-bundle-actions")) {
      path = path.replace("/asm-bundle-actions", "");
    }
    
    // Ensure path starts with /
    if (!path.startsWith("/")) {
      path = "/" + path;
    }

    // Route: POST /:bundle_id/accept
    if (req.method === "POST" && path.match(/^\/[^\/]+\/accept$/)) {
      if (profile.role !== "asm" && profile.role !== "admin") {
        return new Response(
          JSON.stringify({ error: "Only ASMs can accept bundles" }),
          {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const bundleId = path.split("/")[1];
      const data: AcceptBundleRequest = await req.json();

      if (!bundleId || bundleId !== data.bundle_id) {
        return new Response(
          JSON.stringify({ error: "Bundle ID mismatch" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Check idempotency
      const actionId = data.action_id || `accept-${bundleId}-${Date.now()}`;
      const { data: existingAction } = await supabaseClient
        .from("audit_logs")
        .select("id")
        .eq("resource_type", "rider_bundle")
        .eq("resource_id", bundleId)
        .eq("action", "BUNDLE_ACCEPTED")
        .eq("metadata->>action_id", actionId)
        .single();

      if (existingAction) {
        // Idempotent - return existing result
        const { data: bundle } = await supabaseClient
          .from("rider_bundles")
          .select("*")
          .eq("id", bundleId)
          .single();

        return new Response(
          JSON.stringify({ 
            success: true, 
            bundle,
            message: "Bundle already accepted (idempotent)" 
          }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Get bundle details
      const { data: bundle, error: bundleError } = await supabaseClient
        .from("rider_bundles")
        .select("*")
        .eq("id", bundleId)
        .single();

      if (bundleError || !bundle) {
        return new Response(
          JSON.stringify({ error: "Bundle not found" }),
          {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Verify bundle is in correct status
      if (bundle.status !== "READY_FOR_HANDOVER") {
        return new Response(
          JSON.stringify({ 
            error: `Bundle must be in READY_FOR_HANDOVER status. Current status: ${bundle.status}` 
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Verify bundle belongs to ASM (if ASM role, not admin)
      if (profile.role === "asm" && bundle.asm_id !== profile.asm_id) {
        return new Response(
          JSON.stringify({ error: "Bundle does not belong to this ASM" }),
          {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Validate denomination breakdown matches expected amount
      const denominationTotal = Object.entries(data.denomination_breakdown).reduce(
        (sum, [denomination, count]) => sum + (parseFloat(denomination) * count),
        0
      );

      const expectedAmount = parseFloat(bundle.expected_amount || "0");
      const tolerance = 0.01; // Allow small floating point differences

      if (Math.abs(denominationTotal - expectedAmount) > tolerance) {
        return new Response(
          JSON.stringify({ 
            error: `Denomination breakdown (${denominationTotal}) does not match expected amount (${expectedAmount})` 
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Update bundle status to HANDEDOVER_TO_ASM
      const { data: updatedBundle, error: updateError } = await supabaseClient
        .from("rider_bundles")
        .update({
          status: "HANDEDOVER_TO_ASM",
          asm_validated_denomination_breakdown: data.denomination_breakdown,
          asm_validated_at: new Date().toISOString(),
          asm_validated_by: user.id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", bundleId)
        .select()
        .single();

      if (updateError) {
        throw updateError;
      }

      // Update orders to HANDOVER_TO_ASM state
      // This should be handled by triggers, but we'll also update directly
      const { data: bundleOrders } = await supabaseClient
        .from("orders")
        .select("id")
        .eq("bundle_id", bundleId);

      if (bundleOrders && bundleOrders.length > 0) {
        const orderIds = bundleOrders.map((o) => o.id);
        
        // Create ASM events for each order
        const asmEvents = bundleOrders.map((order) => ({
          order_id: order.id,
          asm_id: profile.asm_id || bundle.asm_id,
          asm_name: profile.full_name || "ASM",
          event_type: "HANDOVER_TO_ASM",
          amount: bundle.expected_amount,
          notes: `Bundle ${bundleId} accepted by ASM`,
          metadata: {
            bundle_id: bundleId,
            action_id: actionId,
            denomination_breakdown: data.denomination_breakdown,
          },
        }));

        const { error: eventError } = await supabaseClient
          .from("asm_events")
          .insert(asmEvents);

        if (eventError) {
          console.error("Error creating ASM events:", eventError);
          // Don't fail the request, but log the error
        }
      }

      // Create audit log entry
      await supabaseClient.rpc("log_audit_event", {
        p_action: "BUNDLE_ACCEPTED",
        p_resource_type: "rider_bundle",
        p_resource_id: bundleId,
        p_user_id: user.id,
        p_new_values: {
          ...updatedBundle,
          action_id: actionId,
          denomination_breakdown: data.denomination_breakdown,
        },
      });

      return new Response(
        JSON.stringify({ success: true, bundle: updatedBundle }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Route: POST /:bundle_id/reject
    if (req.method === "POST" && path.match(/^\/[^\/]+\/reject$/)) {
      if (profile.role !== "asm" && profile.role !== "admin") {
        return new Response(
          JSON.stringify({ error: "Only ASMs can reject bundles" }),
          {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const bundleId = path.split("/")[1];
      const data: RejectBundleRequest = await req.json();

      if (!bundleId || bundleId !== data.bundle_id) {
        return new Response(
          JSON.stringify({ error: "Bundle ID mismatch" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      if (!data.rejection_reason || data.rejection_reason.trim().length === 0) {
        return new Response(
          JSON.stringify({ error: "Rejection reason is required" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Check idempotency
      const actionId = data.action_id || `reject-${bundleId}-${Date.now()}`;
      const { data: existingAction } = await supabaseClient
        .from("audit_logs")
        .select("id")
        .eq("resource_type", "rider_bundle")
        .eq("resource_id", bundleId)
        .eq("action", "BUNDLE_REJECTED")
        .eq("metadata->>action_id", actionId)
        .single();

      if (existingAction) {
        const { data: bundle } = await supabaseClient
          .from("rider_bundles")
          .select("*")
          .eq("id", bundleId)
          .single();

        return new Response(
          JSON.stringify({ 
            success: true, 
            bundle,
            message: "Bundle already rejected (idempotent)" 
          }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Get bundle details
      const { data: bundle, error: bundleError } = await supabaseClient
        .from("rider_bundles")
        .select("*")
        .eq("id", bundleId)
        .single();

      if (bundleError || !bundle) {
        return new Response(
          JSON.stringify({ error: "Bundle not found" }),
          {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Verify bundle is in correct status
      if (bundle.status !== "READY_FOR_HANDOVER") {
        return new Response(
          JSON.stringify({ 
            error: `Bundle must be in READY_FOR_HANDOVER status. Current status: ${bundle.status}` 
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Verify bundle belongs to ASM
      if (profile.role === "asm" && bundle.asm_id !== profile.asm_id) {
        return new Response(
          JSON.stringify({ error: "Bundle does not belong to this ASM" }),
          {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Update bundle status to REJECTED
      const { data: updatedBundle, error: updateError } = await supabaseClient
        .from("rider_bundles")
        .update({
          status: "REJECTED",
          rejection_reason: data.rejection_reason,
          rejected_at: new Date().toISOString(),
          rejected_by: user.id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", bundleId)
        .select()
        .single();

      if (updateError) {
        throw updateError;
      }

      // Update orders back to BUNDLED state (they can be re-bundled)
      const { data: bundleOrders } = await supabaseClient
        .from("orders")
        .select("id")
        .eq("bundle_id", bundleId);

      if (bundleOrders && bundleOrders.length > 0) {
        const orderIds = bundleOrders.map((o) => o.id);
        
        // Update orders to BUNDLED state (not COLLECTED_BY_RIDER, as they're still bundled)
        // The trigger should handle this, but we ensure it here
        const { error: orderUpdateError } = await supabaseClient
          .from("orders")
          .update({
            money_state: "BUNDLED",
            updated_at: new Date().toISOString(),
          })
          .in("id", orderIds);

        if (orderUpdateError) {
          console.error("Error updating orders:", orderUpdateError);
        }
      }

      // Create audit log entry
      await supabaseClient.rpc("log_audit_event", {
        p_action: "BUNDLE_REJECTED",
        p_resource_type: "rider_bundle",
        p_resource_id: bundleId,
        p_user_id: user.id,
        p_new_values: {
          ...updatedBundle,
          action_id: actionId,
          rejection_reason: data.rejection_reason,
        },
      });

      return new Response(
        JSON.stringify({ success: true, bundle: updatedBundle }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Route: POST /:order_id/request-justification
    if (req.method === "POST" && path.match(/^\/[^\/]+\/request-justification$/)) {
      if (profile.role !== "asm" && profile.role !== "admin") {
        return new Response(
          JSON.stringify({ error: "Only ASMs can request justification" }),
          {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const orderId = path.split("/")[1];
      const data: RequestJustificationRequest = await req.json();

      if (!orderId || orderId !== data.order_id) {
        return new Response(
          JSON.stringify({ error: "Order ID mismatch" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Get order details
      const { data: order, error: orderError } = await supabaseClient
        .from("orders")
        .select("*")
        .eq("id", orderId)
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

      // Verify order is unbundled (bundle_id IS NULL) and in COLLECTED_BY_RIDER state
      if (order.bundle_id !== null) {
        return new Response(
          JSON.stringify({ error: "Order is already bundled" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      if (order.money_state !== "COLLECTED_BY_RIDER") {
        return new Response(
          JSON.stringify({ 
            error: `Order must be in COLLECTED_BY_RIDER state. Current state: ${order.money_state}` 
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Verify order belongs to ASM
      if (profile.role === "asm" && order.asm_id !== profile.asm_id) {
        return new Response(
          JSON.stringify({ error: "Order does not belong to this ASM" }),
          {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Create justification request record
      // Assuming there's a table for this, or we store it in order metadata
      const justificationData = {
        order_id: orderId,
        requested_by: user.id,
        requested_at: new Date().toISOString(),
        reason: data.justification_request_reason || "ASM requested justification for unbundled order",
        status: "PENDING",
      };

      // Store in order metadata or create a separate table entry
      const { error: updateError } = await supabaseClient
        .from("orders")
        .update({
          metadata: {
            ...(order.metadata || {}),
            justification_request: justificationData,
          },
          updated_at: new Date().toISOString(),
        })
        .eq("id", orderId);

      if (updateError) {
        throw updateError;
      }

      // Create audit log entry
      await supabaseClient.rpc("log_audit_event", {
        p_action: "JUSTIFICATION_REQUESTED",
        p_resource_type: "order",
        p_resource_id: orderId,
        p_user_id: user.id,
        p_new_values: justificationData,
      });

      // Notify rider via realtime (if realtime is set up)
      // For now, we'll just log it

      return new Response(
        JSON.stringify({ 
          success: true, 
          justification_request: justificationData 
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Route: POST /superbundles
    if (req.method === "POST" && path === "/superbundles") {
      if (profile.role !== "asm" && profile.role !== "admin") {
        return new Response(
          JSON.stringify({ error: "Only ASMs can create superbundles" }),
          {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const data: CreateSuperBundleRequest = await req.json();

      if (!data.bundle_ids || data.bundle_ids.length === 0) {
        return new Response(
          JSON.stringify({ error: "At least one bundle_id is required" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      if (!data.denomination_breakdown || Object.keys(data.denomination_breakdown).length === 0) {
        return new Response(
          JSON.stringify({ error: "Denomination breakdown is required" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const asmId = data.asm_id || profile.asm_id;
      if (!asmId) {
        return new Response(
          JSON.stringify({ error: "ASM ID is required" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Check idempotency
      const actionId = data.action_id || `superbundle-${Date.now()}`;
      const { data: existingSuperBundle } = await supabaseClient
        .from("asm_superbundles")
        .select("id")
        .eq("asm_id", asmId)
        .eq("metadata->>action_id", actionId)
        .single();

      if (existingSuperBundle) {
        const { data: superbundle } = await supabaseClient
          .from("asm_superbundles")
          .select("*, asm_superbundle_bundles(*)")
          .eq("id", existingSuperBundle.id)
          .single();

        return new Response(
          JSON.stringify({ 
            success: true, 
            superbundle,
            message: "SuperBundle already created (idempotent)" 
          }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Validate all bundles exist and are in HANDEDOVER_TO_ASM status
      const { data: bundles, error: bundlesError } = await supabaseClient
        .from("rider_bundles")
        .select("*")
        .in("id", data.bundle_ids);

      if (bundlesError) {
        throw bundlesError;
      }

      if (!bundles || bundles.length !== data.bundle_ids.length) {
        return new Response(
          JSON.stringify({ error: "One or more bundles not found" }),
          {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Validate all bundles are in HANDEDOVER_TO_ASM status
      const invalidBundles = bundles.filter(
        (b) => b.status !== "HANDEDOVER_TO_ASM"
      );
      if (invalidBundles.length > 0) {
        return new Response(
          JSON.stringify({ 
            error: `Bundles must be in HANDEDOVER_TO_ASM status. Invalid bundles: ${invalidBundles.map(b => b.id).join(", ")}` 
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Validate all bundles belong to same ASM
      const differentAsmBundles = bundles.filter(
        (b) => b.asm_id !== asmId
      );
      if (differentAsmBundles.length > 0) {
        return new Response(
          JSON.stringify({ 
            error: `All bundles must belong to the same ASM. Invalid bundles: ${differentAsmBundles.map(b => b.id).join(", ")}` 
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Calculate expected amount from bundles
      const expectedAmount = bundles.reduce(
        (sum, b) => sum + parseFloat(b.expected_amount || "0"),
        0
      );

      // Validate denomination breakdown matches expected amount
      const denominationTotal = Object.entries(data.denomination_breakdown).reduce(
        (sum, [denomination, count]) => sum + (parseFloat(denomination) * count),
        0
      );

      const tolerance = 0.01;
      if (Math.abs(denominationTotal - expectedAmount) > tolerance) {
        return new Response(
          JSON.stringify({ 
            error: `Denomination breakdown (${denominationTotal}) does not match expected amount (${expectedAmount})` 
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Create superbundle
      const superbundleNumber = `SB-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const { data: superbundle, error: superbundleError } = await supabaseClient
        .from("asm_superbundles")
        .insert({
          superbundle_number: superbundleNumber,
          asm_id: asmId,
          expected_amount: expectedAmount,
          denomination_breakdown: data.denomination_breakdown,
          status: "CREATED",
          created_by: user.id,
          metadata: {
            action_id: actionId,
            bundle_count: bundles.length,
          },
        })
        .select()
        .single();

      if (superbundleError) {
        throw superbundleError;
      }

      // Link bundles via asm_superbundle_bundles table
      const superbundleBundles = data.bundle_ids.map((bundleId) => ({
        superbundle_id: superbundle.id,
        bundle_id: bundleId,
      }));

      const { error: linkError } = await supabaseClient
        .from("asm_superbundle_bundles")
        .insert(superbundleBundles);

      if (linkError) {
        throw linkError;
      }

      // Update bundle statuses to INCLUDED_IN_SUPERBUNDLE
      // This should be handled by triggers, but we'll update directly
      const { error: bundleUpdateError } = await supabaseClient
        .from("rider_bundles")
        .update({
          status: "INCLUDED_IN_SUPERBUNDLE",
          updated_at: new Date().toISOString(),
        })
        .in("id", data.bundle_ids);

      if (bundleUpdateError) {
        console.error("Error updating bundle statuses:", bundleUpdateError);
      }

      // Update orders to INCLUDED_IN_SUPERBUNDLE state
      // Get all orders from these bundles
      const { data: allOrders } = await supabaseClient
        .from("orders")
        .select("id")
        .in("bundle_id", data.bundle_ids);

      if (allOrders && allOrders.length > 0) {
        const orderIds = allOrders.map((o) => o.id);
        
        // Update orders state (triggers should handle this, but we ensure it)
        const { error: orderUpdateError } = await supabaseClient
          .from("orders")
          .update({
            money_state: "INCLUDED_IN_SUPERBUNDLE",
            updated_at: new Date().toISOString(),
          })
          .in("id", orderIds);

        if (orderUpdateError) {
          console.error("Error updating orders:", orderUpdateError);
        }
      }

      // Create audit log entry
      await supabaseClient.rpc("log_audit_event", {
        p_action: "SUPERBUNDLE_CREATED",
        p_resource_type: "asm_superbundle",
        p_resource_id: superbundle.id,
        p_user_id: user.id,
        p_new_values: {
          ...superbundle,
          bundle_ids: data.bundle_ids,
        },
      });

      // Fetch complete superbundle with bundles
      const { data: completeSuperBundle } = await supabaseClient
        .from("asm_superbundles")
        .select("*, asm_superbundle_bundles(*)")
        .eq("id", superbundle.id)
        .single();

      return new Response(
        JSON.stringify({ success: true, superbundle: completeSuperBundle }),
        {
          status: 201,
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
    console.error("Error in asm-bundle-actions:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
