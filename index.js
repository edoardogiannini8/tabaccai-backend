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

// ── CATALOGO COMPLETO — prezzi al 15 aprile 2026 ────────────────────────────
// prezzo_pacchetto = prezzo al pubblico (€)
// peso_stecca_g = peso in grammi di una stecca (10 pacchetti)
// pezzi_per_stecca = di solito 10 pacchetti, alcuni formati diversi
const catalogo = [
  // ── MARLBORO ──
  { brand: "Marlboro Gold", variante: "KS 20", codice_aams: "8001185", alias: ["malboro gold","marbolo gold","marlboro dorata","malboro dorata"], prezzo_pacchetto: 6.80, peso_stecca_g: 220, pezzi_per_stecca: 10 },
  { brand: "Marlboro Rosse", variante: "KS 20", codice_aams: "8001180", alias: ["malboro rosse","marlboro red","malboro rosso","malboro rossa"], prezzo_pacchetto: 6.80, peso_stecca_g: 220, pezzi_per_stecca: 10 },
  { brand: "Marlboro White", variante: "KS 20", codice_aams: "8001188", alias: ["malboro white","marlboro bianche","malboro bianca"], prezzo_pacchetto: 6.80, peso_stecca_g: 210, pezzi_per_stecca: 10 },
  { brand: "Marlboro Silver", variante: "KS 20", codice_aams: "8001190", alias: ["malboro silver","marlboro silver","malboro argento"], prezzo_pacchetto: 6.80, peso_stecca_g: 200, pezzi_per_stecca: 10 },
  { brand: "Marlboro Touch", variante: "KS 20", codice_aams: "8001192", alias: ["malboro touch","marlboro touch"], prezzo_pacchetto: 6.50, peso_stecca_g: 200, pezzi_per_stecca: 10 },
  { brand: "Marlboro Gold Pocket Pack", variante: "KS 10", codice_aams: "8001186", alias: ["malboro gold pocket","marlboro pocket","malboro piccola","marlboro da 10"], prezzo_pacchetto: 3.50, peso_stecca_g: 120, pezzi_per_stecca: 10 },

  // ── CHESTERFIELD ──
  { brand: "Chesterfield Blue", variante: "KS 20", codice_aams: "8004221", alias: ["chestefild blu","chesterfield blu","cesterfield blue","chester blue","chester blu","chesterfild blue"], prezzo_pacchetto: 5.80, peso_stecca_g: 200, pezzi_per_stecca: 10 },
  { brand: "Chesterfield Original", variante: "KS 20", codice_aams: "8004220", alias: ["chestefild rosse","chesterfield rosse","chester rosse","chesterfild red","cesterfield","chester original","chesterfield red"], prezzo_pacchetto: 5.80, peso_stecca_g: 200, pezzi_per_stecca: 10 },
  { brand: "Chesterfield Black", variante: "KS 20", codice_aams: "8004225", alias: ["chester black","chesterfield black","chestefild black"], prezzo_pacchetto: 5.80, peso_stecca_g: 200, pezzi_per_stecca: 10 },
  { brand: "Chesterfield Silver", variante: "KS 20", codice_aams: "8004223", alias: ["chester silver","chesterfield silver","chestefild silver"], prezzo_pacchetto: 5.50, peso_stecca_g: 195, pezzi_per_stecca: 10 },

  // ── CAMEL ──
  { brand: "Camel Yellow", variante: "KS 20", codice_aams: "8002034", alias: ["camel gialle","camel yellow","camel classiche","cammel gialle","camel giallo"], prezzo_pacchetto: 6.30, peso_stecca_g: 215, pezzi_per_stecca: 10 },
  { brand: "Camel Blue", variante: "KS 20", codice_aams: "8002035", alias: ["camel blu","camel blue","cammel blu","camel light"], prezzo_pacchetto: 6.30, peso_stecca_g: 210, pezzi_per_stecca: 10 },
  { brand: "Camel White", variante: "KS 20", codice_aams: "8002038", alias: ["camel white","camel bianche","camel bianco"], prezzo_pacchetto: 6.30, peso_stecca_g: 205, pezzi_per_stecca: 10 },
  { brand: "Camel Activate", variante: "KS 20", codice_aams: "8002040", alias: ["camel activate","camel activ","camel mentol","camel con la pallina","cammel activate","camel menta"], prezzo_pacchetto: 6.30, peso_stecca_g: 215, pezzi_per_stecca: 10 },
  { brand: "Camel Activate Double", variante: "KS 20", codice_aams: "8002041", alias: ["camel activate double","camel double","camel doppia pallina"], prezzo_pacchetto: 6.30, peso_stecca_g: 215, pezzi_per_stecca: 10 },

  // ── WINSTON ──
  { brand: "Winston Red", variante: "KS 20", codice_aams: "8003567", alias: ["winston rosse","winston red","vinston rosse","wiston red","uinston rosse"], prezzo_pacchetto: 5.80, peso_stecca_g: 205, pezzi_per_stecca: 10 },
  { brand: "Winston Blue", variante: "KS 20", codice_aams: "8003568", alias: ["winston blu","winston blue","vinston blu","wiston blue","uinston blu"], prezzo_pacchetto: 5.80, peso_stecca_g: 200, pezzi_per_stecca: 10 },
  { brand: "Winston Silver", variante: "KS 20", codice_aams: "8003570", alias: ["winston silver","winston argento","vinston silver"], prezzo_pacchetto: 5.80, peso_stecca_g: 195, pezzi_per_stecca: 10 },

  // ── PHILIP MORRIS ──
  { brand: "Philip Morris Blue", variante: "KS 20", codice_aams: "8005110", alias: ["philip morris blu","filippo morris blu","filip morris blue","pm blue","pm blu","filtrini blu"], prezzo_pacchetto: 5.50, peso_stecca_g: 200, pezzi_per_stecca: 10 },
  { brand: "Philip Morris Red", variante: "KS 20", codice_aams: "8005111", alias: ["philip morris rosse","filippo morris rosse","filip morris red","pm rosse","filtrini","pm red","philip morris rosso"], prezzo_pacchetto: 5.80, peso_stecca_g: 205, pezzi_per_stecca: 10 },
  { brand: "Philip Morris Azure", variante: "KS 20", codice_aams: "8005115", alias: ["philip morris azure","pm azure","philip morris azzurre"], prezzo_pacchetto: 5.50, peso_stecca_g: 195, pezzi_per_stecca: 10 },

  // ── LUCKY STRIKE ──
  { brand: "Lucky Strike Original", variante: "KS 20", codice_aams: "8006234", alias: ["lucky strike","lucky rosse","laki strike","lucky classiche","lucky originale"], prezzo_pacchetto: 5.50, peso_stecca_g: 200, pezzi_per_stecca: 10 },
  { brand: "Lucky Strike Amber", variante: "KS 20", codice_aams: "8006235", alias: ["lucky amber","lucky strike amber","laki amber","lucky gialle","lucky dorate"], prezzo_pacchetto: 5.50, peso_stecca_g: 195, pezzi_per_stecca: 10 },

  // ── PALL MALL ──
  { brand: "Pall Mall Blue", variante: "KS 20", codice_aams: "8007123", alias: ["pall mall blu","pallmall blue","pal mal blu","pall mall light"], prezzo_pacchetto: 5.30, peso_stecca_g: 200, pezzi_per_stecca: 10 },
  { brand: "Pall Mall Red", variante: "KS 20", codice_aams: "8007120", alias: ["pall mall rosse","pallmall red","pal mal rosse","pall mall rosso"], prezzo_pacchetto: 5.30, peso_stecca_g: 200, pezzi_per_stecca: 10 },

  // ── MS / NAZIONALI ──
  { brand: "MS Rosse", variante: "KS 20", codice_aams: "8008010", alias: ["emesse rosse","ms rosse","nazionali rosse","nazionale rosse","ms classic","emesse"], prezzo_pacchetto: 5.50, peso_stecca_g: 205, pezzi_per_stecca: 10 },
  { brand: "MS Blu", variante: "KS 20", codice_aams: "8008011", alias: ["emesse blu","ms blu","nazionali blu","nazionale blu","ms azzurre"], prezzo_pacchetto: 5.40, peso_stecca_g: 200, pezzi_per_stecca: 10 },

  // ── DIANA ──
  { brand: "Diana Blu", variante: "KS 20", codice_aams: "8009050", alias: ["diana blu","diana blue","diana azzurra"], prezzo_pacchetto: 5.50, peso_stecca_g: 200, pezzi_per_stecca: 10 },
  { brand: "Diana Rosse", variante: "KS 20", codice_aams: "8009051", alias: ["diana rosse","diana red","diana rosso","diana rossa"], prezzo_pacchetto: 5.50, peso_stecca_g: 200, pezzi_per_stecca: 10 },

  // ── ROTHMANS ──
  { brand: "Rothmans Blue", variante: "KS 20", codice_aams: "8010234", alias: ["rothmans blu","rothman blue","rotman blu","rothmans"], prezzo_pacchetto: 5.30, peso_stecca_g: 195, pezzi_per_stecca: 10 },
  { brand: "Rothmans Red", variante: "KS 20", codice_aams: "8010230", alias: ["rothmans rosse","rothman red","rotman rosse"], prezzo_pacchetto: 5.30, peso_stecca_g: 195, pezzi_per_stecca: 10 },

  // ── BENSON & HEDGES ──
  { brand: "Benson & Hedges Gold", variante: "KS 20", codice_aams: "8011100", alias: ["benson hedges","benson and hedges","benson gold","b&h gold","benson"], prezzo_pacchetto: 6.50, peso_stecca_g: 205, pezzi_per_stecca: 10 },

  // ── MERIT ──
  { brand: "Merit KS", variante: "KS 20", codice_aams: "8012050", alias: ["merit","merit gialle","merit ks","merit classiche"], prezzo_pacchetto: 6.20, peso_stecca_g: 200, pezzi_per_stecca: 10 },
  { brand: "Merit Bay", variante: "KS 20", codice_aams: "8012055", alias: ["merit bay","merit blu","merit bay blue"], prezzo_pacchetto: 5.50, peso_stecca_g: 195, pezzi_per_stecca: 10 },

  // ── PUEBLO ──
  { brand: "Pueblo Classic", variante: "KS 20", codice_aams: "8013010", alias: ["pueblo classic","pueblo classiche","pueblo rosse"], prezzo_pacchetto: 6.00, peso_stecca_g: 210, pezzi_per_stecca: 10 },
  { brand: "Pueblo Blue", variante: "KS 20", codice_aams: "8013011", alias: ["pueblo blue","pueblo blu","pueblo azzurre"], prezzo_pacchetto: 6.00, peso_stecca_g: 205, pezzi_per_stecca: 10 },

  // ── TOSCANELLI / SIGARI ──
  { brand: "Toscanello", variante: "Conf. 5", codice_aams: "8015010", alias: ["toscanello","toscanelli","toscano","toscanelo","toscanetti"], prezzo_pacchetto: 4.20, peso_stecca_g: 85, pezzi_per_stecca: 10 },
  { brand: "Toscanello Aroma Caffe", variante: "Conf. 5", codice_aams: "8015011", alias: ["toscanello caffe","toscanelli caffe","toscano caffe","toscanello al caffe"], prezzo_pacchetto: 4.50, peso_stecca_g: 85, pezzi_per_stecca: 10 },
  { brand: "Toscanello Aroma Vaniglia", variante: "Conf. 5", codice_aams: "8015012", alias: ["toscanello vaniglia","toscanelli vaniglia","toscano vaniglia"], prezzo_pacchetto: 4.50, peso_stecca_g: 85, pezzi_per_stecca: 10 },

  // ── HEETS / IQOS ──
  { brand: "HEETS Amber", variante: "Pack 20", codice_aams: "8020100", alias: ["heets amber","iqos amber","hites amber","hits amber","eets amber"], prezzo_pacchetto: 5.50, peso_stecca_g: 55, pezzi_per_stecca: 10 },
  { brand: "HEETS Yellow", variante: "Pack 20", codice_aams: "8020101", alias: ["heets yellow","iqos yellow","hites yellow","heets gialle"], prezzo_pacchetto: 5.50, peso_stecca_g: 55, pezzi_per_stecca: 10 },
  { brand: "HEETS Turquoise", variante: "Pack 20", codice_aams: "8020102", alias: ["heets turchese","heets turquoise","iqos turchese","hites verdi","heets verdi"], prezzo_pacchetto: 5.50, peso_stecca_g: 55, pezzi_per_stecca: 10 },
  { brand: "HEETS Bronze", variante: "Pack 20", codice_aams: "8020105", alias: ["heets bronze","heets bronzo","iqos bronze"], prezzo_pacchetto: 5.50, peso_stecca_g: 55, pezzi_per_stecca: 10 },

  // ── TEREA / IQOS ILUMA ──
  { brand: "TEREA Amber", variante: "Pack 20", codice_aams: "8021100", alias: ["terea amber","teria amber","iqos iluma amber","terea gialle"], prezzo_pacchetto: 5.50, peso_stecca_g: 50, pezzi_per_stecca: 10 },
  { brand: "TEREA Yellow", variante: "Pack 20", codice_aams: "8021101", alias: ["terea yellow","teria yellow","iqos iluma yellow","terea giallo"], prezzo_pacchetto: 5.50, peso_stecca_g: 50, pezzi_per_stecca: 10 },
  { brand: "TEREA Turquoise", variante: "Pack 20", codice_aams: "8021103", alias: ["terea turchese","teria turquoise","iqos iluma turchese"], prezzo_pacchetto: 5.50, peso_stecca_g: 50, pezzi_per_stecca: 10 },

  // ── GLO ──
  { brand: "GLO Neo Classic", variante: "Pack 20", codice_aams: "8022050", alias: ["glo neo","glo classic","neo tobacco","glo tabacco","glo classiche"], prezzo_pacchetto: 4.30, peso_stecca_g: 45, pezzi_per_stecca: 10 },
  { brand: "GLO Neo Boost", variante: "Pack 20", codice_aams: "8022051", alias: ["glo neo boost","glo boost","glo mentol"], prezzo_pacchetto: 4.30, peso_stecca_g: 45, pezzi_per_stecca: 10 },

  // ── TABACCO TRINCIATO ──
  { brand: "Drum Original", variante: "Busta 30g", codice_aams: "8030010", alias: ["drum","drum original","drum arancione","tabacco drum"], prezzo_pacchetto: 8.50, peso_stecca_g: 300, pezzi_per_stecca: 10 },
  { brand: "Golden Virginia Original", variante: "Busta 30g", codice_aams: "8030020", alias: ["golden virginia","golden virginia original","golden virginia rosse","goldenvirginia"], prezzo_pacchetto: 8.80, peso_stecca_g: 300, pezzi_per_stecca: 10 },
  { brand: "Golden Virginia Yellow", variante: "Busta 30g", codice_aams: "8030021", alias: ["golden virginia yellow","golden virginia gialle","golden virginia light"], prezzo_pacchetto: 8.80, peso_stecca_g: 300, pezzi_per_stecca: 10 },
];

