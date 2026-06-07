require('dotenv').config();
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const Anthropic = require('@anthropic-ai/sdk');
const XLSX = require('xlsx');
const { createClient } = require('@supabase/supabase-js');
const { Resend } = require('resend');
const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');
const { catalogo } = require('./catalogo');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const resend = new Resend(process.env.RESEND_API_KEY);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
<<<<<<< Updated upstream
=======

const TOKEN_SECRET = process.env.TOKEN_SECRET || 'tabaccai_dev_secret_change_in_prod';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

// ── AUTH HELPERS ──────────────────────────────────────────────────────────────
function generaTokenMagico(email) {
  const ts = Date.now().toString();
  const payload = `${email.toLowerCase().trim()}|${ts}`;
  const firma = crypto.createHmac('sha256', TOKEN_SECRET).update(payload).digest('hex');
  return Buffer.from(`${payload}|${firma}`).toString('base64url');
}

function verificaTokenMagico(token) {
  try {
    const decoded = Buffer.from(token, 'base64url').toString('utf8');
    const parti = decoded.split('|');
    if (parti.length !== 3) return null;
    const [email, ts, firma] = parti;
    if (Date.now() - parseInt(ts) > 48 * 3600 * 1000) return null; // scaduto dopo 48h
    const firmaAttesa = crypto.createHmac('sha256', TOKEN_SECRET).update(`${email}|${ts}`).digest('hex');
    if (!crypto.timingSafeEqual(Buffer.from(firma, 'hex'), Buffer.from(firmaAttesa, 'hex'))) return null;
    return email;
  } catch { return null; }
}
>>>>>>> Stashed changes

const catalogoStringa = catalogo.map(p =>
  `${p.brand} (${p.variante}) - AAMS: ${p.codice_aams} - ${p.prezzo_pacchetto}/pacco`
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
2. Le quantita sono in STECCHE
3. "morbide/soft/cartoccio" = cerca variante Soft dello stesso brand
4. Rispondi SOLO con JSON array puro
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
<<<<<<< Updated upstream
  res.json({ status: 'ok', messaggio: 'TabaccAI backend v7', prodotti: catalogo.length });
=======
  res.json({ status: 'ok', messaggio: 'TabaccAI backend v8', prodotti: catalogo.length });
});

// ── AUTH ──────────────────────────────────────────────────────────────────────
app.post('/api/auth/login', async (req, res) => {
  const { email } = req.body;
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return res.status(400).json({ errore: 'Inserisci un indirizzo email valido' });
  }
  const emailPulita = email.toLowerCase().trim();
  const token = generaTokenMagico(emailPulita);
  const link = `${FRONTEND_URL}/index.html?token=${token}`;
  try {
    await resend.emails.send({
      from: 'TabaccAI <onboarding@resend.dev>',
      to: emailPulita,
      subject: '🔑 Il tuo link di accesso a TabaccAI',
      html: `<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto">
        <div style="background:#3A1A08;padding:28px;border-radius:14px 14px 0 0;text-align:center">
          <h1 style="color:white;font-size:32px;margin:0;letter-spacing:-0.5px">
            Tabacc<span style="color:#C9973A">AI</span>
          </h1>
        </div>
        <div style="background:white;padding:40px 36px;border:1px solid #E8E0D5;border-radius:0 0 14px 14px;text-align:center">
          <h2 style="color:#3A1A08;font-size:24px;margin:0 0 16px;font-weight:700">
            Ecco il tuo link di accesso
          </h2>
          <p style="color:#555;font-size:17px;line-height:1.7;margin:0 0 32px">
            Clicca il pulsante qui sotto per entrare in TabaccAI.<br>
            <strong>Il link è valido per 48 ore.</strong>
          </p>
          <a href="${link}"
            style="display:inline-block;background:#3A1A08;color:white;text-decoration:none;
                   padding:20px 48px;border-radius:12px;font-size:20px;font-weight:700;
                   letter-spacing:0.3px;line-height:1">
            Entra in TabaccAI →
          </a>
          <p style="color:#aaa;font-size:13px;margin:28px 0 0;line-height:1.6">
            Se il pulsante non funziona, copia e incolla questo link nel browser:<br>
            <span style="color:#3A1A08;font-size:12px;word-break:break-all">${link}</span>
          </p>
          <p style="color:#ccc;font-size:12px;margin-top:20px">
            Non hai richiesto questo accesso? Ignora questa email.
          </p>
        </div>
      </div>`,
    });
    res.json({ successo: true });
  } catch (err) {
    console.error('Errore magic link:', err.message);
    res.status(500).json({ errore: 'Errore invio email. Riprova tra qualche istante.' });
  }
});

