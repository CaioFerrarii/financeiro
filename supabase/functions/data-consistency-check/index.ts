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

    const results: any[] = []

    // 1. Find transactions without company_id
    const { data: orphanTransactions, error: err1 } = await supabase
      .from('transactions')
      .select('id, description, user_id')
      .is('company_id', null)
      .is('deleted_at', null)
      .limit(100)

    if (!err1 && orphanTransactions && orphanTransactions.length > 0) {
      results.push({
        check: 'orphan_transactions',
        count: orphanTransactions.length,
        severity: 'error',
        message: `${orphanTransactions.length} transações sem company_id`,
      })
    }

    // 2. Find categories without company_id
    const { data: orphanCategories, error: err2 } = await supabase
      .from('categories')
      .select('id, name')
      .is('company_id', null)
      .is('deleted_at', null)
      .limit(100)

    if (!err2 && orphanCategories && orphanCategories.length > 0) {
      results.push({
        check: 'orphan_categories',
        count: orphanCategories.length,
        severity: 'warning',
        message: `${orphanCategories.length} categorias sem company_id`,
      })
    }

    // 3. Find alerts without company_id
    const { data: orphanAlerts, error: err3 } = await supabase
      .from('alerts')
      .select('id')
      .is('company_id', null)
      .is('deleted_at', null)
      .limit(100)

    if (!err3 && orphanAlerts && orphanAlerts.length > 0) {
      results.push({
        check: 'orphan_alerts',
        count: orphanAlerts.length,
        severity: 'warning',
        message: `${orphanAlerts.length} alertas sem company_id`,
      })
    }

    // 4. Find users without roles (orphaned profiles)
    const { data: allProfiles } = await supabase
      .from('profiles')
      .select('user_id')

    const { data: allRoles } = await supabase
      .from('user_roles')
      .select('user_id')

    if (allProfiles && allRoles) {
      const roleUserIds = new Set(allRoles.map(r => r.user_id))
      const orphanUsers = allProfiles.filter(p => !roleUserIds.has(p.user_id))
      if (orphanUsers.length > 0) {
        results.push({
          check: 'orphan_users',
          count: orphanUsers.length,
          severity: 'warning',
          message: `${orphanUsers.length} usuários sem vínculo com empresa`,
        })
      }
    }

    // 5. Find negative amounts in transactions (which should be positive)
    const { data: negativeAmounts, error: err5 } = await supabase
      .from('transactions')
      .select('id, amount, description')
      .lt('amount', 0)
      .is('deleted_at', null)
      .limit(50)

    if (!err5 && negativeAmounts && negativeAmounts.length > 0) {
      results.push({
        check: 'negative_amounts',
        count: negativeAmounts.length,
        severity: 'warning',
        message: `${negativeAmounts.length} transações com valor negativo`,
      })
    }

    // 6. Check for duplicate transactions using the DB function
    const { data: companies } = await supabase.from('companies').select('id')
    let totalDuplicates = 0

    for (const company of companies || []) {
      const { data: dups } = await supabase.rpc('check_duplicate_transactions', {
        p_company_id: company.id,
      })
      if (dups && dups.length > 0) {
        totalDuplicates += dups.length
      }
    }

    if (totalDuplicates > 0) {
      results.push({
        check: 'duplicate_transactions',
        count: totalDuplicates,
        severity: 'warning',
        message: `${totalDuplicates} transações potencialmente duplicadas`,
      })
    }

    // Log results to system_events for each company
    for (const company of companies || []) {
      await supabase.from('system_events').insert({
        company_id: company.id,
        event_type: 'consistency_check',
        description: results.length === 0 
          ? 'Verificação de consistência: nenhum problema encontrado' 
          : `Verificação de consistência: ${results.length} problemas encontrados`,
        metadata: { results, timestamp: new Date().toISOString() },
      })
    }

    return new Response(
      JSON.stringify({ success: true, issues_found: results.length, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
