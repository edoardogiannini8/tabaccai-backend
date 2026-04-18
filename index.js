require('dotenv').config();
const express = require('express');
const cors = require('cors');
const Anthropic = require('@anthropic-ai/sdk');
const XLSX = require('xlsx');
const { createClient } = require('@supabase/supabase-js');
const { catalogo } = require('./catalogo');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

const catalogoStringa = catalogo.map(p =>
  `${p.brand} (${p.variante}) - AAMS: ${p.codice_aams} - €${p.prezzo_pacchetto}/pacco - alias: ${p.alias.join(', ')}`
).join('\n');

const SYSTEM_VOICE = `Sei l'assistente AI di TabaccAI per tabaccai italiani.
Ricevi testo grezzo trascritto dal microfono in italiano con possibili errori di pronuncia e ortografia.

ATTENZIONE AI MISSPELLING COMUNI:
- "malboro" / "marbolo" / "marlo" = Marlboro
- "chestefild" / "cesterfield" / "chesterfil" = Chesterfield  
- "camel activ" / "camel ative" = Camel Activate
- "filippo morris" / "filip morris" = Philip Morris
- "vinston" / "wiston" / "uinston" = Winston
- "emesse" / "nazionali" = MS
- "iqos" / "icos" = HEETS o TEREA
- "hites" / "hits" / "eets" = HEETS
- "teria" = TEREA
- "golden virginia" (qualsiasi pronuncia) = Golden Virginia
- "gaulois" / "galois" = Gauloises
- Sinonimi: "morbide" / "cartoccio" = variante Soft; "lunghe" / "100" = variante 100s

Catalogo prodotti disponibile (${catalogo.length} prodotti, prezzi al 15 aprile 2026):
${catalogoStringa}

Regole:
1. Identifica i prodotti dal catalogo anche con errori di pronuncia gravi
2. Le quantita sono in STECCHE — "tre" = 3 stecche
3. Se l'utente dice "morbide" cerca la variante Soft dello stesso brand
4. Rispondi SOLO con JSON array puro, zero testo aggiuntivo, inizia con [

Formato: [{"brand":"nome esatto","variante":"variante","qty":numero,"codice_aams":"codice","testo_originale":"detto","corretto":true/false}]
Se non trovato nonostante i tentativi: "codice_aams":"NON_TROVATO"`;

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
  };
}

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', messaggio: 'TabaccAI backend v4', prodotti: catalogo.length });
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
      system: `Sei l'assistente AI di TabaccAI. Ordine attuale:\n${ordineStr}\n\nCatalogo:\n${catalogoStringa}\n\nATTENZIONE AI MISSPELLING — stessa logica del riconoscimento vocale.\nRispondi SOLO con JSON puro:\n{"aggiunti":[{"brand":"...","variante":"...","qty":N,"codice_aams":"..."}],"rimossi":[{"brand":"...","codice_aams":"..."}],"modificati":[{"brand":"...","codice_aams":"...","nuova_qty":N}],"messaggio":"..."}`,
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
      system: `Analizza questa nota di un tabaccaio. Oggi: ${new Date().toISOString().split('T')[0]}\nCatalogo (parziale): ${catalogoStringa.split('\n').slice(0,20).join('\n')}\nRispondi SOLO con JSON puro:\n{"prodotti":[{"brand":"...","codice_aams":"...","qty":1}],"scadenza_label":"Mercoledì 23 Apr" o null,"scadenza_data":"2026-04-23" o null,"testo_pulito":"nota senza date"}`,
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

app.post('/api/excel', (req, res) => {
  const { prodotti: lista, data_ordine } = req.body;
  if (!lista || lista.length === 0) return res.status(400).json({ errore: 'Nessun prodotto' });
  const validi = lista.filter(p => p.codice_aams !== 'NON_TROVATO');
  let totale_tabaccaio = 0, totale_peso_kg = 0;
  const righe = validi.map(p => {
    const prezzi = calcolaPrezzoProdotto(p, p.qty);
    if (prezzi) { totale_tabaccaio += prezzi.totale_tabaccaio; totale_peso_kg += prezzi.peso_totale_kg; }
    return { 'Codice AAMS': p.codice_aams, 'Descrizione': `${p.brand} ${p.variante||''}`.trim(), 'Stecche': p.qty, 'Prezzo Stecca (EUR)': prezzi ? prezzi.prezzo_stecca_tabaccaio : '', 'Totale (EUR)': prezzi ? prezzi.totale_tabaccaio : '', 'Peso Stecca (g)': prezzi ? prezzi.peso_stecca_g : '', 'Peso Totale (kg)': prezzi ? prezzi.peso_totale_kg : '' };
  });
  righe.push({ 'Codice AAMS':'', 'Descrizione':'TOTALE ORDINE', 'Stecche': validi.reduce((s,p)=>s+(p.qty||0),0), 'Prezzo Stecca (EUR)':'', 'Totale (EUR)': parseFloat(totale_tabaccaio.toFixed(2)), 'Peso Stecca (g)':'', 'Peso Totale (kg)': parseFloat(totale_peso_kg.toFixed(3)) });
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(righe);
  ws['!cols'] = [{wch:14},{wch:30},{wch:9},{wch:18},{wch:14},{wch:16},{wch:16}];
  XLSX.utils.book_append_sheet(wb, ws, 'Ordine');
  const righeLogista = validi.map(p => ({ 'Codice AAMS': p.codice_aams, 'Quantita': p.qty }));
  const wsL = XLSX.utils.json_to_sheet(righeLogista);
  wsL['!cols'] = [{wch:15},{wch:10}];
  XLSX.utils.book_append_sheet(wb, wsL, 'Upload Logista');
  const buffer = XLSX.write(wb, { type:'buffer', bookType:'xlsx' });
  const nome = `ordine_tabaccai_${data_ordine||new Date().toISOString().split('T')[0]}.xlsx`;
  res.setHeader('Content-Disposition', `attachment; filename="${nome}"`);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(buffer);
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`TabaccAI v4 — ${catalogo.length} prodotti in catalogo — porta ${PORT}`));