app.post('/api/auth/verify', async (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ errore: 'Token mancante' });
  const email = verificaTokenMagico(token);
  if (!email) return res.status(401).json({ errore: 'Link non valido o scaduto. Richiedi un nuovo link di accesso.' });
  const session_id = 'u_' + crypto.createHash('sha256').update(email).digest('hex').slice(0, 14);
  // Salva/aggiorna utente in Supabase
  await supabase.from('ordine_corrente').upsert({
    session_id, email, aggiornato_at: new Date().toISOString()
  }, { onConflict: 'session_id' }).catch(() => {});
  res.json({ successo: true, email, session_id });
>>>>>>> Stashed changes
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
    const oggi = new Date().toISOString().split('T')[0];
    const risposta = await anthropic.messages.create({
      model: 'claude-sonnet-4-5', max_tokens: 512,
      system: 'Analizza questa nota di un tabaccaio. Oggi: ' + oggi + '\nRispondi SOLO con JSON puro:\n{"prodotti":[{"brand":"...","codice_aams":"...","qty":1}],"scadenza_label":"Mercoledi 23 Apr" o null,"scadenza_data":"2026-04-23" o null,"testo_pulito":"nota senza date"}',
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
  const { prodotti: lista, data_ordine, session_id } = req.body;
  if (!lista || lista.length === 0) return res.status(400).json({ errore: 'Nessun prodotto' });
  const validi = lista.filter(p => p.codice_aams !== 'NON_TROVATO');
  let totale_tabaccaio = 0, totale_peso_kg = 0;
  const data = data_ordine || new Date().toISOString().split('T')[0];
<<<<<<< Updated upstream
=======

>>>>>>> Stashed changes
  const righeRiepilogo = validi.map(p => {
    const prezzi = calcolaPrezzoProdotto(p, p.qty);
    if (prezzi) { totale_tabaccaio += prezzi.totale_tabaccaio; totale_peso_kg += prezzi.peso_totale_kg; }
    return { 'Codice AAMS': p.codice_aams, 'Descrizione': p.brand + (p.variante ? ' (' + p.variante + ')' : ''), 'Stecche': p.qty, 'Kgc': prezzi ? prezzi.quantita_kgc : '', 'Prezzo Stecca (EUR)': prezzi ? prezzi.prezzo_stecca_tabaccaio : '', 'Totale (EUR)': prezzi ? prezzi.totale_tabaccaio : '', 'Peso Stecca (g)': prezzi ? prezzi.peso_stecca_g : '', 'Peso Totale (kg)': prezzi ? prezzi.peso_totale_kg : '' };
  });
<<<<<<< Updated upstream
  righeRiepilogo.push({ 'Codice AAMS': '', 'Descrizione': 'TOTALE ORDINE', 'Stecche': validi.reduce((s,p)=>s+(p.qty||0),0), 'Kgc': parseFloat(totale_peso_kg.toFixed(3)), 'Prezzo Stecca (EUR)': '', 'Totale (EUR)': parseFloat(totale_tabaccaio.toFixed(2)), 'Peso Stecca (g)': '', 'Peso Totale (kg)': parseFloat(totale_peso_kg.toFixed(3)) });
=======
  righeRiepilogo.push({
    'Codice AAMS': '', 'Descrizione': 'TOTALE ORDINE',
    'Stecche': validi.reduce((s,p)=>s+(p.qty||0),0),
    'Kgc': parseFloat(totale_peso_kg.toFixed(3)),
    'Prezzo Stecca (EUR)': '',
    'Totale (EUR)': parseFloat(totale_tabaccaio.toFixed(2)),
    'Peso Stecca (g)': '', 'Peso Totale (kg)': parseFloat(totale_peso_kg.toFixed(3)),
  });

>>>>>>> Stashed changes
  const righeLogista = validi.map(p => {
    const prod = catalogo.find(c => c.codice_aams === p.codice_aams);
    const kgc = prod ? parseFloat((prod.unita_minima_kgc * p.qty).toFixed(3)) : parseFloat((p.qty * 0.2).toFixed(3));
    return { 'Codice AAMS': p.codice_aams, 'Quantita': kgc };
  });
<<<<<<< Updated upstream
=======

>>>>>>> Stashed changes
  const wbDownload = XLSX.utils.book_new();
  const wsLogista = XLSX.utils.json_to_sheet(righeLogista);
  wsLogista['!cols'] = [{ wch: 11.8 }, { wch: 8.3 }];
  XLSX.utils.book_append_sheet(wbDownload, wsLogista, 'Sheet1');
<<<<<<< Updated upstream
  const bufferDownload = XLSX.write(wbDownload, { type: 'buffer', bookType: 'xlsx' });
=======
  const bufferDownload = XLSX.write(wbDownload, { type: 'buffer', bookType: 'xlsx', cellStyles: true });

>>>>>>> Stashed changes
  const wbEmail = XLSX.utils.book_new();
  const wsRiepilogo = XLSX.utils.json_to_sheet(righeRiepilogo);
  wsRiepilogo['!cols'] = [{wch:14},{wch:32},{wch:9},{wch:8},{wch:18},{wch:14},{wch:16},{wch:16}];
  XLSX.utils.book_append_sheet(wbEmail, wsRiepilogo, 'Riepilogo');
  const bufferEmail = XLSX.write(wbEmail, { type: 'buffer', bookType: 'xlsx' });
<<<<<<< Updated upstream
  try {
    await resend.emails.send({
      from: 'TabaccAI <onboarding@resend.dev>',
      to: 'edoardogiannini4@gmail.com',
      subject: 'Riepilogo ordine TabaccAI — ' + data,
      html: '<h2>Riepilogo ordine del ' + data + '</h2><p><strong>' + validi.length + ' prodotti</strong></p><p>Totale tabaccaio (90%): <strong>EUR ' + totale_tabaccaio.toFixed(2) + '</strong></p>',
      attachments: [{ filename: 'riepilogo_ordine_' + data + '.xlsx', content: bufferEmail.toString('base64') }],
    });
  } catch (emailErr) { console.error('Errore invio email:', emailErr.message); }
=======

  // Invia email riepilogo all'email dell'utente, se disponibile
  try {
    let emailUtente = null;
    if (session_id) {
      const { data: sessione } = await supabase
        .from('ordine_corrente')
        .select('email')
        .eq('session_id', session_id)
        .single();
      emailUtente = sessione?.email || null;
    }
    if (emailUtente) {
      await resend.emails.send({
        from: 'TabaccAI <onboarding@resend.dev>',
        to: emailUtente,
        subject: 'Riepilogo ordine TabaccAI — ' + data,
        html: '<h2>Riepilogo ordine del ' + data + '</h2><p><strong>' + validi.length + ' prodotti</strong> — ' + validi.reduce((s,p)=>s+(p.qty||0),0) + ' stecche totali</p><p>Totale tabaccaio (90%): <strong>EUR ' + totale_tabaccaio.toFixed(2) + '</strong></p><p>Peso totale: ' + totale_peso_kg.toFixed(2) + ' kg</p><br><p>Il file Upload Logista è stato scaricato sul dispositivo.</p>',
        attachments: [{
          filename: 'riepilogo_ordine_' + data + '.xlsx',
          content: bufferEmail.toString('base64'),
        }],
      });
      console.log('Email riepilogo inviata a ' + emailUtente + ' per ordine del ' + data);
    }
  } catch (emailErr) {
    console.error('Errore invio email:', emailErr.message);
  }

>>>>>>> Stashed changes
  const nome = 'ordine_logista_' + data + '.xlsx';
  res.setHeader('Content-Disposition', 'attachment; filename="' + nome + '"');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(bufferDownload);
});

