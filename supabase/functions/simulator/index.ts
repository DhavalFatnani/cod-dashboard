import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface SimulatorStartRequest {
  count: number;
  rate_per_min?: number;
  mix?: {
    cod_hard?: number;
    cod_qr?: number;
    prepaid?: number;
  };
  rider_pool?: string[];
  asm_pool?: string[];
  test_tag?: string;
}

interface SimulatorBulkProcessRequest {
  test_tag: string;
  action: "collect" | "handover" | "deposit" | "reconcile" | "create-bundles";
  batch_size?: number;
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

    const url = new URL(req.url);
    // Extract path - handle both /functions/v1/simulator/{path} and direct {path}
    const pathParts = url.pathname.split("/").filter(p => p);
    const path = pathParts[pathParts.length - 1] || "";
    
    // Debug logging
    console.log("Request URL:", req.url);
    console.log("Pathname:", url.pathname);
    console.log("Extracted path:", path);

    // Check admin authorization
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if user is admin
    const { data: userData } = await supabaseClient
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single();

    if (userData?.role !== "admin") {
      return new Response(JSON.stringify({ error: "Forbidden: Admin only" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Route handlers
    if (path === "status") {
      const { data: flags, error: statusError } = await supabaseClient
        .from("feature_flags")
        .select("*")
        .eq("flag_key", "simulator_status")
        .single();

      console.log("Status query result:", { flags, error: statusError });

      return new Response(
        JSON.stringify({
          status: flags?.flag_value?.running || false,
          test_tag: flags?.flag_value?.test_tag || null,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (path === "start") {
      const body: SimulatorStartRequest = await req.json();
      const {
        count,
        mix = { cod_hard: 0.6, cod_qr: 0.3, prepaid: 0.1 },
        rider_pool = ["RIDER-001", "RIDER-002", "RIDER-003"],
        asm_pool = ["ASM-001", "ASM-002"],
        test_tag = `test-${Date.now()}`,
      } = body;

      // Update simulator status
      await supabaseClient.from("feature_flags").upsert({
        flag_key: "simulator_status",
        flag_value: {
          running: true,
          test_tag,
          started_at: new Date().toISOString(),
        },
      });

      // Generate orders
      const orders = [];
      const stores = ["STORE-001", "STORE-002", "STORE-003"];
      const customers = ["Customer A", "Customer B", "Customer C"];

      for (let i = 0; i < count; i++) {
        const rand = Math.random();
        let paymentType: "COD" | "PREPAID";
        let codType: "COD_HARD" | "COD_QR" | null = null;

        if (rand < mix.cod_hard!) {
          paymentType = "COD";
          codType = "COD_HARD";
        } else if (rand < mix.cod_hard! + mix.cod_qr!) {
          paymentType = "COD";
          codType = "COD_QR";
        } else {
          paymentType = "PREPAID";
        }

        const orderAmount = Math.floor(Math.random() * 5000) + 100;
        const orderNumber = `ORD-${test_tag}-${i + 1}`;

        orders.push({
          order_number: orderNumber,
          store_id: stores[Math.floor(Math.random() * stores.length)],
          store_name: `Store ${stores[Math.floor(Math.random() * stores.length)]}`,
          customer_name: customers[Math.floor(Math.random() * customers.length)],
          customer_phone: `+91${Math.floor(Math.random() * 9000000000) + 1000000000}`,
          payment_type: paymentType,
          cod_type: codType,
          order_amount: orderAmount,
          cod_amount: paymentType === "COD" ? orderAmount : 0,
          money_state: paymentType === "COD" ? "UNCOLLECTED" : "NOT_APPLICABLE",
          is_test: true,
          test_tag,
          wms_created_at: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
          metadata: { simulator: true },
        });
      }

      // Batch insert orders
      const batchSize = 100;
      let inserted = 0;
      for (let i = 0; i < orders.length; i += batchSize) {
        const batch = orders.slice(i, i + batchSize);
        const { error } = await supabaseClient.from("orders").insert(batch);
        if (error) throw error;
        inserted += batch.length;
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: `Created ${inserted} test orders`,
          test_tag,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (path === "bulk-process") {
      const body: SimulatorBulkProcessRequest = await req.json();
      const { test_tag, action, batch_size = 100 } = body;

      // Get orders for this test tag
      const { data: orders } = await supabaseClient
        .from("orders")
        .select("*")
        .eq("test_tag", test_tag)
        .eq("is_test", true)
        .limit(batch_size);

      if (!orders || orders.length === 0) {
        return new Response(
          JSON.stringify({ error: "No orders found for test tag" }),
          {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const rider_pool = ["RIDER-001", "RIDER-002", "RIDER-003"];
      const asm_pool = ["ASM-001", "ASM-002"];

      if (action === "collect") {
        // Create rider collection events
        const events = orders
          .filter((o) => o.payment_type === "COD" && o.money_state === "UNCOLLECTED")
          .map((order) => ({
            order_id: order.id,
            rider_id: rider_pool[Math.floor(Math.random() * rider_pool.length)],
            rider_name: `Rider ${rider_pool[Math.floor(Math.random() * rider_pool.length)]}`,
            event_type: "COLLECTED" as const,
            amount: order.cod_amount,
            metadata: { simulator: true, test_tag },
          }));

        if (events.length > 0) {
          await supabaseClient.from("rider_events").insert(events);
        }

        return new Response(
          JSON.stringify({
            success: true,
            processed: events.length,
            action: "collect",
          }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      if (action === "handover") {
        // Create ASM handover events
        const events = orders
          .filter(
            (o) =>
              o.payment_type === "COD" &&
              o.money_state === "COLLECTED_BY_RIDER"
          )
          .map((order) => ({
            order_id: order.id,
            asm_id: asm_pool[Math.floor(Math.random() * asm_pool.length)],
            asm_name: `ASM ${asm_pool[Math.floor(Math.random() * asm_pool.length)]}`,
            event_type: "HANDOVER_TO_ASM" as const,
            amount: order.cod_amount,
            metadata: { simulator: true, test_tag },
          }));

        if (events.length > 0) {
          await supabaseClient.from("asm_events").insert(events);
        }

        return new Response(
          JSON.stringify({
            success: true,
            processed: events.length,
            action: "handover",
          }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      if (action === "create-bundles") {
        // Create bundles for collected orders
        const collectedOrders = orders.filter(
          (o) =>
            o.payment_type === "COD" &&
            o.cod_type !== "RTO" &&
            o.money_state === "COLLECTED_BY_RIDER" &&
            !o.bundle_id
        );

        if (collectedOrders.length === 0) {
          return new Response(
            JSON.stringify({
              success: true,
              processed: 0,
              action: "create-bundles",
              message: "No orders available for bundling",
            }),
            {
              status: 200,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }

        // Group orders by rider
        const ordersByRider = collectedOrders.reduce((acc, order) => {
          const riderId = order.rider_id || rider_pool[0];
          if (!acc[riderId]) acc[riderId] = [];
          acc[riderId].push(order);
          return acc;
        }, {} as Record<string, typeof collectedOrders>);

        let bundlesCreated = 0;
        const bundleSize = batch_size || 20; // Default 20 orders per bundle

        for (const [riderId, riderOrders] of Object.entries(ordersByRider)) {
          // Process orders in batches
          for (let i = 0; i < riderOrders.length; i += bundleSize) {
            const batch = riderOrders.slice(i, i + bundleSize);
            const totalAmount = batch.reduce(
              (sum, o) => sum + Number(o.collected_amount || o.cod_amount || 0),
              0
            );

            // Generate denomination breakdown (simplified for testing)
            const denominationBreakdown: Record<string, number> = {};
            let remaining = totalAmount;
            
            // Use common denominations
            const denominations = [2000, 500, 200, 100, 50, 20, 10, 5, 2, 1];
            for (const denom of denominations) {
              if (remaining >= denom) {
                const count = Math.floor(remaining / denom);
                if (count > 0) {
                  denominationBreakdown[denom.toString()] = count;
                  remaining = remaining % denom;
                }
              }
            }

            // Create bundle
            const { data: bundle, error: bundleError } = await supabaseClient
              .from("rider_bundles")
              .insert({
                rider_id: riderId,
                rider_name: `Rider ${riderId}`,
                asm_id: asm_pool[Math.floor(Math.random() * asm_pool.length)],
                expected_amount: totalAmount,
                denomination_breakdown: denominationBreakdown,
                status: "CREATED",
                digital_signoff: true,
                metadata: { simulator: true, test_tag },
              })
              .select()
              .single();

            if (bundleError || !bundle) {
              console.error("Bundle creation error:", bundleError);
              continue;
            }

            // Link orders to bundle
            const bundleOrders = batch.map((order) => ({
              bundle_id: bundle.id,
              order_id: order.id,
            }));

            await supabaseClient.from("rider_bundle_orders").insert(bundleOrders);

            // Update orders to BUNDLED state
            await supabaseClient
              .from("orders")
              .update({
                bundle_id: bundle.id,
                money_state: "BUNDLED",
                updated_at: new Date().toISOString(),
              })
              .in(
                "id",
                batch.map((o) => o.id)
              );

            // Mark bundle as READY_FOR_HANDOVER
            await supabaseClient
              .from("rider_bundles")
              .update({
                status: "READY_FOR_HANDOVER",
                sealed_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              })
              .eq("id", bundle.id);

            // Update orders to READY_FOR_HANDOVER
            await supabaseClient
              .from("orders")
              .update({
                money_state: "READY_FOR_HANDOVER",
                updated_at: new Date().toISOString(),
              })
              .in(
                "id",
                batch.map((o) => o.id)
              );

            bundlesCreated++;
          }
        }

        return new Response(
          JSON.stringify({
            success: true,
            processed: bundlesCreated,
            action: "create-bundles",
            bundles_created: bundlesCreated,
          }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      if (action === "deposit") {
        // First, handover orders that are COLLECTED_BY_RIDER
        const ordersToHandover = orders.filter(
          (o) =>
            o.payment_type === "COD" &&
            o.money_state === "COLLECTED_BY_RIDER"
        );

        if (ordersToHandover.length > 0) {
          const handoverEvents = ordersToHandover.map((order) => ({
            order_id: order.id,
            asm_id: asm_pool[Math.floor(Math.random() * asm_pool.length)],
            asm_name: `ASM ${asm_pool[Math.floor(Math.random() * asm_pool.length)]}`,
            event_type: "HANDOVER_TO_ASM" as const,
            amount: order.cod_amount,
            metadata: { simulator: true, test_tag },
          }));

          await supabaseClient.from("asm_events").insert(handoverEvents);
        }

        // Refresh orders to get updated states
        const { data: updatedOrders } = await supabaseClient
          .from("orders")
          .select("*")
          .eq("test_tag", test_tag)
          .eq("is_test", true)
          .in("money_state", ["HANDOVER_TO_ASM", "PENDING_TO_DEPOSIT"]);

        if (!updatedOrders || updatedOrders.length === 0) {
          return new Response(
            JSON.stringify({
              success: true,
              processed: 0,
              action: "deposit",
              message: "No orders ready for deposit",
            }),
            {
              status: 200,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }

        // Group by ASM and create deposits
        const ordersByAsm = updatedOrders.reduce((acc, order) => {
          const asmId = order.asm_id || asm_pool[0];
          if (!acc[asmId]) acc[asmId] = [];
          acc[asmId].push(order);
          return acc;
        }, {} as Record<string, typeof updatedOrders>);

        let depositsCreated = 0;
        for (const [asmId, asmOrders] of Object.entries(ordersByAsm)) {
          const totalAmount = asmOrders.reduce(
            (sum, o) => sum + Number(o.cod_amount),
            0
          );
          const depositNumber = `DEP-${test_tag}-${Date.now()}-${depositsCreated}`;

          const { data: deposit } = await supabaseClient
            .from("deposits")
            .insert({
              deposit_number: depositNumber,
              asm_id: asmId,
              asm_name: `ASM ${asmId}`,
              total_amount: totalAmount,
              deposit_date: new Date().toISOString().split("T")[0],
              status: "PENDING",
              metadata: { simulator: true, test_tag },
            })
            .select()
            .single();

          if (deposit) {
            await supabaseClient.from("deposit_orders").insert(
              asmOrders.map((o) => ({
                deposit_id: deposit.id,
                order_id: o.id,
                amount: o.cod_amount,
              }))
            );

            await supabaseClient.from("asm_events").insert(
              asmOrders.map((o) => ({
                order_id: o.id,
                asm_id: asmId,
                asm_name: `ASM ${asmId}`,
                event_type: "DEPOSITED" as const,
                amount: o.cod_amount,
                notes: `Deposited via ${depositNumber}`,
                metadata: { simulator: true, test_tag, deposit_id: deposit.id },
              }))
            );

            depositsCreated++;
          }
        }

        return new Response(
          JSON.stringify({
            success: true,
            processed: depositsCreated,
            action: "deposit",
          }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      return new Response(JSON.stringify({ error: "Invalid action" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (path === "cleanup") {
      const body = await req.json();
      const { test_tag } = body;

      if (!test_tag) {
        return new Response(JSON.stringify({ error: "test_tag required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Delete in correct order (respecting foreign keys)
      const { data: orders } = await supabaseClient
        .from("orders")
        .select("id")
        .eq("test_tag", test_tag)
        .eq("is_test", true);

      if (orders && orders.length > 0) {
        const orderIds = orders.map((o) => o.id);

        // Delete related records
        await supabaseClient
          .from("rider_events")
          .delete()
          .in("order_id", orderIds);

        await supabaseClient
          .from("asm_events")
          .delete()
          .in("order_id", orderIds);

        await supabaseClient
          .from("deposit_orders")
          .delete()
          .in("order_id", orderIds);

        // Delete orders
        await supabaseClient
          .from("orders")
          .delete()
          .eq("test_tag", test_tag)
          .eq("is_test", true);
      }

      // Delete bundles and related data
      const { data: bundles } = await supabaseClient
        .from("rider_bundles")
        .select("id")
        .contains("metadata", { test_tag });

      if (bundles && bundles.length > 0) {
        const bundleIds = bundles.map((b) => b.id);
        await supabaseClient
          .from("rider_bundle_orders")
          .delete()
          .in("bundle_id", bundleIds);
        await supabaseClient.from("rider_bundles").delete().in("id", bundleIds);
      }

      // Delete superbundles
      const { data: superbundles } = await supabaseClient
        .from("asm_superbundles")
        .select("id")
        .contains("metadata", { test_tag });

      if (superbundles && superbundles.length > 0) {
        const superbundleIds = superbundles.map((sb) => sb.id);
        await supabaseClient
          .from("asm_superbundle_bundles")
          .delete()
          .in("superbundle_id", superbundleIds);
        await supabaseClient.from("asm_superbundles").delete().in("id", superbundleIds);
      }

      // Delete deposits with test_tag
      const { data: deposits } = await supabaseClient
        .from("deposits")
        .select("id")
        .contains("metadata", { test_tag });

      if (deposits && deposits.length > 0) {
        const depositIds = deposits.map((d) => d.id);
        await supabaseClient
          .from("deposit_orders")
          .delete()
          .in("deposit_id", depositIds);
        await supabaseClient.from("deposits").delete().in("id", depositIds);
      }

      // Update simulator status
      await supabaseClient.from("feature_flags").upsert({
        flag_key: "simulator_status",
        flag_value: {
          running: false,
          test_tag: null,
        },
      });

      return new Response(
        JSON.stringify({
          success: true,
          message: `Cleaned up test data for tag: ${test_tag}`,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (path === "stop") {
      console.log("Stop endpoint called");
      try {
        const { data, error: upsertError } = await supabaseClient.from("feature_flags").upsert({
          flag_key: "simulator_status",
          flag_value: {
            running: false,
            test_tag: null,
          },
        }, {
          onConflict: "flag_key"
        });

        console.log("Upsert result:", { data, error: upsertError });

        if (upsertError) {
          console.error("Upsert error:", upsertError);
          throw upsertError;
        }

        // Verify the update
        const { data: verifyFlags } = await supabaseClient
          .from("feature_flags")
          .select("*")
          .eq("flag_key", "simulator_status")
          .single();
        
        console.log("Verified status:", verifyFlags);

        return new Response(
          JSON.stringify({ 
            success: true, 
            message: "Simulator stopped",
            status: verifyFlags?.flag_value?.running || false
          }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      } catch (error) {
        console.error("Stop error:", error);
        return new Response(
          JSON.stringify({ error: error.message || "Failed to stop simulator" }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
    }

    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
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