const catalogoStringa = catalogo.map(p =>
  `${p.brand} (${p.variante}) - AAMS: ${p.codice_aams} - €${p.prezzo_pacchetto}/pacco - alias: ${p.alias.join(', ')}`
).join('\n');

// ── CALCOLI PREZZO ────────────────────────────────────────────────────────────
function calcolaPrezzoProdotto(prodotto, qtaStecche) {
  const p = catalogo.find(c => c.codice_aams === prodotto.codice_aams);
  if (!p) return null;
  const prezzoStecca = p.prezzo_pacchetto * p.pezzi_per_stecca;
  const prezzoTabaccaio = prezzoStecca * 0.90; // margine 10%
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

// ── HEALTH CHECK ──────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', messaggio: 'TabaccAI backend v3 attivo', prodotti: catalogo.length });
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
Catalogo prodotti disponibile (prezzi al 15 aprile 2026):
${catalogoStringa}

Regole IMPORTANTI:
1. Identifica i prodotti anche se scritti o pronunciati male
2. Associa al prodotto corretto nel catalogo usando anche gli alias
3. Le quantita sono in STECCHE (non pacchetti) — se non specificato usa 1 stecca
4. Se l'utente dice "tre" intende 3 stecche
5. Rispondi SOLO con JSON puro, SENZA backtick, SENZA markdown
6. La risposta deve iniziare con [ e finire con ]

Formato: [{"brand":"nome esatto","variante":"variante","qty":numero,"codice_aams":"codice","testo_originale":"detto","corretto":true/false}]
Se non trovato: "codice_aams":"NON_TROVATO"`,
      messages: [{ role: 'user', content: testo }],
    });

    let testo_risposta = risposta.content[0].text.trim();
    testo_risposta = testo_risposta.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const prodottiRiconosciuti = JSON.parse(testo_risposta);

    // Arricchisci con prezzi e pesi
    const prodottiArricchiti = prodottiRiconosciuti.map(p => {
      if (p.codice_aams === 'NON_TROVATO') return p;
      const prezzi = calcolaPrezzoProdotto(p, p.qty || 1);
      return { ...p, ...prezzi };
    });

    // Salva prodotti non trovati per fine tuning
    const nonTrovati = prodottiRiconosciuti.filter(p => p.codice_aams === 'NON_TROVATO');
    if (nonTrovati.length > 0 && session_id) {
      for (const p of nonTrovati) {
        await supabase.from('prodotti_sconosciuti').insert({
          testo_originale: p.testo_originale,
          session_id
        }).catch(console.error);
      }
    }

    res.json({ successo: true, prodotti: prodottiArricchiti });
  } catch (err) {
    console.error('Errore voice:', err.message);
    res.status(500).json({ errore: 'Errore nel riconoscimento prodotti: ' + err.message });
  }
});

// ── ENDPOINT 2: Modifica ordine con voce ──────────────────────────────────────
app.post('/api/modifica-ordine', async (req, res) => {
  const { testo, ordine_corrente, session_id } = req.body;
  if (!testo || !ordine_corrente) return res.status(400).json({ errore: 'Dati mancanti' });

  try {
    const ordineStringa = ordine_corrente.map(p =>
      `${p.brand} (${p.variante}) x${p.qty} stecche`
    ).join('\n');

    const risposta = await anthropic.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 1024,
      system: `Sei l'assistente AI di TabaccAI.
L'utente vuole modificare questo ordine:
${ordineStringa}

Catalogo disponibile:
${catalogoStringa}

Rispondi SOLO con JSON puro:
{"aggiunti":[{"brand":"...","variante":"...","qty":N,"codice_aams":"..."}],"rimossi":[{"brand":"...","codice_aams":"..."}],"modificati":[{"brand":"...","codice_aams":"...","nuova_qty":N}],"messaggio":"cosa ho fatto"}`,
      messages: [{ role: 'user', content: testo }],
    });

    let testo_risposta = risposta.content[0].text.trim();
    testo_risposta = testo_risposta.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const modifiche = JSON.parse(testo_risposta);

    // Arricchisci aggiunti con prezzi
    if (modifiche.aggiunti) {
      modifiche.aggiunti = modifiche.aggiunti.map(p => {
        const prezzi = calcolaPrezzoProdotto(p, p.qty || 1);
        return prezzi ? { ...p, ...prezzi } : p;
      });
    }

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

Rispondi SOLO con JSON puro:
[{"brand":"nome esatto","variante":"variante","qty":1,"codice_aams":"codice","confidenza":"alta/media/bassa"}]
Se non riconosci: "codice_aams":"NON_TROVATO"`,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: media_type || 'image/jpeg', data: immagine_base64 } },
          { type: 'text', text: 'Identifica i prodotti tabacchi in questa immagine.' }
        ]
      }],
    });

    let testo_risposta = risposta.content[0].text.trim();
    testo_risposta = testo_risposta.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const prodottiRiconosciuti = JSON.parse(testo_risposta);

    const prodottiArricchiti = prodottiRiconosciuti.map(p => {
      if (p.codice_aams === 'NON_TROVATO') return p;
      const prezzi = calcolaPrezzoProdotto(p, p.qty || 1);
      return prezzi ? { ...p, ...prezzi } : p;
    });

    const nonTrovati = prodottiRiconosciuti.filter(p => p.codice_aams === 'NON_TROVATO');
    if (nonTrovati.length > 0 && session_id) {
      await supabase.from('prodotti_sconosciuti').insert({
        testo_originale: nonTrovati.map(p => p.brand).join(', '),
        foto_base64: immagine_base64.substring(0, 500),
        session_id
      }).catch(console.error);
    }

    res.json({ successo: true, prodotti: prodottiArricchiti });
  } catch (err) {
    console.error('Errore immagine:', err.message);
    res.status(500).json({ errore: 'Errore riconoscimento immagine: ' + err.message });
  }
});

