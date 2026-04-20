require('dotenv').config();
const express = require('express');
const cors = require('cors');
const Anthropic = require('@anthropic-ai/sdk');
const XLSX = require('xlsx');
const { createClient } = require('@supabase/supabase-js');
const { Resend } = require('resend');
const { catalogo } = require('./catalogo');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const resend = new Resend(process.env.RESEND_API_KEY);

const catalogoStringa = catalogo.map(p =>
  `${p.brand} (${p.variante}) - AAMS: ${p.codice_aams} - €${p.prezzo_pacchetto}/pacco`
).join('\n');

const SYSTEM_VOICE = `Sei l'assistente AI di TabaccAI per tabaccai italiani.
Ricevi testo grezzo trascritto dal microfono in italiano con possibili errori di pronuncia e ortografia.

ATTENZIONE AI MISSPELLING COMUNI:
- "malboro/marbolo/marlo" = MARLBORO
- "chestefild/cesterfield/chesterfil" = CHESTERFIELD
- "camel activ/ative" = CAMEL ACTIVATE
- "filippo morris/filip morris" = PHILIP MORRIS
- "vinston/wiston/uinston" = WINSTON
- "emesse/nazionali" = DUNHILL MS
- "iqos/icos" = TEREA o HEETS
- "hites/hits/eets" = HEETS
- "teria" = TEREA
- "gaulois/galois" = GAULOISES
- "morbide/cartoccio/soft" = variante Soft (CART20)
- "lunghe/100/cento" = variante 100s
- "glo/neo" = NEO STICKS

Catalogo prodotti disponibile (${catalogo.length} prodotti, listino Logista 19 aprile 2026):
${catalogoStringa}

Regole:
1. Identifica prodotti anche con errori gravi di pronuncia
2. Le quantita sono in STECCHE — "tre" = 3 stecche
3. "morbide/soft/cartoccio" = cerca variante Soft dello stesso brand
4. Rispondi SOLO con JSON array puro — inizia con [ finisce con ]
5. Zero testo aggiuntivo, zero markdown, zero backtick

Formato: [{"brand":"nome esatto","variante":"variante","qty":numero,"codice_aams":"codice","testo_originale":"detto","corretto":true/false}]
Se non trovato: "codice_aams":"NON_TROVATO"`;

function calcolaPrezzoProdotto(prodotto, qtaStecche) {
  const p = catalogo.find(c => c.codice_aams === prodotto.codice_aams);
  if (!p) return null;
  const prezzoStecca = p.prezzo_pacchetto * p.pezzi_per_stecca;
  const prezzoTabaccaio = prezzoStecca * 0.90;
  const pesoTotaleG = p.peso_stecca_g * qtaStecche;
  return {
    prezzo_pacchetto: p.prezzo_pacchetto,
    pezzi_per_stecca: p.pezzi_per_stecca,
    prezzo_stecca_pubblico: parseFloat(prezzoStecca.toFixed(2)),
    prezzo_stecca_tabaccaio: parseFloat(prezzoTabaccaio.toFixed(2)),
    totale_pubblico: parseFloat((prezzoStecca * qtaStecche).toFixed(2)),
    totale_tabaccaio: parseFloat((prezzoTabaccaio * qtaStecche).toFixed(2)),
    peso_stecca_g: p.peso_stecca_g,
    peso_totale_g: pesoTotaleG,
    peso_totale_kg: parseFloat((pesoTotaleG / 1000).toFixed(3)),
    unita_minima_kgc: p.unita_minima_kgc,
    quantita_kgc: parseFloat((p.unita_minima_kgc * qtaStecche).toFixed(3)),
  };
}

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', messaggio: 'TabaccAI backend v6', prodotti: catalogo.length });
});

app.post('/api/voice', async (req, res) => {
  const { testo, session_id } = req.body;
  if (!testo) return res.status(400).json({ errore: 'Nessun testo ricevuto' });
  try {
    const risposta = await anthropic.messages.create({
      model: 'claude-sonnet-4-5', max_tokens: 2048,
      system: SYSTEM_VOICE,
      messages: [{ role: 'user', content: testo }],
    });
    let t = risposta.content[0].text.trim().replace(/```json\n?/g,'').replace(/```\n?/g,'').trim();
    const prodottiRiconosciuti = JSON.parse(t);
    const prodottiArricchiti = prodottiRiconosciuti.map(p => {
      if (p.codice_aams === 'NON_TROVATO') return p;
      const prezzi = calcolaPrezzoProdotto(p, p.qty || 1);
      return prezzi ? { ...p, ...prezzi } : p;
    });
    const nonTrovati = prodottiRiconosciuti.filter(p => p.codice_aams === 'NON_TROVATO');
    if (nonTrovati.length > 0 && session_id) {
      for (const p of nonTrovati) {
        await supabase.from('prodotti_sconosciuti').insert({ testo_originale: p.testo_originale, session_id }).catch(console.error);
      }
    }
    res.json({ successo: true, prodotti: prodottiArricchiti });
  } catch (err) {
    console.error('Errore voice:', err.message);
    res.status(500).json({ errore: 'Errore riconoscimento: ' + err.message });
  }
});

