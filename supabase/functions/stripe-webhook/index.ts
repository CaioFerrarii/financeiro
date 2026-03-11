// supabase/functions/stripe-webhook/index.ts
// Recebe eventos do Stripe e atualiza o banco de dados

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@13.11.0?target=deno'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
})

const SUPABASE_URL         = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const WEBHOOK_SECRET       = Deno.env.get('STRIPE_WEBHOOK_SECRET')!

serve(async (req) => {
  const body      = await req.text()
  const signature = req.headers.get('stripe-signature')!

  let event: Stripe.Event

  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, WEBHOOK_SECRET)
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message)
    return new Response(`Webhook Error: ${err.message}`, { status: 400 })
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  const getCompanyId = async (stripeSubId: string): Promise<string | null> => {
    const { data } = await supabase
      .from('subscriptions')
      .select('company_id')
      .eq('stripe_subscription_id', stripeSubId)
      .maybeSingle()
    return data?.company_id || null
  }

  try {
    switch (event.type) {

      // Checkout concluído — assinatura criada
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const companyId = session.metadata?.company_id
        if (!companyId) break

        const subId = session.subscription as string
        const sub   = await stripe.subscriptions.retrieve(subId)

        await supabase
          .from('subscriptions')
          .update({
            stripe_subscription_id: subId,
            stripe_price_id:        sub.items.data[0]?.price.id,
            status:                 'ativo',
            trial_ends_at:          sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null,
            current_period_start:   new Date(sub.current_period_start * 1000).toISOString(),
            current_period_end:     new Date(sub.current_period_end * 1000).toISOString(),
            data_renovacao:         new Date(sub.current_period_end * 1000).toISOString(),
          })
          .eq('company_id', companyId)

        console.log(`✅ Assinatura criada para empresa ${companyId}`)
        break
      }

      // Assinatura renovada com sucesso
      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice
        const subId   = invoice.subscription as string
        if (!subId) break

        const sub       = await stripe.subscriptions.retrieve(subId)
        const companyId = await getCompanyId(subId)
        if (!companyId) break

        await supabase
          .from('subscriptions')
          .update({
            status:               'ativo',
            current_period_start: new Date(sub.current_period_start * 1000).toISOString(),
            current_period_end:   new Date(sub.current_period_end * 1000).toISOString(),
            data_renovacao:       new Date(sub.current_period_end * 1000).toISOString(),
            cancel_at_period_end: sub.cancel_at_period_end,
          })
          .eq('company_id', companyId)

        console.log(`✅ Renovação registrada para empresa ${companyId}`)
        break
      }

      // Pagamento falhou
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        const subId   = invoice.subscription as string
        if (!subId) break

        const companyId = await getCompanyId(subId)
        if (!companyId) break

        await supabase
          .from('subscriptions')
          .update({ status: 'suspenso' })
          .eq('company_id', companyId)

        console.log(`⚠️ Pagamento falhou para empresa ${companyId}`)
        break
      }

      // Assinatura cancelada ou expirada
      case 'customer.subscription.deleted': {
        const sub       = event.data.object as Stripe.Subscription
        const companyId = await getCompanyId(sub.id)
        if (!companyId) break

        await supabase
          .from('subscriptions')
          .update({
            status:               'cancelado',
            cancel_at_period_end: false,
          })
          .eq('company_id', companyId)

        console.log(`❌ Assinatura cancelada para empresa ${companyId}`)
        break
      }

      // Trial vai acabar (3 dias antes)
      case 'customer.subscription.trial_will_end': {
        const sub       = event.data.object as Stripe.Subscription
        const companyId = await getCompanyId(sub.id)
        if (!companyId) break

        // Log para notificar o usuário (pode integrar email aqui no futuro)
        await supabase.from('system_logs' as any).insert({
          company_id: companyId,
          type:       'info',
          message:    'Trial expira em 3 dias',
          endpoint:   'stripe-webhook',
          metadata:   { trial_end: sub.trial_end },
        })
        break
      }

      // Usuário pediu cancelamento (mas ainda ativo até fim do período)
      case 'customer.subscription.updated': {
        const sub       = event.data.object as Stripe.Subscription
        const companyId = await getCompanyId(sub.id)
        if (!companyId) break

        await supabase
          .from('subscriptions')
          .update({
            status:               sub.status === 'active' ? 'ativo' : sub.status === 'trialing' ? 'ativo' : 'suspenso',
            cancel_at_period_end: sub.cancel_at_period_end,
            current_period_end:   new Date(sub.current_period_end * 1000).toISOString(),
            data_renovacao:       new Date(sub.current_period_end * 1000).toISOString(),
          })
          .eq('company_id', companyId)
        break
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { 'Content-Type': 'application/json' },
    })

  } catch (err: any) {
    console.error('Webhook handler error:', err)
    return new Response(`Handler error: ${err.message}`, { status: 500 })
  }
})
