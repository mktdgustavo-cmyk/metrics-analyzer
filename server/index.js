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

// ===================================================
// SISTEMA DE IDENTIFICAÇÃO DE PRODUTOS (NOVO)
// ===================================================
const PRODUCT_ALIASES = {
  'Laboratório de Roteiros': [
    'laboratório de roteiros',
    'laboratorio de roteiros',
    'lab de roteiros',
    'ldr'
  ],
  'Roteiros na Prática': [
    'roteiros na prática',
    'roteiros na pratica',
    'rnp'
  ],
  'Brainstorming': [
    'brainstorming',
    'assessoria',
    'assessoria de conteúdo',
    'assessoria de conteudo'
  ],
  'Desafio Viralizando em 10 Dias': [
    'desafio viralizando',
    'desafio 10 dias',
    'viralizando 10 dias',
    'desafio viralizando em 10 dias'
  ]
};

function identificarProduto(nomeProduto) {
  if (!nomeProduto) return null;
  
  const nome = nomeProduto.trim().toLowerCase();
  
  // Tentar match exato ou por aliases
  for (const [produtoCanon, aliases] of Object.entries(PRODUCT_ALIASES)) {
    if (aliases.some(alias => nome === alias || nome.includes(alias))) {
      return produtoCanon;
    }
  }
  
  // Se não encontrou, retorna o nome original
  return nomeProduto;
}

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
    
    if (oferta.includes('[ldr] 77') || 
        oferta.includes('[77]') || 
        oferta.includes('renovação alunos - 67') ||
        oferta.includes('renovacao alunos - 67') || 
        oferta.includes('renovação alunos - 97') ||
        oferta.includes('renovacao alunos - 97')) {
      categorias.ldr77.push(venda);
    } 
    else if (oferta.includes('[ldr] 147') || 
             oferta.includes('[147]')) {
      categorias.ldr147.push(venda);
    } 
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

