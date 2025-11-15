import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface OrderCollectionData {
  order_id: string;
  collection_status: 'COLLECTED' | 'NOT_COLLECTED';
  non_collection_reason?: string;
  future_collection_date?: string;
}

interface DepositRequest {
  asm_id: string;
  asm_name?: string;
  order_ids?: string[] | OrderCollectionData[]; // Legacy flow
  superbundle_ids?: string[]; // New flow
  total_amount: number;
  expected_amount?: number;
  actual_amount_received?: number;
  deposit_slip_url?: string;
  deposit_date: string;
  bank_account?: string;
  reference_number?: string;
  metadata?: Record<string, any>;
  sm_user_id?: string;
  sm_name?: string;
  asm_handover_data_id?: string;
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

    const depositData: DepositRequest = await req.json();

    // Validate required fields - support both legacy (order_ids) and new (superbundle_ids) flows
    const hasOrderIds = depositData.order_ids && depositData.order_ids.length > 0;
    const hasSuperBundleIds = depositData.superbundle_ids && depositData.superbundle_ids.length > 0;

    if (
      !depositData.asm_id ||
      (!hasOrderIds && !hasSuperBundleIds) ||
      !depositData.total_amount
    ) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: either order_ids or superbundle_ids must be provided" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Cannot use both flows at once
    if (hasOrderIds && hasSuperBundleIds) {
      return new Response(
        JSON.stringify({ error: "Cannot use both order_ids and superbundle_ids. Use one flow or the other." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Generate deposit number
    const depositNumber = `DEP-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Determine validation status
    let validationStatus = 'PENDING';
    if (depositData.expected_amount !== undefined && depositData.actual_amount_received !== undefined) {
      if (Math.abs(depositData.expected_amount - depositData.actual_amount_received) < 0.01) {
        validationStatus = 'VALIDATED';
      } else {
        validationStatus = 'MISMATCH';
      }
    }

    // Start transaction
    const { data: deposit, error: depositError } = await supabaseClient
      .from("deposits")
      .insert({
        deposit_number: depositNumber,
        asm_id: depositData.asm_id,
        asm_name: depositData.asm_name,
        total_amount: depositData.total_amount,
        expected_amount: depositData.expected_amount,
        actual_amount_received: depositData.actual_amount_received,
        validation_status: validationStatus,
        deposit_slip_url: depositData.deposit_slip_url,
        deposit_date: depositData.deposit_date || new Date().toISOString().split("T")[0],
        bank_account: depositData.bank_account,
        status: "PENDING_RECONCILIATION",
        asm_handover_data_id: depositData.asm_handover_data_id,
        metadata: {
          ...depositData.metadata,
          reference_number: depositData.reference_number,
          sm_user_id: depositData.sm_user_id,
          sm_name: depositData.sm_name,
        },
      })
      .select()
      .single();

    if (depositError) {
      throw depositError;
    }

    // Handle two flows: legacy (order_ids) or new (superbundle_ids)
    if (hasSuperBundleIds) {
      // NEW FLOW: SuperBundle-based deposits
      // Validate superbundles are in READY_FOR_HANDOVER status
      const { data: superbundles, error: superbundlesError } = await supabaseClient
        .from("asm_superbundles")
        .select("*")
        .in("id", depositData.superbundle_ids!);

      if (superbundlesError) {
        throw superbundlesError;
      }

      if (!superbundles || superbundles.length !== depositData.superbundle_ids!.length) {
        return new Response(
          JSON.stringify({ error: "One or more superbundles not found" }),
          {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Validate all superbundles are in READY_FOR_HANDOVER status
      const invalidSuperbundles = superbundles.filter(
        (sb) => sb.status !== "READY_FOR_HANDOVER"
      );
      if (invalidSuperbundles.length > 0) {
        return new Response(
          JSON.stringify({ 
            error: `Superbundles must be in READY_FOR_HANDOVER status. Invalid superbundles: ${invalidSuperbundles.map(sb => sb.superbundle_number || sb.id).join(", ")}` 
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Verify deposit amount matches superbundle amount
      const superbundleTotal = superbundles.reduce(
        (sum, sb) => sum + parseFloat(sb.expected_amount || "0"),
        0
      );
      const tolerance = 0.01;
      if (Math.abs(depositData.total_amount - superbundleTotal) > tolerance) {
        return new Response(
          JSON.stringify({ 
            error: `Deposit amount (${depositData.total_amount}) does not match superbundle total (${superbundleTotal})` 
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Link deposit to superbundles via asm_superbundles.deposit_id
      const { error: superbundleUpdateError } = await supabaseClient
        .from("asm_superbundles")
        .update({
          deposit_id: deposit.id,
          status: "INCLUDED_IN_DEPOSIT",
          updated_at: new Date().toISOString(),
        })
        .in("id", depositData.superbundle_ids!);

      if (superbundleUpdateError) {
        throw superbundleUpdateError;
      }

      // Get all orders from bundles in these superbundles
      const { data: superbundleBundles } = await supabaseClient
        .from("asm_superbundle_bundles")
        .select("bundle_id")
        .in("superbundle_id", depositData.superbundle_ids!);

      if (superbundleBundles && superbundleBundles.length > 0) {
        const bundleIds = superbundleBundles.map((sb) => sb.bundle_id);
        
        // Get all orders from these bundles
        const { data: allOrders } = await supabaseClient
          .from("orders")
          .select("id, cod_amount")
          .in("bundle_id", bundleIds);

        if (allOrders && allOrders.length > 0) {
          // Create deposit_orders entries
          const depositOrderInserts = allOrders.map((order) => ({
            deposit_id: deposit.id,
            order_id: order.id,
            amount: order.cod_amount,
            collection_status: 'COLLECTED',
            asm_handover_data_id: depositData.asm_handover_data_id || null,
          }));

          const { error: doError } = await supabaseClient
            .from("deposit_orders")
            .insert(depositOrderInserts);

          if (doError) {
            throw doError;
          }

          // Create ASM events for DEPOSITED state
          const asmEventInserts = allOrders.map((order) => ({
            order_id: order.id,
            asm_id: depositData.asm_id,
            asm_name: depositData.asm_name,
            event_type: "DEPOSITED",
            amount: order.cod_amount,
            notes: `Deposited via ${depositNumber} (SuperBundle)`,
            metadata: { 
              deposit_id: deposit.id,
              superbundle_ids: depositData.superbundle_ids,
            },
          }));

          const { error: aeError } = await supabaseClient
            .from("asm_events")
            .insert(asmEventInserts);

          if (aeError) {
            throw aeError;
          }

          // Update orders to DEPOSITED state (triggers should handle this, but we ensure it)
          const orderIds = allOrders.map((o) => o.id);
          const { error: orderUpdateError } = await supabaseClient
            .from("orders")
            .update({
              money_state: "DEPOSITED",
              deposited_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .in("id", orderIds);

          if (orderUpdateError) {
            console.error("Error updating orders:", orderUpdateError);
          }
        }
      }
    } else {
      // LEGACY FLOW: Order-based deposits
      const depositOrderInserts = [];
      const asmEventInserts = [];

      // Check if order_ids is array of strings or array of OrderCollectionData objects
      const isExtendedFormat = depositData.order_ids!.length > 0 && 
        typeof depositData.order_ids![0] === 'object' && 
        'order_id' in depositData.order_ids![0];

      for (const orderItem of depositData.order_ids!) {
        const orderId = isExtendedFormat ? (orderItem as OrderCollectionData).order_id : orderItem as string;
        const collectionData = isExtendedFormat ? orderItem as OrderCollectionData : null;

        // Get order details
        const { data: order } = await supabaseClient
          .from("orders")
          .select("id, cod_amount")
          .eq("id", orderId)
          .single();

        if (order) {
          depositOrderInserts.push({
            deposit_id: deposit.id,
            order_id: order.id,
            amount: order.cod_amount,
            collection_status: collectionData?.collection_status || 'COLLECTED',
            non_collection_reason: collectionData?.non_collection_reason || null,
            future_collection_date: collectionData?.future_collection_date || null,
            asm_handover_data_id: depositData.asm_handover_data_id || null,
          });

          // Only create DEPOSITED event for collected orders
          if (!collectionData || collectionData.collection_status === 'COLLECTED') {
            asmEventInserts.push({
              order_id: order.id,
              asm_id: depositData.asm_id,
              asm_name: depositData.asm_name,
              event_type: "DEPOSITED",
              amount: order.cod_amount,
              notes: `Deposited via ${depositNumber}`,
              metadata: { deposit_id: deposit.id },
            });
          }
        }
      }

      // Insert deposit orders
      if (depositOrderInserts.length > 0) {
        const { error: doError } = await supabaseClient
          .from("deposit_orders")
          .insert(depositOrderInserts);

        if (doError) {
          throw doError;
        }
      }

      // Insert ASM events (triggers will update order states)
      if (asmEventInserts.length > 0) {
        const { error: aeError } = await supabaseClient
          .from("asm_events")
          .insert(asmEventInserts);

        if (aeError) {
          throw aeError;
        }
      }
    }

    // Update asm_handover_data status to SUBMITTED if provided
    if (depositData.asm_handover_data_id) {
      await supabaseClient
        .from("asm_handover_data")
        .update({ 
          status: 'SUBMITTED',
          sm_id: depositData.sm_user_id,
          actual_amount_received: depositData.actual_amount_received,
          updated_at: new Date().toISOString(),
        })
        .eq("id", depositData.asm_handover_data_id);
    }

    // Log audit event
    await supabaseClient.rpc("log_audit_event", {
      p_action: "DEPOSIT_CREATED",
      p_resource_type: "deposit",
      p_resource_id: deposit.id,
      p_new_values: deposit,
    });

    return new Response(JSON.stringify({ success: true, deposit }), {
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

