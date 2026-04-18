require('dotenv').config();
const express = require('express');
const cors = require('cors');
const Anthropic = require('@anthropic-ai/sdk');
const XLSX = require('xlsx');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const catalogo = [
  { brand: "Marlboro Gold", variante: "KS 20", codice_aams: "8001185", alias: ["malboro gold","marbolo gold","marlboro dorata"] },
  { brand: "Marlboro Rosse", variante: "KS 20", codice_aams: "8001180", alias: ["malboro rosse","marlboro red","malboro red"] },
  { brand: "Marlboro Silver", variante: "KS 20", codice_aams: "8001190", alias: ["malboro silver","marlboro bianche"] },
  { brand: "Marlboro Touch", variante: "KS 20", codice_aams: "8001192", alias: ["malboro touch"] },
  { brand: "Chesterfield Blue", variante: "KS 20", codice_aams: "8004221", alias: ["chestefild blu","chesterfield blu","chester blue","chester blu"] },
  { brand: "Chesterfield Original", variante: "KS 20", codice_aams: "8004220", alias: ["chestefild rosse","chesterfield rosse","chester rosse"] },
  { brand: "Chesterfield Black", variante: "KS 20", codice_aams: "8004225", alias: ["chester black","chesterfield black"] },
  { brand: "Camel Yellow", variante: "KS 20", codice_aams: "8002034", alias: ["camel gialle","camel yellow","camel classiche"] },
  { brand: "Camel Blue", variante: "KS 20", codice_aams: "8002035", alias: ["camel blu","camel blue"] },
  { brand: "Camel Activate", variante: "KS 20", codice_aams: "8002040", alias: ["camel activate","camel activ","camel mentol"] },
  { brand: "Winston Red", variante: "KS 20", codice_aams: "8003567", alias: ["winston rosse","vinston rosse"] },
  { brand: "Winston Blue", variante: "KS 20", codice_aams: "8003568", alias: ["winston blu","vinston blu"] },
  { brand: "Philip Morris Blue", variante: "KS 20", codice_aams: "8005110", alias: ["philip morris blu","filippo morris blu","pm blu"] },
  { brand: "Philip Morris Red", variante: "KS 20", codice_aams: "8005111", alias: ["philip morris rosse","filippo morris rosse","filtrini"] },
  { brand: "Lucky Strike Original", variante: "KS 20", codice_aams: "8006234", alias: ["lucky strike","laki strike","lucky rosse"] },
  { brand: "Lucky Strike Amber", variante: "KS 20", codice_aams: "8006235", alias: ["lucky amber","laki amber","lucky gialle"] },
  { brand: "Pall Mall Blue", variante: "KS 20", codice_aams: "8007123", alias: ["pall mall blu","pallmall blue"] },
  { brand: "Pall Mall Red", variante: "KS 20", codice_aams: "8007120", alias: ["pall mall rosse","pallmall red"] },
  { brand: "MS Rosse", variante: "KS 20", codice_aams: "8008010", alias: ["emesse rosse","ms rosse","nazionali rosse"] },
  { brand: "MS Blu", variante: "KS 20", codice_aams: "8008011", alias: ["emesse blu","ms blu","nazionali blu"] },
  { brand: "Diana Blu", variante: "KS 20", codice_aams: "8009050", alias: ["diana blu","diana azzurra"] },
  { brand: "Diana Rosse", variante: "KS 20", codice_aams: "8009051", alias: ["diana rosse","diana red"] },
  { brand: "Rothmans Blue", variante: "KS 20", codice_aams: "8010234", alias: ["rothmans blu","rothman blue"] },
  { brand: "Benson Hedges Gold", variante: "KS 20", codice_aams: "8011100", alias: ["benson hedges","benson gold","b&h gold"] },
  { brand: "Toscanello", variante: "Conf. 5", codice_aams: "8015010", alias: ["toscanello","toscanelli","toscano","toscanelo"] },
  { brand: "Toscanello Aroma Caffe", variante: "Conf. 5", codice_aams: "8015011", alias: ["toscanello caffe","toscanelli caffe","toscano caffe"] },
  { brand: "HEETS Amber", variante: "Pack 20", codice_aams: "8020100", alias: ["heets amber","iqos amber","hites amber"] },
  { brand: "HEETS Yellow", variante: "Pack 20", codice_aams: "8020101", alias: ["heets yellow","iqos yellow"] },
  { brand: "HEETS Turquoise", variante: "Pack 20", codice_aams: "8020102", alias: ["heets turchese","heets verdi"] },
  { brand: "TEREA Amber", variante: "Pack 20", codice_aams: "8021100", alias: ["terea amber","iqos iluma amber"] },
  { brand: "TEREA Yellow", variante: "Pack 20", codice_aams: "8021101", alias: ["terea yellow","iqos iluma yellow"] },
  { brand: "GLO Neo Classic", variante: "Pack 20", codice_aams: "8022050", alias: ["glo neo","glo classic","neo tobacco"] },
];