app.post('/api/modifica-ordine', async (req, res) => {
  const { testo, ordine_corrente, session_id } = req.body;
  if (!testo || !ordine_corrente) return res.status(400).json({ errore: 'Dati mancanti' });
  try {
    const ordineStr = ordine_corrente.map(p => `${p.brand} (${p.variante}) x${p.qty} stecche`).join('\n');
    const risposta = await anthropic.messages.create({
      model: 'claude-sonnet-4-5', max_tokens: 1024,
      system: `Sei l'assistente AI di TabaccAI. Ordine attuale:\n${ordineStr}\n\nCatalogo:\n${catalogoStringa}\n\nRispondi SOLO con JSON puro:\n{"aggiunti":[{"brand":"...","variante":"...","qty":N,"codice_aams":"..."}],"rimossi":[{"brand":"...","codice_aams":"..."}],"modificati":[{"brand":"...","codice_aams":"...","nuova_qty":N}],"messaggio":"..."}`,
      messages: [{ role: 'user', content: testo }],
    });
    let t = risposta.content[0].text.trim().replace(/```json\n?/g,'').replace(/```\n?/g,'').trim();
    const modifiche = JSON.parse(t);
    if (modifiche.aggiunti) {
      modifiche.aggiunti = modifiche.aggiunti.map(p => {
        const prezzi = calcolaPrezzoProdotto(p, p.qty || 1);
        return prezzi ? { ...p, ...prezzi } : p;
      });
    }
    res.json({ successo: true, modifiche });
  } catch (err) { res.status(500).json({ errore: err.message }); }
});

app.post('/api/immagine', async (req, res) => {
  const { immagine_base64, media_type, session_id } = req.body;
  if (!immagine_base64) return res.status(400).json({ errore: 'Nessuna immagine' });
  try {
    const risposta = await anthropic.messages.create({
      model: 'claude-sonnet-4-5', max_tokens: 1024,
      system: `Sei l'assistente AI di TabaccAI. Identifica i prodotti tabacchi nell'immagine.\nCatalogo:\n${catalogoStringa}\nRispondi SOLO con JSON puro:\n[{"brand":"nome esatto","variante":"variante","qty":1,"codice_aams":"codice","confidenza":"alta/media/bassa"}]`,
      messages: [{ role:'user', content:[
        { type:'image', source:{ type:'base64', media_type: media_type||'image/jpeg', data: immagine_base64 } },
        { type:'text', text:'Identifica i prodotti tabacchi.' }
      ]}],
    });
    let t = risposta.content[0].text.trim().replace(/```json\n?/g,'').replace(/```\n?/g,'').trim();
    const prodotti = JSON.parse(t);
    const arricchiti = prodotti.map(p => {
      if (p.codice_aams === 'NON_TROVATO') return p;
      const prezzi = calcolaPrezzoProdotto(p, p.qty || 1);
      return prezzi ? { ...p, ...prezzi } : p;
    });
    const nonTrovati = prodotti.filter(p => p.codice_aams === 'NON_TROVATO');
    if (nonTrovati.length > 0 && session_id) {
      await supabase.from('prodotti_sconosciuti').insert({ testo_originale: nonTrovati.map(p=>p.brand).join(', '), foto_base64: immagine_base64.substring(0,500), session_id }).catch(console.error);
    }
    res.json({ successo: true, prodotti: arricchiti });
  } catch (err) { res.status(500).json({ errore: err.message }); }
});