// ── ENDPOINT 4: Salva nota ────────────────────────────────────────────────────
app.post('/api/note', async (req, res) => {
  const { testo, session_id } = req.body;
  if (!testo || !session_id) return res.status(400).json({ errore: 'Dati mancanti' });

  try {
    const risposta = await anthropic.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 512,
      system: `Analizza questa nota di un tabaccaio ed estrai prodotti e scadenza.
Oggi: ${new Date().toISOString().split('T')[0]}
Catalogo (prime voci): ${catalogoStringa.split('\n').slice(0, 15).join('\n')}

Rispondi SOLO con JSON puro:
{"prodotti":[{"brand":"...","codice_aams":"...","qty":1}],"scadenza_label":"Mercoledì 23 Apr" o null,"scadenza_data":"2026-04-23" o null,"testo_pulito":"nota senza date"}`,
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
      .from('note').select('*')
      .eq('session_id', req.params.session_id)
      .eq('completata', false)
      .order('scadenza_data', { ascending: true, nullsFirst: false });
    if (error) throw error;
    res.json({ successo: true, note: data });
  } catch (err) { res.status(500).json({ errore: err.message }); }
});

// ── ENDPOINT 6: Completa nota ─────────────────────────────────────────────────
app.patch('/api/note/:id', async (req, res) => {
  try {
    const { error } = await supabase.from('note').update({ completata: true }).eq('id', req.params.id);
    if (error) throw error;
    res.json({ successo: true });
  } catch (err) { res.status(500).json({ errore: err.message }); }
});

