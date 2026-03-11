// supabase/functions/stripe-checkout/index.ts
// Cria uma sessão de checkout no Stripe e retorna a URL

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@13.11.0?target=deno'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
})

const SUPABASE_URL         = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const STRIPE_PRICE_ID      = Deno.env.get('STRIPE_PRICE_ID')!  // ID do preço no Stripe
const FRONTEND_URL         = Deno.env.get('FRONTEND_URL')!

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    // Autenticar usuário pelo JWT
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('Não autenticado')

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) throw new Error('Token inválido')

    // Buscar company_id e subscription do usuário
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('company_id')
      .eq('user_id', user.id)
      .single()

    if (!roleData) throw new Error('Empresa não encontrada')
    const companyId = roleData.company_id

    const { data: sub } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('company_id', companyId)
      .maybeSingle()

    // Buscar ou criar customer no Stripe
    let customerId = sub?.stripe_customer_id

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: {
          company_id: companyId,
          user_id: user.id,
        },
      })
      customerId = customer.id

      // Salvar customer_id no banco
      await supabase
        .from('subscriptions')
        .upsert({
          company_id: companyId,
          stripe_customer_id: customerId,
          plano: 'Fihub Pro',
          valor: 99.99,
          status: 'ativo',
          data_ativacao: new Date().toISOString(),
          data_renovacao: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          trial_ends_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        }, { onConflict: 'company_id' })
    }

    // Criar sessão de checkout com trial de 7 dias
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: STRIPE_PRICE_ID,
          quantity: 1,
        },
      ],
      subscription_data: {
        trial_period_days: 7,
        metadata: {
          company_id: companyId,
        },
      },
      success_url: `${FRONTEND_URL}/settings?tab=subscription&checkout=success`,
      cancel_url:  `${FRONTEND_URL}/settings?tab=subscription&checkout=cancelled`,
      metadata: {
        company_id: companyId,
      },
    })

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
