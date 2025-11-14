import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface AcceptBundleRequest {
  bundle_id: string;
  validation_status: "ACCEPTED" | "REJECTED";
  actual_denominations?: Record<string, number>;
  comments?: string;
}

interface CreateSuperBundleRequest {
  rider_bundle_ids: string[];
  denomination_breakdown: Record<string, number>;
  digital_signoff: boolean;
  sm_id?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        ...corsHeaders,
        "Access-Control-Allow-Methods": "POST, OPTIONS",
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
      .select("role, asm_id, asm_name, sm_id")
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
    if (path.includes("/asm-bundle-actions/")) {
      path = "/" + path.split("/asm-bundle-actions/")[1];
    } else if (path.startsWith("/asm-bundle-actions")) {
      path = path.replace("/asm-bundle-actions", "");
    }
    if (!path.startsWith("/")) {
      path = "/" + path;
    }

    // Route: POST /accept (accept/reject bundle)
    if (req.method === "POST" && path === "/accept") {
      if (profile.role !== "asm" && profile.role !== "admin") {
        return new Response(
          JSON.stringify({ error: "Only ASMs can accept/reject bundles" }),
          {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const data: AcceptBundleRequest = await req.json();

      if (!data.bundle_id || !data.validation_status) {
        return new Response(
          JSON.stringify({ error: "bundle_id and validation_status are required" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Get bundle
      const { data: bundle, error: bundleError } = await supabaseClient
        .from("rider_bundles")
        .select("*")
        .eq("id", data.bundle_id)
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

      // Check permissions
      if (profile.role === "asm" && bundle.asm_id !== profile.asm_id) {
        return new Response(
          JSON.stringify({ error: "Bundle is not assigned to this ASM" }),
          {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      if (bundle.status !== "READY_FOR_HANDOVER") {
        return new Response(
          JSON.stringify({ error: `Bundle must be in READY_FOR_HANDOVER status, current: ${bundle.status}` }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Validate actual denominations if provided
      let validatedAmount = bundle.expected_amount;
      if (data.actual_denominations && Object.keys(data.actual_denominations).length > 0) {
        let calculatedAmount = 0;
        for (const [denomination, count] of Object.entries(data.actual_denominations)) {
          calculatedAmount += parseFloat(denomination) * count;
        }
        validatedAmount = calculatedAmount;
      }

      // Update bundle status
      const updateData: any = {
        status: data.validation_status === "ACCEPTED" ? "HANDEDOVER_TO_ASM" : "REJECTED",
        updated_at: new Date().toISOString(),
      };

      if (data.validation_status === "ACCEPTED") {
        updateData.handedover_at = new Date().toISOString();
        if (data.actual_denominations) {
          updateData.validated_amount = validatedAmount;
        }
      } else {
        updateData.rejected_at = new Date().toISOString();
        updateData.rejection_reason = data.comments || "Rejected by ASM";
      }

      const { data: updatedBundle, error: updateError } = await supabaseClient
        .from("rider_bundles")
        .update(updateData)
        .eq("id", data.bundle_id)
        .select()
        .single();

      if (updateError) {
        throw updateError;
      }

      // Update orders if accepted
      if (data.validation_status === "ACCEPTED") {
        const { error: ordersError } = await supabaseClient
          .from("orders")
          .update({
            money_state: "HANDOVER_TO_ASM",
            asm_id: bundle.asm_id,
            asm_name: profile.asm_name || `ASM ${bundle.asm_id}`,
            asm_validation_status: "ACCEPTED",
            asm_comments: data.comments || null,
            handover_to_asm_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .in("id", (
            await supabaseClient
              .from("rider_bundle_orders")
              .select("order_id")
              .eq("bundle_id", data.bundle_id)
          ).data?.map((r) => r.order_id) || []);

        if (ordersError) {
          console.error("Error updating orders:", ordersError);
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          bundle: updatedBundle,
          validated_amount: validatedAmount,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Route: POST /superbundle (create superbundle)
    if (req.method === "POST" && path === "/superbundle") {
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

      if (!data.rider_bundle_ids || data.rider_bundle_ids.length === 0) {
        return new Response(
          JSON.stringify({ error: "At least one rider_bundle_id is required" }),
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

      // Get bundles
      const { data: bundles, error: bundlesError } = await supabaseClient
        .from("rider_bundles")
        .select("*")
        .in("id", data.rider_bundle_ids)
        .eq("status", "HANDEDOVER_TO_ASM");

      if (bundlesError) {
        throw bundlesError;
      }

      if (!bundles || bundles.length === 0) {
        return new Response(
          JSON.stringify({ error: "No valid bundles found (must be HANDEDOVER_TO_ASM)" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Check if all bundles belong to ASM (unless admin)
      if (profile.role === "asm") {
        const invalidBundles = bundles.filter((b) => b.asm_id !== profile.asm_id);
        if (invalidBundles.length > 0) {
          return new Response(
            JSON.stringify({
              error: "Some bundles are not assigned to this ASM",
              invalid_bundles: invalidBundles.map((b) => b.id),
            }),
            {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }
      }

      // Calculate expected amount from bundles
      const expectedAmount = bundles.reduce(
        (sum, b) => sum + parseFloat(String(b.validated_amount || b.expected_amount)),
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

      // Create superbundle
      const asmId = profile.role === "admin" ? (data as any).asm_id || profile.asm_id : profile.asm_id;
      const asmName = profile.asm_name || `ASM ${asmId}`;

      const { data: superbundle, error: superbundleError } = await supabaseClient
        .from("asm_superbundles")
        .insert({
          asm_id: asmId,
          asm_name: asmName,
          sm_id: data.sm_id || null,
          expected_amount: expectedAmount,
          denomination_breakdown: data.denomination_breakdown,
          digital_signoff: data.digital_signoff,
          status: "CREATED",
        })
        .select()
        .single();

      if (superbundleError) {
        throw superbundleError;
      }

      // Create superbundle-bundle mappings
      const superbundleBundles = data.rider_bundle_ids.map((bundleId) => ({
        superbundle_id: superbundle.id,
        bundle_id: bundleId,
      }));

      const { error: mappingError } = await supabaseClient
        .from("asm_superbundle_bundles")
        .insert(superbundleBundles);

      if (mappingError) {
        // Rollback superbundle creation
        await supabaseClient.from("asm_superbundles").delete().eq("id", superbundle.id);
        throw mappingError;
      }

      // Trigger will update bundle statuses to INCLUDED_IN_SUPERBUNDLE
      return new Response(
        JSON.stringify({
          superbundle_id: superbundle.id,
          expected_amount: expectedAmount,
          validated_amount: calculatedAmount,
          status: superbundle.status,
        }),
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
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
