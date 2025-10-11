const express = require('express');
const cors = require('cors');
const multer = require('multer');
const Papa = require('papaparse');
const _ = require('lodash');
const path = require('path');

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../dist')));

// Mapeamentos Hotmart
const HOTMART_PRICE_MAPPINGS = {
  '997e3yhk': { product: 'Descomplica', origin: 'Ads - Page' },
  'gyy2gzop': { product: 'Descomplica', origin: 'N/A' },
  '2pzpv0td': { product: 'Descomplica', origin: 'Whatsapp Upsell' },
  '1yflbmft': { product: 'Descomplica', origin: 'Ads - Page com VSL' },
  'j5jzrlt1': { product: 'Checklist', origin: 'N/A' },
  '4oeu5x7p': { product: 'Checklist', origin: 'Bump Descomplica' },
  'xtg98r9p': { product: 'Checklist', origin: 'Bump Descomplica' },
  'oi58y3o3': { product: 'Checklist', origin: 'Ads' },
  '59um3csu': { product: 'Checklist', origin: 'Ads' },
  '7vtjjnnt': { product: 'Checklist', origin: 'Ads' },
  '024nuedz': { product: 'Checklist', origin: 'Ads' },
  'icm6fa9c': { product: 'Iluminação profissional', origin: 'N/A' },
  'jf0ztef5': { product: 'Iluminação profissional', origin: 'Bump Descomplica' },
  '460lfl63': { product: 'Iluminação profissional', origin: 'Bump Descomplica' },
  'v046zzii': { product: 'Iluminação profissional', origin: 'Ads' },
  'bzpif1xj': { product: 'Iluminação profissional', origin: 'Ads' },
  'p0d170xv': { product: 'Iluminação profissional', origin: 'Ads' },
  'touesadl': { product: 'Monitoria/Grava Simples', origin: 'N/A' },
  '38erp7wk': { product: 'Grava Simples/Consultoria', origin: 'Renata' },
  'bb391y5l': { product: 'Monitoria/Grava Simples', origin: 'N/A' },
  'hgrsrrgr': { product: 'Monitoria/Grava Simples', origin: 'Whatsapp Upsell' },
  '3wddccov': { product: 'Monitoria/Grava Simples', origin: 'Whatsapp Upsell' },
  'tx535ol2': { product: 'Monitoria/Grava Simples', origin: 'Upgrade Descomplica' },
  'jjsggcwy': { product: 'Monitoria/Grava Simples', origin: 'N/A' },
  'h9i0lur1': { product: 'Grava Simples/Consultoria', origin: 'Upgrade Descomplica' },
  'miqsmmjn': { product: 'Grava Simples/Consultoria', origin: 'Área de membros' },
  '3uh0jwrz': { product: 'Grava Simples/Consultoria', origin: 'Área de membros' },
  'vxwamur3': { product: 'Grava Simples/Consultoria', origin: 'N/A' },
  'w9allmjk': { product: 'Grava Simples/Consultoria', origin: 'N/A' },
  '775p3wjv': { product: 'Monitoria/Grava Simples', origin: 'N/A' },
  'ce8nr3lp': { product: 'Executa Infoprodutor', origin: 'Campanha' },
  'wawx8lne': { product: 'Youtube', origin: 'N/A' }
};