// ── ENDPOINT 7: Salva ordine ──────────────────────────────────────────────────
app.post('/api/ordini', async (req, res) => {
  const { prodotti: lista, session_id } = req.body;
  if (!lista || !session_id) return res.status(400).json({ errore: 'Dati mancanti' });
  try {
    const { data, error } = await supabase.from('ordini').insert({ session_id, prodotti: lista }).select().single();
    if (error) throw error;
    res.json({ successo: true, ordine: data });
  } catch (err) { res.status(500).json({ errore: err.message }); }
});

// ── ENDPOINT 8: Ultimo ordine ─────────────────────────────────────────────────
app.get('/api/ordini/:session_id/ultimo', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('ordini').select('*')
      .eq('session_id', req.params.session_id)
      .order('creato_at', { ascending: false })
      .limit(1).single();
    if (error && error.code !== 'PGRST116') throw error;
    res.json({ successo: true, ordine: data || null });
  } catch (err) { res.status(500).json({ errore: err.message }); }
});

// ── ENDPOINT 9: Genera Excel formato Logista ──────────────────────────────────
app.post('/api/excel', (req, res) => {
  const { prodotti: lista, data_ordine } = req.body;
  if (!lista || lista.length === 0) return res.status(400).json({ errore: 'Nessun prodotto' });

  const prodottiValidi = lista.filter(p => p.codice_aams !== 'NON_TROVATO');

  // Calcola totali
  let totale_tabaccaio = 0;
  let totale_peso_kg = 0;

  const righe = prodottiValidi.map(p => {
    const prezzi = calcolaPrezzoProdotto(p, p.qty);
    if (prezzi) {
      totale_tabaccaio += prezzi.totale_tabaccaio;
      totale_peso_kg += prezzi.peso_totale_kg;
    }
    return {
      'Codice AAMS': p.codice_aams,
      'Descrizione': `${p.brand} ${p.variante || ''}`.trim(),
      'Stecche': p.qty,
      'Prezzo Stecca (€)': prezzi ? prezzi.prezzo_stecca_tabaccaio : '',
      'Totale (€)': prezzi ? prezzi.totale_tabaccaio : '',
      'Peso Stecca (g)': prezzi ? prezzi.peso_stecca_g : '',
      'Peso Totale (kg)': prezzi ? prezzi.peso_totale_kg : '',
    };
  });

  // Riga totale
  righe.push({
    'Codice AAMS': '',
    'Descrizione': 'TOTALE ORDINE',
    'Stecche': prodottiValidi.reduce((sum, p) => sum + (p.qty || 0), 0),
    'Prezzo Stecca (€)': '',
    'Totale (€)': parseFloat(totale_tabaccaio.toFixed(2)),
    'Peso Stecca (g)': '',
    'Peso Totale (kg)': parseFloat(totale_peso_kg.toFixed(3)),
  });

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(righe);
  ws['!cols'] = [
    { wch: 14 }, { wch: 28 }, { wch: 9 },
    { wch: 18 }, { wch: 12 },
    { wch: 16 }, { wch: 16 }
  ];

  // Stile header
  const range = XLSX.utils.decode_range(ws['!ref']);
  for (let C = range.s.c; C <= range.e.c; C++) {
    const cell = ws[XLSX.utils.encode_cell({ r: 0, c: C })];
    if (cell) cell.s = { font: { bold: true } };
  }

  XLSX.utils.book_append_sheet(wb, ws, 'Ordine');

  // Secondo foglio: solo codici AAMS per caricamento rapido Logista
  const righeLogista = prodottiValidi.map(p => ({
    'Codice AAMS': p.codice_aams,
    'Quantita': p.qty,
  }));
  const wsLogista = XLSX.utils.json_to_sheet(righeLogista);
  wsLogista['!cols'] = [{ wch: 15 }, { wch: 10 }];
  XLSX.utils.book_append_sheet(wb, wsLogista, 'Upload Logista');

  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  const nome = `ordine_tabaccai_${data_ordine || new Date().toISOString().split('T')[0]}.xlsx`;

  res.setHeader('Content-Disposition', `attachment; filename="${nome}"`);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(buffer);
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`TabaccAI backend v3 attivo su porta ${PORT} — ${catalogo.length} prodotti in catalogo`));
