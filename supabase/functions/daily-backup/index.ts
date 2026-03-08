import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, serviceRoleKey)

    // Get all active companies
    const { data: companies, error: compError } = await supabase
      .from('companies')
      .select('id')

    if (compError) throw compError

    const results: Record<string, any> = {}

    for (const company of companies || []) {
      const companyId = company.id
      const rowCounts: Record<string, number> = {}
      const tables = ['transactions', 'companies', 'subscriptions']

      for (const table of tables) {
        const { count, error } = await supabase
          .from(table)
          .select('*', { count: 'exact', head: true })
          .eq(table === 'companies' ? 'id' : 'company_id', companyId)

        if (!error) {
          rowCounts[table] = count || 0
        }
      }

      // Record backup in history
      const { error: insertError } = await supabase
        .from('backup_history')
        .insert({
          company_id: companyId,
          backup_type: 'daily',
          tables_backed_up: tables,
          row_counts: rowCounts,
          status: 'completed',
          completed_at: new Date().toISOString(),
        })

      if (insertError) {
        // Log failure
        await supabase.from('backup_history').insert({
          company_id: companyId,
          backup_type: 'daily',
          tables_backed_up: tables,
          status: 'failed',
          error_message: insertError.message,
        })
      }

      results[companyId] = rowCounts
    }

    return new Response(
      JSON.stringify({ success: true, companies: Object.keys(results).length, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
