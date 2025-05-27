import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://yglvnamoudgwbaigeypu.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlnbHZuYW1vdWRnd2JhaWdleXB1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NDI0NTY2MCwiZXhwIjoyMDU5ODIxNjYwfQ.IC8i7I79zYYNwU8U56w2Y_4BardcMDa1P4N-gn_LKLY'
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

export default async function handler(req: any, res: any) {
  console.log('[HOTMART] Recebido webhook')

  if (req.method !== 'POST') {
    console.log('[HOTMART] Método não permitido')
    return res.status(405).send('Only POST allowed')
  }

  const { data, event } = req.body
  console.log('[HOTMART] Evento:', event)

  try {
    const email = data?.buyer?.email
    console.log('[HOTMART] Email:', email)

    if (!email) return res.status(400).send('Email não fornecido')

    const hoje = new Date()
    const data_inicio = hoje.toISOString().split('T')[0]
    const data_expiracao = new Date(hoje)
    data_expiracao.setFullYear(data_expiracao.getFullYear() + 1)
    const data_expiracao_formatada = data_expiracao.toISOString().split('T')[0]

    // 🔔 Evento de aprovação da compra
    if (event === 'PURCHASE_APPROVED') {
      console.log('[SUPABASE] Enviando dados para upsert...')
      const { error, data: responseData } = await supabase.from('users').upsert({
        email,
        status: 'ativo',
        plano: 'anual 57',
        data_inicio,
        data_expiracao: data_expiracao_formatada
      }, { onConflict: 'email' })

      if (error) {
        console.error('[SUPABASE] Erro:', error)
        return res.status(500).send('Erro ao salvar no Supabase')
      }

      console.log('[SUPABASE] Dados inseridos com sucesso:', responseData)

      console.log('[RESEND] Enviando e-mail...')
      const emailRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer re_MMVw4EJ1_MtuepBApAnQXaRvBYp66Pbie',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: 'noreply@pedagoteca.io',
          to: email,
          subject: 'Bem-vindo a Pedagoteca! 🎉',
          html: `
            <h1>Seu acesso está liberado!</h1>
            <p>Olá, sua chave de acesso a Pedagoteca está pronta!!.</p>
            <p>Sua chave de acesso é: PEDAGOTECA2025</p>
            <p>Insira seu nome, e-mail utilizado na compra e sua chave de acesso para liberar o acesso ao aplicativo. </p>
            <p>ANDROID: Procure na sua loja Play Store por Pedagoteca ou clique no link: https://play.google.com/store/apps/details?id=com.pedagoteca.app </p>
            <p>IPHONE: Para instalar em seu Iphone clique no link e siga os passos: https://pedagoteca-pwa.vercel.app/  </p>
            <p>Qualquer dúvida não hesite em enviar um email para pedagotecabrasil@gmail.com </p>
          `
        })
      })

      const emailJson = await emailRes.json()
      console.log('[RESEND] Resposta do envio:', emailJson)

    // ❌ Evento de cancelamento ou reembolso
    } else if (event === 'SUBSCRIPTION_CANCELED' || event === 'PURCHASE_REFUNDED') {
      console.log('[SUPABASE] Marcando usuário como inativo...')
      const { error: updateError } = await supabase.from('users').update({
        status: 'inativo'
      }).eq('email', email)

      if (updateError) {
        console.error('[SUPABASE] Erro ao atualizar status:', updateError)
        return res.status(500).send('Erro ao atualizar status')
      }

      console.log('[SUPABASE] Usuário marcado como inativo.')
    }

    console.log('[HOTMART] Tudo certo! Respondendo 200...')
    return res.status(200).send('OK')
  } catch (err: any) {
    console.error('[ERRO GERAL] Erro interno:', err)
    return res.status(500).send('Erro interno')
  }
}
