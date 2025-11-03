const express = require('express');
const cors = require('cors');
const multer = require('multer');
const Papa = require('papaparse');
const _ = require('lodash');
const path = require('path');
const XLSX = require('xlsx');
const fs = require('fs'); // ⚠️ FALTAVA ESTE IMPORT

const app = express();
const upload = multer({ dest: 'uploads/' }); // Salvar em disco temporariamente

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../dist')));

// ============================================
// CONVERSÃO XLSX → CSV
// ============================================

function xlsxToCSV(filePath) {
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  return XLSX.utils.sheet_to_csv(worksheet);
}

// ============================================
// CONFIGURAÇÃO DE PRODUTOS (PERETTAS)
// ============================================

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
      'assessoria de conteúdo',
      'assessoria de conteudo'
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
      'pack vitalicio',
      'anúncios penoni',
      'anuncios penoni',
      'pack penoni'
    ],
    patterns: [/pack.*vital[ií]cio/i, /an[uú]ncios.*penoni/i, /pack.*penoni/i],
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
      'checklist post',
      'checklist do post'
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
      'edição capcut',
      'edicao capcut'
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
      'alcance de milhoes',
      'alcance milhões',
      'alcance milhoes',
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
      'viralizando 10 dias',
      'desafio viralizando em 10 dias'
    ],
    patterns: [/desafio.*viralizando/i, /viralizando.*10.*dias/i, /desafio.*10.*dias/i],
    hasBumps: false,
    isMainProduct: true,
    isFrontEnd: true
  }
};

// ============================================
// FUNÇÕES AUXILIARES (PERETTAS)
// ============================================