app.post('/api/note', async (req, res) => {
  const { testo, session_id } = req.body;
  if (!testo || !session_id) return res.status(400).json({ errore: 'Dati mancanti' });
  try {
    const risposta = await anthropic.messages.create({
      model: 'claude-sonnet-4-5', max_tokens: 512,
      system: `Analizza questa nota di un tabaccaio. Oggi: ${new Date().toISOString().split('T')[0]}\nRispondi SOLO con JSON puro:\n{"prodotti":[{"brand":"...","codice_aams":"...","qty":1}],"scadenza_label":"Mercoledi 23 Apr" o null,"scadenza_data":"2026-04-23" o null,"testo_pulito":"nota senza date"}`,
      messages: [{ role:'user', content: testo }],
    });
    let t = risposta.content[0].text.trim().replace(/```json\n?/g,'').replace(/```\n?/g,'').trim();
    const analisi = JSON.parse(t);
    const { data, error } = await supabase.from('note').insert({ session_id, testo: analisi.testo_pulito||testo, prodotti: analisi.prodotti, scadenza_data: analisi.scadenza_data, scadenza_label: analisi.scadenza_label, completata: false }).select().single();
    if (error) throw error;
    res.json({ successo: true, nota: data });
  } catch (err) { res.status(500).json({ errore: err.message }); }
});

app.get('/api/note/:session_id', async (req, res) => {
  try {
    const { data, error } = await supabase.from('note').select('*').eq('session_id', req.params.session_id).eq('completata', false).order('scadenza_data', { ascending:true, nullsFirst:false });
    if (error) throw error;
    res.json({ successo: true, note: data });
  } catch (err) { res.status(500).json({ errore: err.message }); }
});

app.patch('/api/note/:id', async (req, res) => {
  try {
    const { error } = await supabase.from('note').update({ completata: true }).eq('id', req.params.id);
    if (error) throw error;
    res.json({ successo: true });
  } catch (err) { res.status(500).json({ errore: err.message }); }
});

app.post('/api/ordini', async (req, res) => {
  const { prodotti: lista, session_id } = req.body;
  if (!lista || !session_id) return res.status(400).json({ errore: 'Dati mancanti' });
  try {
    const { data, error } = await supabase.from('ordini').insert({ session_id, prodotti: lista }).select().single();
    if (error) throw error;
    res.json({ successo: true, ordine: data });
  } catch (err) { res.status(500).json({ errore: err.message }); }
});

app.get('/api/ordini/:session_id/ultimo', async (req, res) => {
  try {
    const { data, error } = await supabase.from('ordini').select('*').eq('session_id', req.params.session_id).order('creato_at', { ascending: false }).limit(1).single();
    if (error && error.code !== 'PGRST116') throw error;
    res.json({ successo: true, ordine: data || null });
  } catch (err) { res.status(500).json({ errore: err.message }); }
});

