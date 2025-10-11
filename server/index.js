const express = require('express');
const cors = require('cors');
const multer = require('multer');
const Papa = require('papaparse');
const _ = require('lodash');
const path = require('path');
const XLSX = require('xlsx');

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../dist')));

// FUNÇÃO PARA CONVERTER XLSX EM CSV
function xlsxToCSV(buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  return XLSX.utils.sheet_to_csv(worksheet);
}

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

// ===================================================
// CATEGORIZAÇÃO LDR 77 vs 147
// ===================================================
function categorizarVendasLDR(vendas) {
  const categorias = {
    ldr77: [],
    ldr147: [],
    outros: []
  };
  
  vendas.forEach(venda => {
    const oferta = (venda['Nome da oferta'] || '').toString().toLowerCase();
    
    // Identificar LDR 77
    if (oferta.includes('[ldr] 77') || 
        oferta.includes('[77]') || 
        oferta.includes('renovação alunos - 67') || 
        oferta.includes('renovação alunos - 97')) {
      categorias.ldr77.push(venda);
    } 
    // Identificar LDR 147
    else if (oferta.includes('[ldr] 147') || 
             oferta.includes('[147]')) {
      categorias.ldr147.push(venda);
    } 
    // Outros casos
    else {
      categorias.outros.push(venda);
    }
  });
  
  return categorias;
}

function calcularEstatisticasLDR(categorias) {
  const qtdLDR77 = categorias.ldr77.length;
  const qtdLDR147 = categorias.ldr147.length;
  const qtdOutros = categorias.outros.length;
  const totalGeral = qtdLDR77 + qtdLDR147 + qtdOutros;
  const totalPrincipal = qtdLDR77 + qtdLDR147;
  
  return {
    ldr77: {
      quantidade: qtdLDR77,
      percentual: totalPrincipal > 0 ? ((qtdLDR77 / totalPrincipal) * 100).toFixed(1) + '%' : '0%'
    },
    ldr147: {
      quantidade: qtdLDR147,
      percentual: totalPrincipal > 0 ? ((qtdLDR147 / totalPrincipal) * 100).toFixed(1) + '%' : '0%'
    },
    outros: {
      quantidade: qtdOutros
    },
    total: totalGeral
  };
}

<div className="bg-white rounded-lg shadow p-6">
  <h3 className="text-xl font-bold mb-4 text-gray-800">💎 Bumps - Taxa de Conversão</h3>
  
  {/* Bumps Geral */}
  <div className="mb-4">
    <h4 className="font-semibold text-sm text-gray-600 mb-2">📊 Geral (Todos os LDR)</h4>
    <div className="space-y-2">
      {Object.entries(results.bumps.conversionRates).map(([bump, rate]) => (
        <div key={bump} className="flex justify-between items-center bg-gray-50 p-3 rounded">
          <span className="text-gray-700">{bump}</span>
          <span className="font-bold text-purple-600">{rate}</span>
        </div>
      ))}
    </div>
  </div>
  
  {/* Bumps por Categoria */}
  {results.bumps.byCategory && (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
      {/* LDR 77 */}
      <div className="border-2 border-blue-200 rounded-lg p-4 bg-blue-50">
        <h4 className="font-semibold text-sm text-blue-700 mb-3">
          💎 Bumps LDR 77
          <span className="text-xs text-gray-600 ml-2">
            (base: {results.bumps.byCategory.ldr77.totalVendas} vendas)
          </span>
        </h4>
        {Object.keys(results.bumps.byCategory.ldr77.counts).length > 0 ? (
          <div className="space-y-2">
            {Object.entries(results.bumps.byCategory.ldr77.counts).map(([bump, count]) => (
              <div key={bump} className="bg-white p-2 rounded">
                <div className="text-xs text-gray-600 truncate">{bump}</div>
                <div className="flex justify-between items-center mt-1">
                  <span className="text-sm font-medium text-blue-700">{count} vendas</span>
                  <span className="text-sm font-bold text-blue-600">
                    {results.bumps.byCategory.ldr77.conversionRates[bump]}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-gray-500 italic">Nenhum bump vendido</p>
        )}
      </div>
      
      {/* LDR 147 */}
      <div className="border-2 border-purple-200 rounded-lg p-4 bg-purple-50">
        <h4 className="font-semibold text-sm text-purple-700 mb-3">
          💎 Bumps LDR 147
          <span className="text-xs text-gray-600 ml-2">
            (base: {results.bumps.byCategory.ldr147.totalVendas} vendas)
          </span>
        </h4>
        {Object.keys(results.bumps.byCategory.ldr147.counts).length > 0 ? (
          <div className="space-y-2">
            {Object.entries(results.bumps.byCategory.ldr147.counts).map(([bump, count]) => (
              <div key={bump} className="bg-white p-2 rounded">
                <div className="text-xs text-gray-600 truncate">{bump}</div>
                <div className="flex justify-between items-center mt-1">
                  <span className="text-sm font-medium text-purple-700">{count} vendas</span>
                  <span className="text-sm font-bold text-purple-600">
                    {results.bumps.byCategory.ldr147.conversionRates[bump]}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-gray-500 italic">Nenhum bump vendido</p>
        )}
      </div>
    </div>
  )}
  
  {/* Quantidade Total de Bumps */}
  <div className="mt-4 pt-4 border-t">
    <h4 className="font-semibold mb-2 text-sm text-gray-600">📦 Quantidade Total de Vendas:</h4>
    <div className="grid grid-cols-2 gap-2">
      {Object.entries(results.bumps.counts).map(([bump, count]) => (
        <div key={bump} className="flex justify-between text-sm text-gray-600 bg-gray-50 p-2 rounded">
          <span className="truncate">{bump}:</span>
          <span className="font-medium ml-2">{count}</span>
        </div>
      ))}
    </div>
  </div>
</div>

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

// Endpoints - ATUALIZADOS PARA SUPORTAR XLSX
app.post('/api/process/hubla', upload.single('file'), (req, res) => {
  try {
    let csvText;
    const fileName = req.file.originalname.toLowerCase();
    
    // Detectar tipo de arquivo e converter se necessário
    if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
      csvText = xlsxToCSV(req.file.buffer);
    } else {
      csvText = req.file.buffer.toString('utf-8');
    }
    
    const result = processHubla(csvText);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/process/hotmart', upload.single('file'), (req, res) => {
  try {
    let csvText;
    const fileName = req.file.originalname.toLowerCase();
    
    // Detectar tipo de arquivo e converter se necessário
    if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
      csvText = xlsxToCSV(req.file.buffer);
    } else {
      csvText = req.file.buffer.toString('utf-8');
    }
    
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
