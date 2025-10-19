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
        oferta.includes('renovação alunos - 97')) {
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

// Processar Hubla - VERSÃO COMPLETA E OTIMIZADA
function processHubla(csvText) {
  const parsed = Papa.parse(csvText, {
    header: true,
    dynamicTyping: true,
    skipEmptyLines: true
  });

  const data = parsed.data.filter(r => r['Status da fatura'] === 'Paga');
  
  const ldrSales = data.filter(r => r['Nome do produto'] === 'Laboratório de Roteiros');
  const rnpSales = data.filter(r => r['Nome do produto'] === 'Roteiros na Prática');
  
  // ===== CATEGORIZAÇÃO LDR 77 vs 147 =====
  const categoriasLDR = categorizarVendasLDR(ldrSales);
  const estatisticasLDR = calcularEstatisticasLDR(categoriasLDR);
  
  // ===== VENDAS POR ORIGEM (TODOS OS PRODUTOS) =====
  const allProducts = {};
  const productsByOrigin = {};
  
  data.forEach(sale => {
    const product = sale['Nome do produto'];
    const origin = getHublaOrigin(sale);
    
    // Contar total por produto
    allProducts[product] = (allProducts[product] || 0) + 1;
    
    // Contar por origem
    if (!productsByOrigin[product]) productsByOrigin[product] = {};
    productsByOrigin[product][origin] = (productsByOrigin[product][origin] || 0) + 1;
  });
  
  const ldrByOrigin = productsByOrigin['Laboratório de Roteiros'] || {};
  const rnpByOrigin = productsByOrigin['Roteiros na Prática'] || {};
  
  // ===== BUMPS GERAL =====
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
  
  // ===== BUMPS POR CATEGORIA (77 vs 147) =====
  const bumps77 = {};
  const bumps147 = {};
  
  categoriasLDR.ldr77.forEach(sale => {
    const bumpNames = sale['Nome do produto de orderbump'];
    if (bumpNames) {
      bumpNames.split(', ').forEach(bump => {
        bumps77[bump] = (bumps77[bump] || 0) + 1;
      });
    }
  });
  
  categoriasLDR.ldr147.forEach(sale => {
    const bumpNames = sale['Nome do produto de orderbump'];
    if (bumpNames) {
      bumpNames.split(', ').forEach(bump => {
        bumps147[bump] = (bumps147[bump] || 0) + 1;
      });
    }
  });
  
  const bumpRates77 = {};
  const bumpRates147 = {};
  
  Object.keys(bumps77).forEach(bump => {
    bumpRates77[bump] = ((bumps77[bump] / categoriasLDR.ldr77.length) * 100).toFixed(2) + '%';
  });
  
  Object.keys(bumps147).forEach(bump => {
    bumpRates147[bump] = ((bumps147[bump] / categoriasLDR.ldr147.length) * 100).toFixed(2) + '%';
  });
  
  // ===== REEMBOLSOS POR PRODUTO =====
  const allRefunds = parsed.data.filter(r => 
    r['Data de reembolso'] && 
    r['Data de reembolso'] !== '' && 
    r['Data de reembolso'] !== null
  );
  
  const refundsByProduct = {};
  allRefunds.forEach(r => {
    const product = r['Nome do produto'];
    refundsByProduct[product] = (refundsByProduct[product] || 0) + 1;
  });
  
  const ldrRefunds = refundsByProduct['Laboratório de Roteiros'] || 0;
  const rnpRefunds = refundsByProduct['Roteiros na Prática'] || 0;
  
  // ===== DETECÇÃO AUTOMÁTICA DE PRODUTOS DESCONHECIDOS =====
  const knownProducts = ['Laboratório de Roteiros', 'Roteiros na Prática'];
  const unknownProducts = {};
  
  Object.keys(allProducts).forEach(product => {
    if (!knownProducts.includes(product)) {
      unknownProducts[product] = {
        quantidade: allProducts[product],
        origens: productsByOrigin[product] || {}
      };
    }
  });
  
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
      },
      allProducts: allProducts,
      productsByOrigin: productsByOrigin
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
    },
    refunds: {
      total: allRefunds.length,
      byProduct: refundsByProduct
    },
    unknownProducts: unknownProducts
  };
}

function getHublaOrigin(sale) {
  const origem = (sale['UTM Origem'] || '').toString().toLowerCase().trim();
  const termo = (sale['UTM Termo'] || '').toString().toLowerCase().trim();
  
  if (!origem || origem === 'null' || origem === '') return 'N/A';
  
  // WhatsApp
  if (origem.includes('whatsapp') || origem.includes('wpp')) {
    if (termo.includes('renovacao') || termo.includes('renovação')) return 'Whatsapp | Renovação';
    if (termo.includes('upsell')) return 'Whatsapp | Upsell';
    return 'Whatsapp | Mensagens';
  }
  
  // Notion
  if (origem.includes('notion')) return 'Notion';
  
  // Hubla
  if (origem.includes('hubla')) return 'Hubla | Área de membros';
  
  // Meta Ads / Tráfego
  if (origem.includes('meta-ads') || origem.includes('ads')) return 'Trafego';
  
  // Instagram (normalizar insta -> instagram)
  if (origem.includes('insta')) {
    if (termo.includes('destaques') || termo.includes('destaque')) return 'Instagram | Destaques';
    if (termo.includes('bio')) return 'Instagram | Bio';
    if (termo.includes('reels') || termo.includes('reel')) return 'Instagram | Reels';
    if (termo.includes('stories') || termo.includes('story')) return 'Instagram | Stories';
    return 'Instagram | Outros';
  }
  
  // Active Campaign
  if (origem.includes('active')) return 'Active | Recuperação';
  
  return 'N/A';
}

// Processar Hotmart - COM DETECÇÃO DE NOVOS PRODUTOS
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
  const unknownCodes = {};
  
  data.forEach(sale => {
    const priceCode = sale['Código do preço'];
    const productName = sale['Produto'];
    const mapping = HOTMART_PRICE_MAPPINGS[priceCode];
    
    if (!mapping) {
      // Produto/código não mapeado - detecção automática
      if (!unknownCodes[priceCode]) {
        unknownCodes[priceCode] = {
          produto: productName,
          quantidade: 0,
          precoDeste: sale['Nome deste preço'] || 'N/A'
        };
      }
      unknownCodes[priceCode].quantidade++;
      return;
    }
    
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
    'Checklist - Descomplica': descomplicaTotal > 0 ? ((checklistBumps / descomplicaTotal) * 100).toFixed(2) + '%' : '0%',
    'Iluminação - Descomplica': descomplicaTotal > 0 ? ((iluminacaoBumps / descomplicaTotal) * 100).toFixed(2) + '%' : '0%'
  };
  
  return {
    project: 'Grava Simples',
    platform: 'Hotmart',
    sales: salesByProduct,
    salesByOrigin: salesByOrigin,
    bumpRates: bumpRates,
    unknownCodes: unknownCodes
  };
}

// Endpoints - COM SUPORTE A XLSX
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
