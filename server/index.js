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

const HOTMART_PRICE_MAPPINGS = {
  // Descomplica OBS
  '997e3yhk': { product: 'Descomplica', origin: 'Ads - Page' },
  'gyy2gzop': { product: 'Descomplica', origin: 'N/A' },
  '2pzpv0td': { product: 'Descomplica', origin: 'Whatsapp Upsell' },
  '1yflbmft': { product: 'Descomplica', origin: 'Ads - Page com VSL' },
  
  // Checklist
  'j5jzrlt1': { product: 'Checklist', origin: 'N/A' },
  '4oeu5x7p': { product: 'Checklist', origin: 'Bump Descomplica' },
  'xtg98r9p': { product: 'Checklist', origin: 'Bump Descomplica' },
  'oi58y3o3': { product: 'Checklist', origin: 'Ads' },
  '59um3csu': { product: 'Checklist', origin: 'Ads' },
  '7vtjjnnt': { product: 'Checklist', origin: 'Ads' },
  '024nuedz': { product: 'Checklist', origin: 'Ads' },
  
  // Iluminação
  'icm6fa9c': { product: 'Iluminação profissional', origin: 'N/A' },
  'jf0ztef5': { product: 'Iluminação profissional', origin: 'Bump Descomplica' },
  '460lfl63': { product: 'Iluminação profissional', origin: 'Bump Descomplica' },
  'v046zzii': { product: 'Iluminação profissional', origin: 'Ads' },
  'bzpif1xj': { product: 'Iluminação profissional', origin: 'Ads' },
  'p0d170xv': { product: 'Iluminação profissional', origin: 'Ads' },
  
  // Grava Simples
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
  
  // Executa Infoprodutor
  'ce8nr3lp': { product: 'Executa Infoprodutor', origin: 'Campanha' },
  'lzyrnd2p': { product: 'Executa Infoprodutor', origin: 'Parcelamento' },
  
  // Youtube
  'wawx8lne': { product: 'Youtube', origin: 'N/A' },
  
  // Cenário Virtual - NOVO PRODUTO
  '76kuoixy': { product: 'Cenário Virtual', origin: 'N/A' }
};

// ============================================
// SISTEMA ROBUSTO DE IDENTIFICAÇÃO DE PRODUTOS
// ============================================

// CONFIGURAÇÃO: Aliases e padrões para cada produto
const PRODUCT_CONFIG = {
  ldr: {
    displayName: 'Laboratório de Roteiros',
    aliases: [
      'laboratório de roteiros',
      'laboratorio de roteiros',
      'lab de roteiros',
      'ldr',
      'roteiros lab'
    ],
    patterns: [/laborat[oó]rio.*roteiros/i, /\bldr\b/i],
    hasBumps: true,
    isMainProduct: true
  },
  
  rnp: {
    displayName: 'Roteiros na Prática',
    aliases: [
      'roteiros na prática',
      'roteiros na pratica',
      'rnp',
      'roteiro pratica'
    ],
    patterns: [/roteiros?\s+na\s+pr[aá]tica/i, /\brnp\b/i],
    hasBumps: false,
    isMainProduct: true,
    isUpsell: true,
    upsellOf: 'ldr'
  },
  
  brainstorming: {
    displayName: 'Brainstorming',
    aliases: [
      'brainstorming',
      'assessoria',
      'consultoria',
      'assessoria de conteúdo'
    ],
    patterns: [/brainstorming/i, /assessoria/i, /consultoria/i],
    hasBumps: false,
    isMainProduct: true,
    isHighTicket: true
  },
  
  pack_anuncios: {
    displayName: 'Pack Anúncios Penoni',
    aliases: [
      'pack vitalício',
      'anúncios penoni',
      'pack penoni'
    ],
    patterns: [/pack.*vitalício/i, /anúncios.*penoni/i, /pack.*penoni/i],
    hasBumps: false,
    isMainProduct: false,
    isBump: true,
    bumpOf: 'ldr'
  },
  
  viralzometro: {
    displayName: 'Viralzômetro',
    aliases: [
      'viralzômetro',
      'viralzometro',
      'checklist post'
    ],
    patterns: [/viralz[oô]metro/i, /checklist.*post/i],
    hasBumps: false,
    isMainProduct: false,
    isBump: true,
    bumpOf: 'ldr'
  },
  
  capcut: {
    displayName: 'Viralizando com CapCut',
    aliases: [
      'viralizando com capcut',
      'capcut',
      'edição capcut'
    ],
    patterns: [/viralizando.*capcut/i, /capcut/i],
    hasBumps: false,
    isMainProduct: false,
    isBump: true,
    bumpOf: 'ldr'
  },
  
  pmc: {
    displayName: 'Alcance de Milhões',
    aliases: [
      'alcance de milhões',
      'alcance milhões',
      'pmc'
    ],
    patterns: [/\[?pmc\]?/i, /alcance.*milh[õo]es/i],
    hasBumps: false,
    isMainProduct: false,
    isBump: true,
    bumpOf: 'ldr'
  },
  
  desafio_10dias: {
    displayName: 'Desafio Viralizando em 10 Dias',
    aliases: [
      'desafio viralizando',
      'desafio 10 dias',
      'viralizando 10 dias'
    ],
    patterns: [/desafio.*viralizando/i, /viralizando.*10.*dias/i, /desafio.*10.*dias/i],
    hasBumps: false,
    isMainProduct: true,
    isFrontEnd: true
  }
};