<<<<<<< Updated upstream
=======
// ENDPOINT: Salva ordine in corso
>>>>>>> Stashed changes
app.post('/api/ordine-corrente', async (req, res) => {
  const { prodotti, session_id } = req.body;
  if (!session_id) return res.status(400).json({ errore: 'Session ID mancante' });
  try {
    const { error } = await supabase.from('ordine_corrente').upsert({ session_id, prodotti: prodotti || [], aggiornato_at: new Date().toISOString() }, { onConflict: 'session_id' });
    if (error) throw error;
    res.json({ successo: true });
  } catch (err) { res.status(500).json({ errore: err.message }); }
});

app.get('/api/ordine-corrente/:session_id', async (req, res) => {
  try {
    const { data, error } = await supabase.from('ordine_corrente').select('*').eq('session_id', req.params.session_id).single();
    if (error && error.code !== 'PGRST116') throw error;
    res.json({ successo: true, ordine: data || null });
  } catch (err) { res.status(500).json({ errore: err.message }); }
});

app.delete('/api/ordine-corrente/:session_id', async (req, res) => {
  try {
    const { error } = await supabase.from('ordine_corrente').delete().eq('session_id', req.params.session_id);
    if (error) throw error;
    res.json({ successo: true });
  } catch (err) { res.status(500).json({ errore: err.message }); }
});