function identificarProduto(nomeProduto) {
  if (!nomeProduto) return null;
  
  const nome = nomeProduto.trim().toLowerCase();
  
  // Match exato por alias
  for (const [key, config] of Object.entries(PRODUCT_CONFIG)) {
    if (config.aliases.some(alias => nome === alias)) {
      return {
        key,
        config,
        confidence: 'high'
      };
    }
  }
  
  // Match por regex
  for (const [key, config] of Object.entries(PRODUCT_CONFIG)) {
    if (config.patterns.some(pattern => pattern.test(nomeProduto))) {
      return {
        key,
        config,
        confidence: 'medium'
      };
    }
  }
  
  // Match parcial (fallback)
  for (const [key, config] of Object.entries(PRODUCT_CONFIG)) {
    if (config.aliases.some(alias => nome.includes(alias) || alias.includes(nome))) {
      return {
        key,
        config,
        confidence: 'low'
      };
    }
  }
  
  // Não identificado
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

function categorizarLDR(oferta) {
  if (!oferta) return 'outros';
  
  const ofertaLower = oferta.toLowerCase();
  
  if (ofertaLower.includes('[ldr] 77') || 
      ofertaLower.includes('[77]') ||
      ofertaLower.includes('renovação alunos - 67') ||
      ofertaLower.includes('renovação alunos - 97') ||
      ofertaLower.includes('renovacao alunos - 67') ||
      ofertaLower.includes('renovacao alunos - 97')) {
    return 'ldr77';
  }
  
  if (ofertaLower.includes('[ldr] 147') || 
      ofertaLower.includes('[147]')) {
    return 'ldr147';
  }
  
  if (ofertaLower.includes('[ldr] 244') || 
      ofertaLower.includes('[244]')) {
    return 'ldr244';
  }
  
  return 'outros';
}

function normalizeOrigin(utmOrigem, utmMidia, utmTermo) {
  const sources = [utmOrigem, utmMidia, utmTermo]
    .filter(s => s)
    .map(s => s.toLowerCase());
  
  const allText = sources.join(' ');
  
  if (allText.includes('whatsapp') || allText.includes('wpp') || 
      allText.includes('whats') || allText.includes('zap')) {
    return 'WhatsApp';
  }
  
  if (allText.includes('instagram') || allText.includes('insta') || 
      allText.includes('ig_') || allText.includes('reels') ||
      allText.includes('story') || allText.includes('stories')) {
    return 'Instagram';
  }
  
  if (allText.includes('notion')) {
    return 'Notion';
  }
  
  if (allText.includes('meta') || allText.includes('facebook') || 
      allText.includes('fb_') || allText.includes('fb-') ||
      allText.includes('meta-ads') || allText.includes('metaads')) {
    return 'Meta Ads';
  }
  
  if (allText.includes('google') || allText.includes('adwords') || 
      allText.includes('gads')) {
    return 'Google Ads';
  }
  
  if (allText.includes('email') || allText.includes('mail') || 
      allText.includes('newsletter')) {
    return 'Email';
  }
  
  if (allText.includes('youtube') || allText.includes('yt')) {
    return 'YouTube';
  }
  
  if (allText.includes('direto') || allText.includes('direct') ||
      allText.includes('trafego')) {
    return 'Tráfego Direto';
  }
  
  if (allText.includes('bio') || allText.includes('linktree')) {
    return 'Link na Bio';
  }
  
  return utmOrigem || 'N/A';
}

// ============================================
// PROCESSAMENTO HUBLA (PERETTAS)
// ============================================

function processHubla(data) {
  const paidSales = data.filter(row => row['Status da fatura'] === 'Paga');
  
  const productSales = {};
  const productRefunds = {};
  const bumpRelations = {};
  const ldrCategories = { ldr77: 0, ldr147: 0, ldr244: 0, outros: 0 };
  const unmappedProducts = new Set();
  
  // Processar vendas
  paidSales.forEach(sale => {
    const nomeProduto = sale['Nome do produto'];
    const nomeBump = sale['Nome do produto de orderbump'];
    const oferta = sale['Nome da oferta'];
    const utmOrigem = sale['UTM Origem'];
    const utmMidia = sale['UTM Mídia'];
    const utmTermo = sale['UTM Termo'];
    
    const produtoInfo = identificarProduto(nomeProduto);
    
    if (produtoInfo.confidence === 'none') {
      unmappedProducts.add(nomeProduto);
    }
    
    const produtoKey = produtoInfo.key;
    const produtoDisplay = produtoInfo.config.displayName;
    
    if (!productSales[produtoKey]) {
      productSales[produtoKey] = {
        displayName: produtoDisplay,
        total: 0,
        byOrigin: {}
      };
      productRefunds[produtoKey] = 0;
    }
    
    productSales[produtoKey].total++;
    
    const origem = normalizeOrigin(utmOrigem, utmMidia, utmTermo);
    if (!productSales[produtoKey].byOrigin[origem]) {
      productSales[produtoKey].byOrigin[origem] = 0;
    }
    productSales[produtoKey].byOrigin[origem]++;
    
    if (produtoKey === 'ldr') {
      const categoria = categorizarLDR(oferta);
      ldrCategories[categoria]++;
    }
    
    if (nomeBump && nomeBump !== '') {
      const bumpInfo = identificarProduto(nomeBump);
      
      if (bumpInfo.confidence === 'none') {
        unmappedProducts.add(nomeBump);
      }
      
      const bumpKey = bumpInfo.key;
      const bumpDisplay = bumpInfo.config.displayName;
      
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
  
  // Calcular taxas de bumps
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
// MAPEAMENTO HOTMART (GRAVAÇÃO)
// ============================================

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
  'lzyrnd2p': { product: 'Executa Infoprodutor', origin: 'Parcelamento' },
  
  'wawx8lne': { product: 'Youtube', origin: 'N/A' },
  '76kuoixy': { product: 'Cenário Virtual', origin: 'N/A' }
};

// ============================================
// PROCESSAMENTO HOTMART (GRAVAÇÃO)
// ============================================

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
  
  const bumpRelations = {};
  const productSalesCount = {};
  
  data.forEach(sale => {
    const mainTransaction = sale['Transação do Produto Principal'];
    const currentProduct = sale['Produto'];
    
    if (mainTransaction && mainTransaction !== '(none)') {
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
      productSalesCount[currentProduct] = 
        (productSalesCount[currentProduct] || 0) + 1;
    }
  });
  
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
      const { product } = mapping;
      refundsByProduct[product] = (refundsByProduct[product] || 0) + 1;
    } else {
      const productName = r['Produto'];
      refundsByProduct[productName] = (refundsByProduct[productName] || 0) + 1;
    }
  });
  
  return {
    project: 'Grava Simples',
    platform: 'Hotmart',
    sales: salesByProduct,
    salesByOrigin: salesByOrigin,
    bumpRelations: bumpRelations,
    bumpConversionRates: bumpConversionRates,
    refunds: {
      total: refunds.length,
      byProduct: refundsByProduct
    },
    unknownCodes: unknownCodes
  };
}

// ============================================
// ENDPOINTS
// ============================================

app.post('/api/process-hubla', upload.single('file'), (req, res) => {
  try {
    const filePath = req.file.path;
    const fileName = req.file.originalname.toLowerCase();
    
    let csvText;
    
    if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
      csvText = xlsxToCSV(filePath);
    } else {
      csvText = fs.readFileSync(filePath, 'utf8');
    }
    
    const parsed = Papa.parse(csvText, { 
      header: true, 
      dynamicTyping: true,
      skipEmptyLines: true 
    });
    
    const results = processHubla(parsed.data);
    
    fs.unlinkSync(filePath); // Limpar arquivo temporário
    res.json(results);
  } catch (error) {
    console.error('Erro ao processar Hubla:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/process-hotmart', upload.single('file'), (req, res) => {
  try {
    const filePath = req.file.path;
    const fileName = req.file.originalname.toLowerCase();
    
    let csvText;
    
    if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
      csvText = xlsxToCSV(filePath);
    } else {
      csvText = fs.readFileSync(filePath, 'utf8');
    }
    
    const result = processHotmart(csvText);
    
    fs.unlinkSync(filePath); // Limpar arquivo temporário
    res.json(result);
  } catch (error) {
    console.error('Erro ao processar Hotmart:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../dist/index.html'));
});

const PORT = process.env.PORT || 80;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