// Processar Hubla
function processHubla(csvText) {
  const parsed = Papa.parse(csvText, {
    header: true,
    dynamicTyping: true,
    skipEmptyLines: true
  });

  const data = parsed.data.filter(r => r['Status da fatura'] === 'Paga');
  
  const ldrSales = data.filter(r => r['Nome do produto'] === 'Laboratório de Roteiros');
  const rnpSales = data.filter(r => r['Nome do produto'] === 'Roteiros na Prática');
  
  const ldrByOrigin = {};
  ldrSales.forEach(sale => {
    const origin = getHublaOrigin(sale);
    ldrByOrigin[origin] = (ldrByOrigin[origin] || 0) + 1;
  });
  
  const rnpByOrigin = {};
  rnpSales.forEach(sale => {
    const origin = getHublaOrigin(sale);
    rnpByOrigin[origin] = (rnpByOrigin[origin] || 0) + 1;
  });
  
  const bumps = {};
  const ldrSalesWithBump = ldrSales.filter(s => s['Nome do produto de orderbump']);
  
  ldrSalesWithBump.forEach(sale => {
    const bumpNames = sale['Nome do produto de orderbump'];
    if (bumpNames) {
      const bumpList = bumpNames.split(', ');
      bumpList.forEach(bump => {
        bumps[bump] = (bumps[bump] || 0) + 1;
      });
    }
  });
  
  const bumpRates = {};
  Object.keys(bumps).forEach(bump => {
    bumpRates[bump] = ((bumps[bump] / ldrSales.length) * 100).toFixed(2) + '%';
  });
  
  const refunds = data.filter(r => r['Data de reembolso'] !== null);
  const ldrRefunds = refunds.filter(r => r['Nome do produto'] === 'Laboratório de Roteiros').length;
  const rnpRefunds = refunds.filter(r => r['Nome do produto'] === 'Roteiros na Prática').length;
  
  return {
    project: 'Perettas',
    platform: 'Hubla',
    sales: {
      ldr: {
        total: ldrSales.length,
        byOrigin: ldrByOrigin,
        refunds: ldrRefunds
      },
      rnp: {
        total: rnpSales.length,
        byOrigin: rnpByOrigin,
        refunds: rnpRefunds
      }
    },
    bumps: {
      counts: bumps,
      conversionRates: bumpRates
    }
  };
}

function getHublaOrigin(sale) {
  const origem = sale['UTM Origem'];
  const termo = sale['UTM Termo'];
  
  if (!origem || origem === 'null') return 'N/A';
  
  if (origem.toLowerCase() === 'meta-ads') return 'Trafego';
  if (origem.toLowerCase() === 'instagram' && termo) {
    return `Instagram | ${termo.charAt(0).toUpperCase() + termo.slice(1)}`;
  }
  if (origem.toLowerCase() === 'hubla') return 'Hubla | Área de membros';
  
  return 'N/A';
}

// Processar Hotmart
function processHotmart(csvText) {
  const parsed = Papa.parse(csvText, {
    header: true,
    dynamicTyping: true,
    skipEmptyLines: true
  });

  const data = parsed.data.filter(r => 
    r['Status da transação'] === 'Aprovado' || r['Status da transação'] === 'Completo'
  );
  
  const salesByProduct = {};
  const salesByOrigin = {};
  
  data.forEach(sale => {
    const priceCode = sale['Código do preço'];
    const mapping = HOTMART_PRICE_MAPPINGS[priceCode];
    
    if (!mapping) return;
    
    const { product, origin } = mapping;
    
    salesByProduct[product] = (salesByProduct[product] || 0) + 1;
    
    if (!salesByOrigin[product]) salesByOrigin[product] = {};
    salesByOrigin[product][origin] = (salesByOrigin[product][origin] || 0) + 1;
  });
  
  const bumpSales = data.filter(r => 
    r['Transação do Produto Principal'] && 
    r['Transação do Produto Principal'] !== '(none)'
  );
  
  const checklistBumps = bumpSales.filter(r => 
    r['Produto'] === 'Checklist Completo para Gravação Profissional'
  ).length;
  
  const iluminacaoBumps = bumpSales.filter(r => 
    r['Produto'] === 'Transforme suas aulas com iluminação profissional'
  ).length;
  
  const descomplicaTotal = salesByProduct['Descomplica'] || 0;
  
  const bumpRates = {
    'Checklist - Descomplica': ((checklistBumps / descomplicaTotal) * 100).toFixed(2) + '%',
    'Iluminação - Descomplica': ((iluminacaoBumps / descomplicaTotal) * 100).toFixed(2) + '%'
  };
  
  return {
    project: 'Grava Simples',
    platform: 'Hotmart',
    sales: salesByProduct,
    salesByOrigin: salesByOrigin,
    bumpRates: bumpRates
  };
}

// Endpoints
app.post('/api/process/hubla', upload.single('file'), (req, res) => {
  try {
    const csvText = req.file.buffer.toString('utf-8');
    const result = processHubla(csvText);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/process/hotmart', upload.single('file'), (req, res) => {
  try {
    const csvText = req.file.buffer.toString('utf-8');
    const result = processHotmart(csvText);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../dist/index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