<<<<<<< Updated upstream
=======
// ── NUOVO: Whisper transcription (fallback per Chrome iOS) ──
>>>>>>> Stashed changes
app.post('/api/whisper', async (req, res) => {
  const { audio_base64, mime_type, session_id } = req.body;
  if (!audio_base64) return res.status(400).json({ errore: 'Audio mancante' });
  try {
<<<<<<< Updated upstream
    const ext = mime_type && mime_type.includes('webm') ? 'webm' : mime_type && mime_type.includes('mp4') ? 'mp4' : 'webm';
    const tmpFile = path.join('/tmp', 'audio_' + Date.now() + '.' + ext);
=======
    const ext = mime_type?.includes('webm') ? 'webm' : mime_type?.includes('mp4') ? 'mp4' : 'webm';
    const tmpFile = path.join('/tmp', `audio_${Date.now()}.${ext}`);
>>>>>>> Stashed changes
    fs.writeFileSync(tmpFile, Buffer.from(audio_base64, 'base64'));
    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(tmpFile),
      model: 'whisper-1',
      language: 'it',
      response_format: 'text'
    });
    fs.unlinkSync(tmpFile);
    res.json({ testo: transcription.trim() });
  } catch (err) {
    console.error('Errore Whisper:', err.message);
    res.status(500).json({ errore: err.message });
  }
});