const catalogoStringa = catalogo.map(p =>
  `${p.brand} (${p.variante}) - AAMS: ${p.codice_aams} - alias: ${p.alias.join(', ')}`
).join('\n');

// ── HEALTH CHECK ─────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', messaggio: 'TabaccAI backend v2 attivo' });
});

// ── ENDPOINT 1: Interpreta voce ───────────────────────────────────────────────
app.post('/api/voice', async (req, res) => {
  const { testo, session_id } = req.body;
  if (!testo) return res.status(400).json({ errore: 'Nessun testo ricevuto' });

  try {
    const risposta = await anthropic.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 1024,
      system: `Sei l'assistente AI di TabaccAI per tabaccai italiani.
Ricevi testo grezzo trascritto dal microfono con possibili errori di pronuncia.
Catalogo prodotti disponibile:
${catalogoStringa}

Regole IMPORTANTI:
1. Identifica i prodotti anche se scritti o pronunciati male
2. Associa al prodotto corretto nel catalogo
3. Estrai le quantita (se non specificate usa 1)
4. Rispondi SOLO con un array JSON puro, SENZA backtick, SENZA markdown, SENZA testo aggiuntivo
5. La risposta deve iniziare con [ e finire con ]

Formato: [{"brand":"nome esatto","variante":"variante","qty":numero,"codice_aams":"codice","testo_originale":"detto","corretto":true}]
Se non trovato: "codice_aams":"NON_TROVATO"`,
      messages: [{ role: 'user', content: testo }],
    });

    let testo_risposta = risposta.content[0].text.trim();
    testo_risposta = testo_risposta.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const prodottiRiconosciuti = JSON.parse(testo_risposta);

    // Salva prodotti non trovati per fine tuning
    const nonTrovati = prodottiRiconosciuti.filter(p => p.codice_aams === 'NON_TROVATO');
    if (nonTrovati.length > 0 && session_id) {
      for (const p of nonTrovati) {
        await supabase.from('prodotti_sconosciuti').insert({
          testo_originale: p.testo_originale,
          session_id
        });
      }
    }

    res.json({ successo: true, prodotti: prodottiRiconosciuti });
  } catch (err) {
    console.error('Errore voice:', err.message);
    res.status(500).json({ errore: 'Errore nel riconoscimento prodotti: ' + err.message });
  }
});