// ============================================
// FUNÇÃO DE IDENTIFICAÇÃO DE PRODUTO
// ============================================

function identificarProduto(nomeProduto) {
  if (!nomeProduto) return null;
  
  const nome = nomeProduto.trim().toLowerCase();
  
  // Tentar match exato por alias
  for (const [key, config] of Object.entries(PRODUCT_CONFIG)) {
    if (config.aliases.some(alias => nome === alias)) {
      return {
        key,
        config,
        confidence: 'high'
      };
    }
  }
  
  // Tentar match por padrão regex
  for (const [key, config] of Object.entries(PRODUCT_CONFIG)) {
    if (config.patterns.some(pattern => pattern.test(nomeProduto))) {
      return {
        key,
        config,
        confidence: 'medium'
      };
    }
  }
  
  // Tentar match parcial (fallback)
  for (const [key, config] of Object.entries(PRODUCT_CONFIG)) {
    if (config.aliases.some(alias => nome.includes(alias) || alias.includes(nome))) {
      return {
        key,
        config,
        confidence: 'low'
      };
    }
  }
  
  // Produto não identificado
  return {
    key: 'unknown',
    config: {
      displayName: nomeProduto,
      isMainProduct: false,
      isBump: false
    },
    confidence: 'none',
    originalName: nomeProduto
  };
}

// ============================================
// FUNÇÃO DE CATEGORIZAÇÃO LDR (77 vs 147)
// ============================================

function categorizarLDR(oferta) {
  if (!oferta) return 'outros';
  
  const ofertaLower = oferta.toLowerCase();
  
  // LDR 77
  if (ofertaLower.includes('[ldr] 77') || 
      ofertaLower.includes('[77]') ||
      ofertaLower.includes('renovação alunos - 67') ||
      ofertaLower.includes('renovação alunos - 97') ||
      ofertaLower.includes('renovacao alunos - 67') ||
      ofertaLower.includes('renovacao alunos - 97')) {
    return 'ldr77';
  }
  
  // LDR 147
  if (ofertaLower.includes('[ldr] 147') || 
      ofertaLower.includes('[147]')) {
    return 'ldr147';
  }
  
  // LDR 244
  if (ofertaLower.includes('[ldr] 244') || 
      ofertaLower.includes('[244]')) {
    return 'ldr244';
  }
  
  return 'outros';
}

// ============================================
// NORMALIZAÇÃO DE ORIGEM (UTM)
// ============================================

