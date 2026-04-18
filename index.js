require('dotenv').config();
const express = require('express');
const cors = require('cors');
const Anthropic = require('@anthropic-ai/sdk');
const XLSX = require('xlsx');

const app = express();
app.use(cors());
app.use(express.json());

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', messaggio: 'TabaccAI backend attivo' });
});

app.post('/api/voice', async (req, res) => {
  const { testo } = req.body;
  if (!testo) return res.status(400).json({ errore: 'Nessun testo ricevuto' });

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

Formato esatto: [{"brand":"nome esatto","variante":"variante","qty":numero,"codice_aams":"codice","testo_originale":"quello detto","corretto":true}]
Se prodotto non trovato: usa "codice_aams":"NON_TROVATO"`,
      messages: [{ role: 'user', content: testo }],
    });

    let testo_risposta = risposta.content[0].text.trim();
    
    // Rimuovi backtick markdown se presenti
    testo_risposta = testo_risposta.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    
    const prodottiRiconosciuti = JSON.parse(testo_risposta);
    res.json({ successo: true, prodotti: prodottiRiconosciuti });
  } catch (err) {
    console.error('Errore:', err.message);
    res.status(500).json({ errore: 'Errore nel riconoscimento prodotti: ' + err.message });
  }
});

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
app.listen(PORT, () => console.log(`TabaccAI backend attivo su porta ${PORT}`));