<<<<<<< Updated upstream
=======
// ── NUOVO: Invia Excel via email al tabaccaio ──
>>>>>>> Stashed changes
app.post('/api/excel-email', async (req, res) => {
  const { prodotti: lista, email, data_ordine, session_id } = req.body;
  if (!lista || !email) return res.status(400).json({ errore: 'Prodotti e email obbligatori' });
  try {
    const validi = lista.filter(p => p.codice_aams !== 'NON_TROVATO');
    const data = data_ordine || new Date().toISOString().split('T')[0];
    let totale_tabaccaio = 0, totale_peso_kg = 0;
<<<<<<< Updated upstream
=======

>>>>>>> Stashed changes
    const righeLogista = validi.map(p => {
      const prod = catalogo.find(c => c.codice_aams === p.codice_aams);
      const prezzi = calcolaPrezzoProdotto(p, p.qty);
      if (prezzi) { totale_tabaccaio += prezzi.totale_tabaccaio; totale_peso_kg += prezzi.peso_totale_kg; }
      const kgc = prod ? parseFloat((prod.unita_minima_kgc * p.qty).toFixed(3)) : parseFloat((p.qty * 0.2).toFixed(3));
      return { 'Codice AAMS': p.codice_aams, 'Quantita': kgc };
    });
<<<<<<< Updated upstream
    const righeRiepilogo = validi.map(p => {
      const prezzi = calcolaPrezzoProdotto(p, p.qty);
      return { 'Prodotto': p.brand + (p.variante ? ' (' + p.variante + ')' : ''), 'Stecche': p.qty, 'Costo (EUR)': prezzi ? prezzi.totale_tabaccaio : '' };
    });
=======

    const righeRiepilogo = validi.map(p => {
      const prezzi = calcolaPrezzoProdotto(p, p.qty);
      return {
        'Prodotto': p.brand + (p.variante ? ' (' + p.variante + ')' : ''),
        'Stecche': p.qty,
        'Costo (EUR)': prezzi ? prezzi.totale_tabaccaio : '',
      };
    });

>>>>>>> Stashed changes
    const wb = XLSX.utils.book_new();
    const wsLogista = XLSX.utils.json_to_sheet(righeLogista);
    wsLogista['!cols'] = [{ wch: 11.8 }, { wch: 8.3 }];
    XLSX.utils.book_append_sheet(wb, wsLogista, 'Sheet1');
    const wsRiep = XLSX.utils.json_to_sheet(righeRiepilogo);
    XLSX.utils.book_append_sheet(wb, wsRiep, 'Riepilogo');
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
<<<<<<< Updated upstream
    const nomeFile = 'ordine_logista_' + data + '.xlsx';
    await resend.emails.send({
      from: 'TabaccAI <onboarding@resend.dev>',
      to: [email],
      subject: 'Ordine TabaccAI — ' + data,
      html: '<div style="font-family:sans-serif;max-width:600px;margin:0 auto"><div style="background:#3A1A08;padding:20px;border-radius:10px 10px 0 0"><h1 style="color:white;margin:0;font-size:24px">Tabacc<span style="color:#C9973A">AI</span></h1></div><div style="background:white;padding:24px;border:1px solid #E8E0D5;border-top:none;border-radius:0 0 10px 10px"><h2 style="color:#3A1A08;margin:0 0 12px">Il tuo ordine e pronto!</h2><p style="color:#555;font-size:15px;line-height:1.6">In allegato: <strong>' + validi.length + ' prodotti</strong>, ' + validi.reduce(function(s,p){return s+(p.qty||0)},0) + ' stecche<br>Totale: <strong>EUR ' + totale_tabaccaio.toFixed(2) + '</strong> - Peso: ' + totale_peso_kg.toFixed(2) + ' kg</p><div style="background:#EAF4EE;border:1px solid #C3E6CB;border-radius:8px;padding:14px;margin:16px 0"><strong style="color:#1A6E3A">Come caricare su Logista:</strong><ol style="color:#555;font-size:14px;margin:8px 0 0;padding-left:20px;line-height:1.8"><li>Salva il file allegato sul desktop</li><li>Vai su logistaitalia.it - Ordini</li><li>Clicca Carica da file Excel</li><li>Seleziona il file e conferma</li></ol></div></div></div>',
      attachments: [{ filename: nomeFile, content: buffer.toString('base64') }],
    });
    if (session_id) {
      await supabase.from('ordini').insert({ session_id, prodotti: lista }).catch(console.error);
    }
=======

    const nomeFile = 'ordine_logista_' + data + '.xlsx';

    await resend.emails.send({
      from: 'TabaccAI <onboarding@resend.dev>',
      to: [email],
      subject: '📦 Ordine TabaccAI — ' + data,
      html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto">
        <div style="background:#3A1A08;padding:20px;border-radius:10px 10px 0 0">
          <h1 style="color:white;margin:0;font-size:24px">Tabacc<span style="color:#C9973A">AI</span></h1>
        </div>
        <div style="background:white;padding:24px;border:1px solid #E8E0D5;border-top:none;border-radius:0 0 10px 10px">
          <h2 style="color:#3A1A08;margin:0 0 12px">Il tuo ordine è pronto!</h2>
          <p style="color:#555;font-size:15px;line-height:1.6">
            In allegato: <strong>${validi.length} prodotti</strong>, ${validi.reduce((s,p)=>s+(p.qty||0),0)} stecche<br>
            Totale: <strong>€ ${totale_tabaccaio.toFixed(2)}</strong> · Peso: ${totale_peso_kg.toFixed(2)} kg
          </p>
          <div style="background:#EAF4EE;border:1px solid #C3E6CB;border-radius:8px;padding:14px;margin:16px 0">
            <strong style="color:#1A6E3A">Come caricare su Logista:</strong>
            <ol style="color:#555;font-size:14px;margin:8px 0 0;padding-left:20px;line-height:1.8">
              <li>Salva il file allegato sul desktop</li>
              <li>Vai su <strong>logistaitalia.it</strong> → Ordini</li>
              <li>Clicca "Carica da file Excel"</li>
              <li>Seleziona il file e conferma</li>
            </ol>
          </div>
          <p style="color:#888;font-size:12px;margin-top:16px">Generato da TabaccAI — ${new Date().toLocaleString('it-IT')}</p>
        </div>
      </div>`,
      attachments: [{ filename: nomeFile, content: buffer.toString('base64') }],
    });

    if (session_id) {
      await supabase.from('ordini').insert({ session_id, prodotti: lista }).catch(console.error);
    }

>>>>>>> Stashed changes
    res.json({ successo: true, messaggio: 'Email inviata a ' + email });
  } catch (err) {
    console.error('Errore excel-email:', err.message);
    res.status(500).json({ errore: err.message });
  }
});

<<<<<<< Updated upstream
=======
// ── NUOVO: Salva email utente ──
>>>>>>> Stashed changes
app.post('/api/utente/email', async (req, res) => {
  const { session_id, email } = req.body;
  if (!session_id || !email) return res.json({ errore: 'Dati mancanti' });
  try {
<<<<<<< Updated upstream
    await supabase.from('ordine_corrente').upsert({ session_id, email, aggiornato_at: new Date().toISOString() }, { onConflict: 'session_id' }).catch(console.error);
=======
    await supabase.from('ordine_corrente').upsert({
      session_id, email, aggiornato_at: new Date().toISOString()
    }, { onConflict: 'session_id' }).catch(console.error);
>>>>>>> Stashed changes
    res.json({ successo: true });
  } catch (err) { res.json({ errore: err.message }); }
});

const PORT = process.env.PORT || 3001;
<<<<<<< Updated upstream
app.listen(PORT, function() { console.log('TabaccAI v7 — ' + catalogo.length + ' prodotti — porta ' + PORT); });
=======
app.listen(PORT, () => console.log(`TabaccAI v7 — ${catalogo.length} prodotti — porta ${PORT}`));
>>>>>>> Stashed changes