// ===================================================
// NORMALIZAÇÃO DE ORIGEM MELHORADA
// ===================================================
function getHublaOrigin(sale) {
  const origem = sale['UTM Origem'];
  const midia = sale['UTM Mídia'];
  const termo = sale['UTM Termo'];
  
  // Juntar todos os campos para analisar
  const allText = [origem, midia, termo]
    .filter(x => x && x !== 'null')
    .join(' ')
    .toLowerCase();
  
  if (!allText || allText === '') return 'N/A';
  
  // WhatsApp
  if (allText.includes('whatsapp') || allText.includes('wpp') || 
      allText.includes('whats') || allText.includes('zap')) {
    return 'WhatsApp';
  }
  
  // Instagram
  if (allText.includes('instagram') || allText.includes('insta') || 
      allText.includes('ig_') || allText.includes('reels') ||
      allText.includes('story') || allText.includes('stories')) {
    if (termo && termo !== 'null') {
      return `Instagram | ${termo.charAt(0).toUpperCase() + termo.slice(1)}`;
    }
    return 'Instagram';
  }
  
  // Notion
  if (allText.includes('notion')) {
    return 'Notion';
  }
  
  // Meta Ads / Trafego
  if (allText.includes('meta-ads') || allText.includes('meta ads') ||
      allText.includes('facebook') || allText.includes('fb_')) {
    return 'Trafego';
  }
  
  // Hubla / Área de membros
  if (allText.includes('hubla')) {
    return 'Hubla | Área de membros';
  }
  
  // Email
  if (allText.includes('email') || allText.includes('mail')) {
    return 'Email';
  }
  
  // YouTube
  if (allText.includes('youtube') || allText.includes('yt')) {
    return 'YouTube';
  }
  
  return 'N/A';
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
// PROCESSAR HUBLA - COM IDENTIFICAÇÃO ROBUSTA
// ===================================================
function processHubla(csvText) {
  const parsed = Papa.parse(csvText, {
    header: true,
    dynamicTyping: true,
    skipEmptyLines: true
  });

  const data = parsed.data.filter(r => r['Status da fatura'] === 'Paga');
  
  // Usar identificação robusta de produtos
  const ldrSales = data.filter(r => {
    const produtoIdentificado = identificarProduto(r['Nome do produto']);
    return produtoIdentificado === 'Laboratório de Roteiros';
  });
  
  const rnpSales = data.filter(r => {
    const produtoIdentificado = identificarProduto(r['Nome do produto']);
    return produtoIdentificado === 'Roteiros na Prática';
  });
  
  // ===== CATEGORIZAÇÃO LDR 77 vs 147 =====
  const categoriasLDR = categorizarVendasLDR(ldrSales);
  const estatisticasLDR = calcularEstatisticasLDR(categoriasLDR);
  
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
  
  // ===== BUMPS CORRIGIDO =====
  const bumps = {};
  const ldrSalesWithBump = ldrSales.filter(s => {
    const bumpField = s['Nome do produto de orderbump'];
    return bumpField && bumpField.trim() !== '';
  });
  
  ldrSalesWithBump.forEach(sale => {
    const bumpField = sale['Nome do produto de orderbump'];
    if (bumpField && bumpField.trim() !== '') {
      // Processar múltiplos bumps separados por vírgula
      const bumpList = bumpField.includes(',') ? bumpField.split(',') : [bumpField];
      
      bumpList.forEach(bump => {
        const bumpTrimmed = bump.trim();
        if (bumpTrimmed !== '') {
          bumps[bumpTrimmed] = (bumps[bumpTrimmed] || 0) + 1;
        }
      });
    }
  });
  
  const bumpRates = {};
  Object.keys(bumps).forEach(bump => {
    bumpRates[bump] = ((bumps[bump] / ldrSales.length) * 100).toFixed(2) + '%';
  });
  
  // ===== BUMPS POR CATEGORIA (77 vs 147) - CORRIGIDO =====
  const bumps77 = {};
  const bumps147 = {};
  
  categoriasLDR.ldr77.forEach(sale => {
    const bumpField = sale['Nome do produto de orderbump'];
    if (bumpField && bumpField.trim() !== '') {
      const bumpList = bumpField.includes(',') ? bumpField.split(',') : [bumpField];
      bumpList.forEach(bump => {
        const bumpTrimmed = bump.trim();
        if (bumpTrimmed !== '') {
          bumps77[bumpTrimmed] = (bumps77[bumpTrimmed] || 0) + 1;
        }
      });
    }
  });
  
  categoriasLDR.ldr147.forEach(sale => {
    const bumpField = sale['Nome do produto de orderbump'];
    if (bumpField && bumpField.trim() !== '') {
      const bumpList = bumpField.includes(',') ? bumpField.split(',') : [bumpField];
      bumpList.forEach(bump => {
        const bumpTrimmed = bump.trim();
        if (bumpTrimmed !== '') {
          bumps147[bumpTrimmed] = (bumps147[bumpTrimmed] || 0) + 1;
        }
      });
    }
  });
  
  const bumpRates77 = {};
  const bumpRates147 = {};
  
  Object.keys(bumps77).forEach(bump => {
    const base = categoriasLDR.ldr77.length;
    bumpRates77[bump] = base > 0 ? ((bumps77[bump] / base) * 100).toFixed(2) + '%' : '0%';
  });
  
  Object.keys(bumps147).forEach(bump => {
    const base = categoriasLDR.ldr147.length;
    bumpRates147[bump] = base > 0 ? ((bumps147[bump] / base) * 100).toFixed(2) + '%' : '0%';
  });
  
// ===== REEMBOLSOS - CORRIGIDO =====
// Buscar em parsed.data (TODOS os registros), não só em "data" (vendas pagas)
const allData = parsed.data;
const refunds = allData.filter(r => 
  r['Status da fatura'] === 'Reembolsada' || 
  r['Status da fatura'] === 'Cancelada' ||
  (r['Data de reembolso'] !== null && r['Data de reembolso'] !== '')
);

const ldrRefunds = refunds.filter(r => {
  const produtoIdentificado = identificarProduto(r['Nome do produto']);
  return produtoIdentificado === 'Laboratório de Roteiros';
}).length;

const rnpRefunds = refunds.filter(r => {
  const produtoIdentificado = identificarProduto(r['Nome do produto']);
  return produtoIdentificado === 'Roteiros na Prática';
}).length;
  
  return {
    project: 'Perettas',
    platform: 'Hubla',
    sales: {
      ldr: {
        total: ldrSales.length,
        byOrigin: ldrByOrigin,
        refunds: ldrRefunds,
        categorias: estatisticasLDR
      },
      rnp: {
        total: rnpSales.length,
        byOrigin: rnpByOrigin,
        refunds: rnpRefunds
      }
    },
    bumps: {
      counts: bumps,
      conversionRates: bumpRates,
      byCategory: {
        ldr77: {
          counts: bumps77,
          conversionRates: bumpRates77,
          totalVendas: categoriasLDR.ldr77.length
        },
        ldr147: {
          counts: bumps147,
          conversionRates: bumpRates147,
          totalVendas: categoriasLDR.ldr147.length
        }
      }
    }
  };
}

// Processar Hotmart - SEM ALTERAÇÕES
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
    'Checklist - Descomplica': descomplicaTotal > 0 ? 
      ((checklistBumps / descomplicaTotal) * 100).toFixed(2) + '%' : '0%',
    'Iluminação - Descomplica': descomplicaTotal > 0 ? 
      ((iluminacaoBumps / descomplicaTotal) * 100).toFixed(2) + '%' : '0%'
  };
  
  return {
    project: 'Grava Simples',
    platform: 'Hotmart',
    sales: salesByProduct,
    salesByOrigin: salesByOrigin,
    bumpRates: bumpRates
  };
}

// Endpoints - SEM ALTERAÇÕES
app.post('/api/process/hubla', upload.single('file'), (req, res) => {
  try {
    let csvText;
    const fileName = req.file.originalname.toLowerCase();
    
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