// ── ENDPOINT 2: Modifica ordine esistente con voce ────────────────────────────
app.post('/api/modifica-ordine', async (req, res) => {
  const { testo, ordine_corrente, session_id } = req.body;
  if (!testo || !ordine_corrente) return res.status(400).json({ errore: 'Dati mancanti' });

  try {
    const ordineStringa = ordine_corrente.map(p =>
      `${p.brand} (${p.variante}) x${p.qty}`
    ).join('\n');

    const risposta = await anthropic.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 1024,
      system: `Sei l'assistente AI di TabaccAI. 
L'utente ha un ordine esistente e vuole modificarlo con la voce.
Catalogo disponibile:
${catalogoStringa}

Ordine attuale:
${ordineStringa}

L'utente dira cosa aggiungere o togliere. 
Rispondi SOLO con JSON puro, niente markdown:
{
  "aggiunti": [{"brand":"...","variante":"...","qty":N,"codice_aams":"..."}],
  "rimossi": [{"brand":"...","codice_aams":"..."}],
  "modificati": [{"brand":"...","codice_aams":"...","nuova_qty":N}],
  "messaggio": "descrizione breve di cosa hai fatto"
}`,
      messages: [{ role: 'user', content: testo }],
    });

    let testo_risposta = risposta.content[0].text.trim();
    testo_risposta = testo_risposta.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const modifiche = JSON.parse(testo_risposta);
    res.json({ successo: true, modifiche });
  } catch (err) {
    console.error('Errore modifica:', err.message);
    res.status(500).json({ errore: 'Errore modifica ordine: ' + err.message });
  }
});