app.post('/api/excel', async (req, res) => {
  const { prodotti: lista, data_ordine } = req.body;
  if (!lista || lista.length === 0) return res.status(400).json({ errore: 'Nessun prodotto' });

  const validi = lista.filter(p => p.codice_aams !== 'NON_TROVATO');
  let totale_tabaccaio = 0, totale_peso_kg = 0;
  const data = data_ordine || new Date().toISOString().split('T')[0];

  // Righe riepilogo per email
  const righeRiepilogo = validi.map(p => {
    const prezzi = calcolaPrezzoProdotto(p, p.qty);
    if (prezzi) { totale_tabaccaio += prezzi.totale_tabaccaio; totale_peso_kg += prezzi.peso_totale_kg; }
    return {
      'Codice AAMS': p.codice_aams,
      'Descrizione': p.brand + (p.variante ? ' (' + p.variante + ')' : ''),
      'Stecche': p.qty,
      'Kgc': prezzi ? prezzi.quantita_kgc : '',
      'Prezzo Stecca (EUR)': prezzi ? prezzi.prezzo_stecca_tabaccaio : '',
      'Totale (EUR)': prezzi ? prezzi.totale_tabaccaio : '',
      'Peso Stecca (g)': prezzi ? prezzi.peso_stecca_g : '',
      'Peso Totale (kg)': prezzi ? prezzi.peso_totale_kg : '',
    };
  });
  righeRiepilogo.push({
    'Codice AAMS': '', 'Descrizione': 'TOTALE ORDINE',
    'Stecche': validi.reduce((s,p)=>s+(p.qty||0),0),
    'Kgc': parseFloat(totale_peso_kg.toFixed(3)),
    'Prezzo Stecca (EUR)': '',
    'Totale (EUR)': parseFloat(totale_tabaccaio.toFixed(2)),
    'Peso Stecca (g)': '', 'Peso Totale (kg)': parseFloat(totale_peso_kg.toFixed(3)),
  });

  // Righe formato Logista per download — identico al template ufficiale
  const righeLogista = validi.map(p => {
    const prod = catalogo.find(c => c.codice_aams === p.codice_aams);
    const kgc = prod ? parseFloat((prod.unita_minima_kgc * p.qty).toFixed(3)) : parseFloat((p.qty * 0.2).toFixed(3));
    return { 'Codice AAMS': p.codice_aams, 'Quantita': kgc };
  });

  // Workbook download — solo Sheet1 formato Logista
  const wbDownload = XLSX.utils.book_new();
  const wsLogista = XLSX.utils.json_to_sheet(righeLogista);
  wsLogista['!cols'] = [{ wch: 11.8 }, { wch: 8.3 }];
  const hStyle = { font: { name: 'Calibri', sz: 11, bold: true }, fill: { fgColor: { rgb: '21C5FF' }, patternType: 'solid' } };
  if (wsLogista['A1']) wsLogista['A1'].s = hStyle;
  if (wsLogista['B1']) wsLogista['B1'].s = hStyle;
  XLSX.utils.book_append_sheet(wbDownload, wsLogista, 'Sheet1');
  const bufferDownload = XLSX.write(wbDownload, { type: 'buffer', bookType: 'xlsx', cellStyles: true });

  // Workbook email — foglio riepilogo completo
  const wbEmail = XLSX.utils.book_new();
  const wsRiepilogo = XLSX.utils.json_to_sheet(righeRiepilogo);
  wsRiepilogo['!cols'] = [{wch:14},{wch:32},{wch:9},{wch:8},{wch:18},{wch:14},{wch:16},{wch:16}];
  XLSX.utils.book_append_sheet(wbEmail, wsRiepilogo, 'Riepilogo');
  const bufferEmail = XLSX.write(wbEmail, { type: 'buffer', bookType: 'xlsx' });

  // Manda email con riepilogo
  try {
    await resend.emails.send({
      from: 'TabaccAI <onboarding@resend.dev>',
      to: 'edoardogiannini4@gmail.com',
      subject: 'Riepilogo ordine TabaccAI — ' + data,
      html: '<h2>Riepilogo ordine del ' + data + '</h2><p><strong>' + validi.length + ' prodotti</strong> — ' + validi.reduce((s,p)=>s+(p.qty||0),0) + ' stecche totali</p><p>Totale tabaccaio (90%): <strong>EUR ' + totale_tabaccaio.toFixed(2) + '</strong></p><p>Peso totale: ' + totale_peso_kg.toFixed(2) + ' kg</p><br><p>Il file Upload Logista e stato scaricato sul dispositivo.</p>',
      attachments: [{
        filename: 'riepilogo_ordine_' + data + '.xlsx',
        content: bufferEmail.toString('base64'),
      }],
    });
    console.log('Email riepilogo inviata per ordine del ' + data);
  } catch (emailErr) {
    console.error('Errore invio email:', emailErr.message);
  }

  // Download del file Logista
  const nome = 'ordine_logista_' + data + '.xlsx';
  res.setHeader('Content-Disposition', 'attachment; filename="' + nome + '"');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(bufferDownload);
});


// ENDPOINT: Salva ordine in corso
app.post('/api/ordine-corrente', async (req, res) => {
  const { prodotti, session_id } = req.body;
  if (!session_id) return res.status(400).json({ errore: 'Session ID mancante' });
  try {
    const { error } = await supabase.from('ordine_corrente').upsert({
      session_id,
      prodotti: prodotti || [],
      aggiornato_at: new Date().toISOString()
    }, { onConflict: 'session_id' });
    if (error) throw error;
    res.json({ successo: true });
  } catch (err) { res.status(500).json({ errore: err.message }); }
});

// ENDPOINT: Recupera ordine in corso
app.get('/api/ordine-corrente/:session_id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('ordine_corrente')
      .select('*')
      .eq('session_id', req.params.session_id)
      .single();
    if (error && error.code !== 'PGRST116') throw error;
    res.json({ successo: true, ordine: data || null });
  } catch (err) { res.status(500).json({ errore: err.message }); }
});

// ENDPOINT: Cancella ordine in corso
app.delete('/api/ordine-corrente/:session_id', async (req, res) => {
  try {
    const { error } = await supabase
      .from('ordine_corrente')
      .delete()
      .eq('session_id', req.params.session_id);
    if (error) throw error;
    res.json({ successo: true });
  } catch (err) { res.status(500).json({ errore: err.message }); }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`TabaccAI v6 — ${catalogo.length} prodotti — porta ${PORT}`));