function normalizeOrigin(utmOrigem, utmMidia, utmTermo) {
  const sources = [utmOrigem, utmMidia, utmTermo]
    .filter(s => s)
    .map(s => s.toLowerCase());
  
  const allText = sources.join(' ');
  
  // WhatsApp
  if (allText.includes('whatsapp') || allText.includes('wpp') || 
      allText.includes('whats') || allText.includes('zap')) {
    return 'WhatsApp';
  }
  
  // Instagram
  if (allText.includes('instagram') || allText.includes('insta') || 
      allText.includes('ig_') || allText.includes('reels') ||
      allText.includes('story') || allText.includes('stories')) {
    return 'Instagram';
  }
  
  // Notion
  if (allText.includes('notion')) {
    return 'Notion';
  }
  
  // Meta Ads / Facebook
  if (allText.includes('meta') || allText.includes('facebook') || 
      allText.includes('fb_') || allText.includes('fb-') ||
      allText.includes('meta-ads') || allText.includes('metaads')) {
    return 'Meta Ads';
  }
  
  // Google Ads
  if (allText.includes('google') || allText.includes('adwords') || 
      allText.includes('gads')) {
    return 'Google Ads';
  }
  
  // Email
  if (allText.includes('email') || allText.includes('mail') || 
      allText.includes('newsletter')) {
    return 'Email';
  }
  
  // YouTube
  if (allText.includes('youtube') || allText.includes('yt')) {
    return 'YouTube';
  }
  
  // Tráfego Direto
  if (allText.includes('direto') || allText.includes('direct') ||
      allText.includes('trafego')) {
    return 'Tráfego Direto';
  }
  
  // Bio / Link na Bio
  if (allText.includes('bio') || allText.includes('linktree')) {
    return 'Link na Bio';
  }
  
  return utmOrigem || 'N/A';
}

// ============================================
// PROCESSAMENTO PRINCIPAL - HUBLA (PERETTAS)
// ============================================

