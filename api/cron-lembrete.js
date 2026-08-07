import { createClient } from '@supabase/supabase-js';

// Conecta ao seu banco de dados Supabase usando as chaves configuradas
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

export default async function handler(req, res) {
  try {
    const agora = new Date();
    
    // Define a janela do lembrete: de 1h55m até 2h05m a partir de agora
    const limiteInferior = new Date(agora.getTime() + 115 * 60000).toISOString();
    const limiteSuperior = new Date(agora.getTime() + 125 * 60000).toISOString();

    // 1. Busca no Supabase quem tem horário nas próximas ~2h e ainda NÃO recebeu o lembrete
    const { data: agendamentos, error } = await supabase
      .from('agendamentos')
      .select('*')
      .eq('lembrete_enviado', false)
      .gte('data_horario', limiteInferior)
      .lte('data_horario', limiteSuperior);

    if (error) throw error;

    // 2. Para cada cliente encontrado, dispara a mensagem pelo WhatsApp
    for (const item of agendamentos) {
      const horaStr = new Date(item.data_horario).toLocaleTimeString('pt-BR', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });

      const mensagem = `Oi, *${item.nome_cliente}*! ✂️\nLembrete da barbearia: Seu horário para *${item.servico}* é daqui a pouco, às *${horaStr}*. Nos vemos em breve!`;

      // Envia o texto para a Evolution API (servidor do WhatsApp)
      await fetch(`${process.env.EVOLUTION_API_URL}/message/sendText/${process.env.INSTANCE_NAME}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': process.env.EVOLUTION_API_KEY
        },
        body: JSON.stringify({
          number: item.whatsapp,
          text: mensagem
        })
      });

      // 3. Marca no banco que esse lembrete já foi enviado (para não repetir)
      await supabase
        .from('agendamentos')
        .update({ lembrete_enviado: true })
        .eq('id', item.id);
    }

    return res.status(200).json({ status: 'Sucesso', lembretes_enviados: agendamentos.length });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