// ── ENDPOINT 3: Riconosci immagine ────────────────────────────────────────────
app.post('/api/immagine', async (req, res) => {
  const { immagine_base64, media_type, session_id, testo_aggiuntivo } = req.body;
  if (!immagine_base64) return res.status(400).json({ errore: 'Nessuna immagine ricevuta' });

  try {
    const risposta = await anthropic.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 1024,
      system: `Sei l'assistente AI di TabaccAI per tabaccai italiani.
Ricevi una foto di prodotti tabacchi (pacchetti, scaffali, stecche).
Catalogo disponibile:
${catalogoStringa}

Identifica i prodotti visibili nell'immagine.
${testo_aggiuntivo ? `L'utente ha anche detto: "${testo_aggiuntivo}"` : ''}

Rispondi SOLO con JSON puro, niente markdown:
[{"brand":"nome esatto dal catalogo","variante":"variante","qty":1,"codice_aams":"codice","confidenza":"alta/media/bassa"}]

Se non riesci a identificare un prodotto con certezza, metti "codice_aams":"NON_TROVATO" e "brand":"descrizione di quello che vedi".`,
      messages: [{
        role: 'user',
        content: [{
          type: 'image',
          source: {
            type: 'base64',
            media_type: media_type || 'image/jpeg',
            data: immagine_base64
          }
        }, {
          type: 'text',
          text: 'Identifica i prodotti tabacchi in questa immagine.'
        }]
      }],
    });

    let testo_risposta = risposta.content[0].text.trim();
    testo_risposta = testo_risposta.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const prodottiRiconosciuti = JSON.parse(testo_risposta);

    // Salva immagini di prodotti non riconosciuti per fine tuning
    const nonTrovati = prodottiRiconosciuti.filter(p => p.codice_aams === 'NON_TROVATO');
    if (nonTrovati.length > 0 && session_id) {
      await supabase.from('prodotti_sconosciuti').insert({
        testo_originale: nonTrovati.map(p => p.brand).join(', '),
        foto_base64: immagine_base64.substring(0, 500),
        session_id
      });
    }

    res.json({ successo: true, prodotti: prodottiRiconosciuti });
  } catch (err) {
    console.error('Errore immagine:', err.message);
    res.status(500).json({ errore: 'Errore riconoscimento immagine: ' + err.message });
  }
});

// ── ENDPOINT 4: Salva nota con scadenza ──────────────────────────────────────
app.post('/api/note', async (req, res) => {
  const { testo, session_id } = req.body;
  if (!testo || !session_id) return res.status(400).json({ errore: 'Dati mancanti' });

  try {
    // Usa Claude per estrarre prodotti e scadenza dalla nota
    const risposta = await anthropic.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 512,
      system: `Analizza questa nota di un tabaccaio e estrai:
1. I prodotti menzionati (dal catalogo: ${catalogoStringa.substring(0, 500)}...)
2. La data/scadenza menzionata (es: "mercoledi", "settimana prossima", "domani", "giovedi")
3. Un label leggibile per la scadenza

Rispondi SOLO con JSON puro:
{
  "prodotti": [{"brand":"...","codice_aams":"...","qty":1}],
  "scadenza_label": "Mercoledì 23 Apr" oppure null,
  "scadenza_data": "2026-04-23" oppure null,
  "testo_pulito": "versione pulita della nota senza date"
}

Per le date relative usa oggi come riferimento: ${new Date().toISOString().split('T')[0]}
"mercoledi prossimo" = il mercoledi piu vicino nel futuro
"settimana prossima" = +7 giorni da oggi`,
      messages: [{ role: 'user', content: testo }],
    });

    let testo_risposta = risposta.content[0].text.trim();
    testo_risposta = testo_risposta.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const analisi = JSON.parse(testo_risposta);

    const { data, error } = await supabase.from('note').insert({
      session_id,
      testo: analisi.testo_pulito || testo,
      prodotti: analisi.prodotti,
      scadenza_data: analisi.scadenza_data,
      scadenza_label: analisi.scadenza_label,
      completata: false
    }).select().single();

    if (error) throw error;
    res.json({ successo: true, nota: data });
  } catch (err) {
    console.error('Errore nota:', err.message);
    res.status(500).json({ errore: 'Errore salvataggio nota: ' + err.message });
  }
});

// ── ENDPOINT 5: Recupera note ─────────────────────────────────────────────────
app.get('/api/note/:session_id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('note')
      .select('*')
      .eq('session_id', req.params.session_id)
      .eq('completata', false)
      .order('scadenza_data', { ascending: true, nullsFirst: false });

    if (error) throw error;
    res.json({ successo: true, note: data });
  } catch (err) {
    res.status(500).json({ errore: err.message });
  }
});

// ── ENDPOINT 6: Completa nota ─────────────────────────────────────────────────
app.patch('/api/note/:id', async (req, res) => {
  try {
    const { error } = await supabase
      .from('note')
      .update({ completata: true })
      .eq('id', req.params.id);

    if (error) throw error;
    res.json({ successo: true });
  } catch (err) {
    res.status(500).json({ errore: err.message });
  }
});

// ── ENDPOINT 7: Salva ordine completato ──────────────────────────────────────
app.post('/api/ordini', async (req, res) => {
  const { prodotti: lista, session_id } = req.body;
  if (!lista || !session_id) return res.status(400).json({ errore: 'Dati mancanti' });

  try {
    const { data, error } = await supabase.from('ordini').insert({
      session_id,
      prodotti: lista
    }).select().single();

    if (error) throw error;
    res.json({ successo: true, ordine: data });
  } catch (err) {
    res.status(500).json({ errore: err.message });
  }
});

// ── ENDPOINT 8: Recupera ultimo ordine ───────────────────────────────────────
app.get('/api/ordini/:session_id/ultimo', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('ordini')
      .select('*')
      .eq('session_id', req.params.session_id)
      .order('creato_at', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    res.json({ successo: true, ordine: data || null });
  } catch (err) {
    res.status(500).json({ errore: err.message });
  }
});

// ── ENDPOINT 9: Genera Excel ──────────────────────────────────────────────────
app.post('/api/excel', (req, res) => {
  const { prodotti: lista, data_ordine } = req.body;
  if (!lista || lista.length === 0) return res.status(400).json({ errore: 'Nessun prodotto' });

  const righe = lista
    .filter(p => p.codice_aams !== 'NON_TROVATO')
    .map(p => ({ 'Codice AAMS': p.codice_aams, 'Quantita': p.qty }));

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(righe);
  ws['!cols'] = [{ wch: 15 }, { wch: 10 }];
  XLSX.utils.book_append_sheet(wb, ws, 'Ordine');

  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  const nome = `ordine_${data_ordine || new Date().toISOString().split('T')[0]}.xlsx`;

  res.setHeader('Content-Disposition', `attachment; filename="${nome}"`);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(buffer);
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`TabaccAI backend v2 attivo su porta ${PORT}`));