function processHubla(data) {
  // Filtrar apenas vendas pagas
  const paidSales = data.filter(row => row['Status da fatura'] === 'Paga');
  
  // Estruturas de dados
  const productSales = {};
  const productRefunds = {};
  const productOrigins = {};
  const bumpRelations = {};
  const ldrCategories = { ldr77: 0, ldr147: 0, ldr244: 0, outros: 0 };
  const unmappedProducts = new Set();
  
  // Processar cada venda
  paidSales.forEach(sale => {
    const nomeProduto = sale['Nome do produto'];
    const nomeBump = sale['Nome do produto de orderbump'];
    const oferta = sale['Nome da oferta'];
    const utmOrigem = sale['UTM Origem'];
    const utmMidia = sale['UTM Mídia'];
    const utmTermo = sale['UTM Termo'];
    
    // Identificar produto principal
    const produtoInfo = identificarProduto(nomeProduto);
    
    if (produtoInfo.confidence === 'none') {
      unmappedProducts.add(nomeProduto);
    }
    
    const produtoKey = produtoInfo.key;
    const produtoDisplay = produtoInfo.config.displayName;
    
    // Inicializar estruturas se necessário
    if (!productSales[produtoKey]) {
      productSales[produtoKey] = {
        displayName: produtoDisplay,
        total: 0,
        byOrigin: {}
      };
      productRefunds[produtoKey] = 0;
    }
    
    // Contar venda
    productSales[produtoKey].total++;
    
    // Contar por origem
    const origem = normalizeOrigin(utmOrigem, utmMidia, utmTermo);
    if (!productSales[produtoKey].byOrigin[origem]) {
      productSales[produtoKey].byOrigin[origem] = 0;
    }
    productSales[produtoKey].byOrigin[origem]++;
    
    // Categorizar LDR se for o caso
    if (produtoKey === 'ldr') {
      const categoria = categorizarLDR(oferta);
      ldrCategories[categoria]++;
    }
    
    // Processar bump se houver
    if (nomeBump && nomeBump !== '') {
      const bumpInfo = identificarProduto(nomeBump);
      
      if (bumpInfo.confidence === 'none') {
        unmappedProducts.add(nomeBump);
      }
      
      const bumpKey = bumpInfo.key;
      const bumpDisplay = bumpInfo.config.displayName;
      
      // Inicializar relação de bump
      if (!bumpRelations[produtoKey]) {
        bumpRelations[produtoKey] = {};
      }
      if (!bumpRelations[produtoKey][bumpKey]) {
        bumpRelations[produtoKey][bumpKey] = {
          displayName: bumpDisplay,
          count: 0
        };
      }
      
      bumpRelations[produtoKey][bumpKey].count++;
    }
  });
  
  // Processar reembolsos
  const refunds = data.filter(row => 
    row['Status da fatura'] === 'Reembolsada' || 
    row['Status da fatura'] === 'Cancelada'
  );
  
  refunds.forEach(refund => {
    const nomeProduto = refund['Nome do produto'];
    const produtoInfo = identificarProduto(nomeProduto);
    const produtoKey = produtoInfo.key;
    
    if (productRefunds[produtoKey] !== undefined) {
      productRefunds[produtoKey]++;
    }
  });
  
  // Calcular taxas de conversão de bumps
  const bumpConversionRates = {};
  
  Object.keys(bumpRelations).forEach(mainProductKey => {
    const mainProductSales = productSales[mainProductKey]?.total || 0;
    
    if (mainProductSales === 0) return;
    
    bumpConversionRates[mainProductKey] = {
      displayName: productSales[mainProductKey].displayName,
      bumps: {}
    };
    
    Object.keys(bumpRelations[mainProductKey]).forEach(bumpKey => {
      const bumpData = bumpRelations[mainProductKey][bumpKey];
      const taxa = ((bumpData.count / mainProductSales) * 100).toFixed(2);
      
      bumpConversionRates[mainProductKey].bumps[bumpKey] = {
        displayName: bumpData.displayName,
        quantidade: bumpData.count,
        taxa: taxa + '%',
        basePrincipal: mainProductSales
      };
    });
  });
  
  // Calcular percentuais LDR
  const totalLDR = ldrCategories.ldr77 + ldrCategories.ldr147 + ldrCategories.ldr244 + ldrCategories.outros;
  const ldrPercentages = {};
  
  if (totalLDR > 0) {
    ldrPercentages.ldr77 = ((ldrCategories.ldr77 / totalLDR) * 100).toFixed(1) + '%';
    ldrPercentages.ldr147 = ((ldrCategories.ldr147 / totalLDR) * 100).toFixed(1) + '%';
    ldrPercentages.ldr244 = ((ldrCategories.ldr244 / totalLDR) * 100).toFixed(1) + '%';
    ldrPercentages.outros = ((ldrCategories.outros / totalLDR) * 100).toFixed(1) + '%';
  }
  
  // Detectar período
  const dates = paidSales
    .map(s => s['Data de pagamento'] || s['Data de criação'])
    .filter(d => d)
    .map(d => {
      const parts = d.split(' ')[0].split('/');
      return new Date(parts[2], parts[1] - 1, parts[0]);
    })
    .sort((a, b) => a - b);
  
  const period = dates.length > 0 ? {
    start: dates[0].toLocaleDateString('pt-BR'),
    end: dates[dates.length - 1].toLocaleDateString('pt-BR')
  } : null;
  
  // Montar resposta
  return {
    period,
    sales: productSales,
    refunds: productRefunds,
    ldrCategories: {
      quantities: ldrCategories,
      percentages: ldrPercentages
    },
    bumps: bumpConversionRates,
    unmappedProducts: Array.from(unmappedProducts),
    totalSales: paidSales.length,
    totalRefunds: refunds.length
  };
}

// ============================================
// EXPORTAR FUNÇÕES
// ============================================

