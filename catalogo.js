const XLSX = require('xlsx');
const path = require('path');

function caricaCatalogo() {
  try {
    const wb = XLSX.readFile(path.join(__dirname, 'catalogo_logista.xls'));
    const ws = wb.Sheets[wb.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(ws);

    const tipologieUtili = ['SIGARETTE', 'TABACCO SENZA COMBUSTIONE', 'TRINCIATI PER SIGARETTE'];

    return data
      .filter(r => tipologieUtili.includes(r['Tipologia']))
      .map(r => {
        const desc = (r['Descrizione'] || '').trim();
        const codice = (r['Codice AAMS'] || '').toString().trim();
        const unitaKgc = parseFloat(r['Unita Minima [Kgc]']) || 0.2;
        const prezzoKgc = parseFloat(r['Prezzo Lordo [Euro/Kgc]']) || 0;
        const prezzoStecca = prezzoKgc * unitaKgc;
        const prezzo_pacchetto = parseFloat((prezzoStecca / 10).toFixed(2));
        const peso_stecca_g = Math.round(unitaKgc * 1000);

        // Pulisci brand
        let brand = desc;
        for (const s of ['*AST20','*CART20','*20PZ','*10PZ','*5PZ','*30GR','*40GR','*70GR','*50GR','*20 PZ']) {
          brand = brand.replace(s, '');
        }
        brand = brand.trim();

        // Variante
        let variante = 'KS 20';
        if (desc.includes('*CART20')) variante = 'Soft 20';
        else if (desc.includes('100S') || desc.includes("100'S") || desc.includes('100s')) variante = '100s 20';
        else if (desc.includes('30GR') || desc.includes('30G')) variante = 'Busta 30g';
        else if (desc.includes('40GR') || desc.includes('40G')) variante = 'Busta 40g';
        else if (desc.includes('70GR') || desc.includes('70G')) variante = 'Busta 70g';
        else if (desc.includes('10PZ')) variante = 'Conf. 10';
        else if (desc.includes('5PZ')) variante = 'Conf. 5';

        return {
          brand,
          variante,
          codice_aams: codice,
          descrizione_logista: desc,
          tipologia: r['Tipologia'],
          prezzo_pacchetto,
          peso_stecca_g,
          unita_minima_kgc: unitaKgc,
          pezzi_per_stecca: 10,
          alias: [],
        };
      });
  } catch (err) {
    console.error('Errore caricamento catalogo XLS:', err.message);
    return [];
  }
}

const catalogo = caricaCatalogo();
console.log(`Catalogo caricato: ${catalogo.length} prodotti`);

module.exports = { catalogo };