module.exports = {
  processHubla,
  identificarProduto,
  categorizarLDR,
  normalizeOrigin,
  PRODUCT_CONFIG
};
// Processar Hotmart - COM DETECÇÃO DE NOVOS PRODUTOS
// Processar Hotmart - COM SISTEMA FLEXÍVEL DE BUMPS
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
  
  // ===== CONTAR VENDAS =====
  data.forEach(sale => {
    const priceCode = sale['Código do preço'];
    const productName = sale['Produto'];
    const mapping = HOTMART_PRICE_MAPPINGS[priceCode];
    
    if (!mapping) {
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
  
  // ===== SISTEMA AUTOMÁTICO DE DETECÇÃO DE BUMPS =====
  const bumpRelations = {}; // { "ProdutoPrincipal": { "ProdutoBump": quantidade } }
  const productSalesCount = {}; // Contar vendas diretas (não-bump) por produto
  
  data.forEach(sale => {
    const mainTransaction = sale['Transação do Produto Principal'];
    const currentProduct = sale['Produto'];
    
    if (mainTransaction && mainTransaction !== '(none)') {
      // É um bump - encontrar o produto principal
      const mainSale = data.find(s => 
        s['Transação da venda'] === mainTransaction || 
        s['Código da transação'] === mainTransaction
      );
      
      if (mainSale) {
        const mainProduct = mainSale['Produto'];
        
        if (!bumpRelations[mainProduct]) {
          bumpRelations[mainProduct] = {};
        }
        
        bumpRelations[mainProduct][currentProduct] = 
          (bumpRelations[mainProduct][currentProduct] || 0) + 1;
      }
    } else {
      // Venda direta (não é bump)
      productSalesCount[currentProduct] = 
        (productSalesCount[currentProduct] || 0) + 1;
    }
  });
  
  // ===== CALCULAR TAXAS DE CONVERSÃO DE BUMPS =====
  const bumpConversionRates = {};
  
  Object.keys(bumpRelations).forEach(mainProduct => {
    const mainProductSales = productSalesCount[mainProduct] || 0;
    
    if (mainProductSales === 0) return;
    
    bumpConversionRates[mainProduct] = {};
    
    Object.keys(bumpRelations[mainProduct]).forEach(bumpProduct => {
      const bumpCount = bumpRelations[mainProduct][bumpProduct];
      const rate = ((bumpCount / mainProductSales) * 100).toFixed(2) + '%';
      
      bumpConversionRates[mainProduct][bumpProduct] = {
        quantidade: bumpCount,
        taxa: rate,
        basePrincipal: mainProductSales
      };
    });
  });
  
// ===== REEMBOLSOS - COM MAPEAMENTO CORRETO =====
const allTransactions = parsed.data;
const refunds = allTransactions.filter(r => 
  r['Status da transação'] === 'Reembolsado' ||
  r['Status da transação'] === 'Cancelado'
);

const refundsByProduct = {};
refunds.forEach(r => {
  const priceCode = r['Código do preço'];
  const mapping = HOTMART_PRICE_MAPPINGS[priceCode];
  
  if (mapping) {
    // Usa o mapeamento para diferenciar Monitoria vs Consultoria
    const { product } = mapping;
    refundsByProduct[product] = (refundsByProduct[product] || 0) + 1;
  } else {
    // Se não houver mapeamento, usa o nome do produto direto
    const productName = r['Produto'];
    refundsByProduct[productName] = (refundsByProduct[productName] || 0) + 1;
  }
});
  
  // ===== COMPATIBILIDADE COM VERSÃO ANTERIOR (Descomplica específico) =====
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
  
  const descomplicaTotal = productSalesCount['OBS Studio para INFOPRODUTORES'] || 0;
  
  const legacyBumpRates = {
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
    bumpRates: legacyBumpRates, // Mantém compatibilidade
    bumpRelations: bumpRelations, // NOVO: Relações completas
    bumpConversionRates: bumpConversionRates, // NOVO: Taxas dinâmicas
    refunds: {
      total: refunds.length,
      byProduct: refundsByProduct
    },
    unknownCodes: unknownCodes
  };
}

// Endpoints - COM SUPORTE A XLSX
app.post('/api/process-hubla', upload.single('file'), (req, res) => {
  const fileContent = fs.readFileSync(req.file.path, 'utf8');
  const parsed = Papa.parse(fileContent, { 
    header: true, 
    dynamicTyping: true,
    skipEmptyLines: true 
  });
  
  const results = processHubla(parsed.data);
  
  fs.unlinkSync(req.file.path);
  res.json(results);
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
