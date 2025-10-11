const fs = require('fs');
const path = require('path');

console.log('📈 Metrics Analyzer - Gerador de Projeto V1');
console.log('===========================================\n');

// Criar estrutura de pastas
const folders = ['server', 'src'];
folders.forEach(folder => {
  if (!fs.existsSync(folder)) {
    fs.mkdirSync(folder, { recursive: true });
    console.log(`✅ Pasta criada: ${folder}/`);
  }
});

// Conteúdo dos arquivos
const files = {
  'package.json': `{
  "name": "metrics-analyzer",
  "version": "1.0.0",
  "description": "Microsserviço para análise de métricas Perettas e Grava Simples",
  "main": "server/index.js",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "server": "node server/index.js",
    "start": "node server/index.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "multer": "^1.4.5-lts.1",
    "papaparse": "^5.4.1",
    "lodash": "^4.17.21"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.2.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "vite": "^5.0.0",
    "tailwindcss": "^3.4.0",
    "autoprefixer": "^10.4.16",
    "postcss": "^8.4.32"
  }
}`,

  'Dockerfile': `# Multi-stage build
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm install

# Copy source code
COPY . .

# Build frontend
RUN npm run build

# Production stage
FROM node:18-alpine

WORKDIR /app

# Copy package files and install production dependencies
COPY package*.json ./
RUN npm install --production

# Copy built files from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server ./server

# Expose port
EXPOSE 3000

# Start server
CMD ["node", "server/index.js"]`,

  '.dockerignore': `node_modules
npm-debug.log
dist
.git
.gitignore
README.md
.env
*.log`,

  '.gitignore': `node_modules
dist
.env
*.log
.DS_Store`,

  'vite.config.js': `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true
      }
    }
  }
});`,

  'tailwind.config.js': `/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}`,

  'postcss.config.js': `export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}`,

  'index.html': `<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Metrics Analyzer</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>`,

  'src/main.jsx': `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);`,

  'src/index.css': `@tailwind base;
@tailwind components;
@tailwind utilities;

@layer utilities {
  .animate-fadeIn {
    animation: fadeIn 0.5s ease-in;
  }
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}`,

  'src/App.jsx': `import React, { useState } from 'react';
import './index.css';

function App() {
  const [selectedProject, setSelectedProject] = useState('perettas');
  const [file, setFile] = useState(null);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
    setError(null);
  };

  const handleProcess = async () => {
    if (!file) {
      setError('Por favor, selecione um arquivo CSV');
      return;
    }

    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const endpoint = selectedProject === 'perettas' ? '/api/process/hubla' : '/api/process/hotmart';
      const response = await fetch(endpoint, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) throw new Error('Erro ao processar arquivo');

      const data = await response.json();
      setResults(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const renderPerettasResults = () => {
    if (!results) return null;

    return (
      <div className="space-y-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-xl font-bold mb-4 text-gray-800">📊 Métricas Principais</h3>
          
          <div className="mb-6">
            <h4 className="font-semibold text-lg mb-2 text-blue-600">Conversões - LDR: {results.sales.ldr.total}</h4>
            <div className="ml-4 space-y-1">
              {Object.entries(results.sales.ldr.byOrigin).map(([origin, count]) => (
                <div key={origin} className="flex justify-between text-gray-700">
                  <span>{origin}:</span>
                  <span className="font-medium">{count}</span>
                </div>
              ))}
            </div>
            {results.sales.ldr.refunds > 0 && (
              <div className="mt-2 text-red-600">
                Reembolsos: {results.sales.ldr.refunds}
              </div>
            )}
          </div>

          <div className="mb-6">
            <h4 className="font-semibold text-lg mb-2 text-green-600">Conversões - RNP: {results.sales.rnp.total}</h4>
            <div className="ml-4 space-y-1">
              {Object.entries(results.sales.rnp.byOrigin).map(([origin, count]) => (
                <div key={origin} className="flex justify-between text-gray-700">
                  <span>{origin}:</span>
                  <span className="font-medium">{count}</span>
                </div>
              ))}
            </div>
            {results.sales.rnp.refunds > 0 && (
              <div className="mt-2 text-red-600">
                Reembolsos: {results.sales.rnp.refunds}
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-xl font-bold mb-4 text-gray-800">💎 Bumps - Taxa de Conversão</h3>
          <div className="space-y-2">
            {Object.entries(results.bumps.conversionRates).map(([bump, rate]) => (
              <div key={bump} className="flex justify-between items-center bg-gray-50 p-3 rounded">
                <span className="text-gray-700">{bump}</span>
                <span className="font-bold text-purple-600">{rate}</span>
              </div>
            ))}
          </div>
          
          <div className="mt-4 pt-4 border-t">
            <h4 className="font-semibold mb-2">Quantidade de Vendas:</h4>
            {Object.entries(results.bumps.counts).map(([bump, count]) => (
              <div key={bump} className="flex justify-between text-gray-600">
                <span>{bump}:</span>
                <span className="font-medium">{count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderGravaResults = () => {
    if (!results) return null;

    return (
      <div className="space-y-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-xl font-bold mb-4 text-gray-800">📊 Vendas Totais</h3>
          <div className="grid grid-cols-2 gap-4">
            {Object.entries(results.sales).map(([product, count]) => (
              <div key={product} className="bg-blue-50 p-4 rounded-lg">
                <div className="text-sm text-gray-600">{product}</div>
                <div className="text-2xl font-bold text-blue-600">{count}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-xl font-bold mb-4 text-gray-800">💎 Taxa de Bump</h3>
          <div className="space-y-2">
            {Object.entries(results.bumpRates).map(([bump, rate]) => (
              <div key={bump} className="flex justify-between items-center bg-purple-50 p-3 rounded">
                <span className="text-gray-700">{bump}</span>
                <span className="font-bold text-purple-600">{rate}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-xl font-bold mb-4 text-gray-800">🎯 Vendas por Origem</h3>
          {Object.entries(results.salesByOrigin).map(([product, origins]) => (
            <div key={product} className="mb-4 pb-4 border-b last:border-b-0">
              <h4 className="font-semibold text-green-600 mb-2">{product}</h4>
              <div className="ml-4 space-y-1">
                {Object.entries(origins).map(([origin, count]) => (
                  <div key={origin} className="flex justify-between text-gray-700">
                    <span>{origin}:</span>
                    <span className="font-medium">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <header className="mb-8 text-center">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">📈 Metrics Analyzer</h1>
          <p className="text-gray-600">Análise automatizada de métricas semanais</p>
        </header>

        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Selecione o Projeto
            </label>
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => {
                  setSelectedProject('perettas');
                  setResults(null);
                  setFile(null);
                }}
                className={\`p-4 rounded-lg border-2 transition-all \${
                  selectedProject === 'perettas'
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-200 hover:border-gray-300'
                }\`}
              >
                <div className="font-bold">Perettas</div>
                <div className="text-sm text-gray-500">Hubla</div>
              </button>
              <button
                onClick={() => {
                  setSelectedProject('grava-simples');
                  setResults(null);
                  setFile(null);
                }}
                className={\`p-4 rounded-lg border-2 transition-all \${
                  selectedProject === 'grava-simples'
                    ? 'border-purple-500 bg-purple-50 text-purple-700'
                    : 'border-gray-200 hover:border-gray-300'
                }\`}
              >
                <div className="font-bold">Grava Simples</div>
                <div className="text-sm text-gray-500">Hotmart</div>
              </button>
            </div>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Upload do Relatório CSV
            </label>
            <input
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
            {file && (
              <p className="mt-2 text-sm text-green-600">
                ✓ Arquivo selecionado: {file.name}
              </p>
            )}
          </div>

          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
              {error}
            </div>
          )}

          <button
            onClick={handleProcess}
            disabled={loading || !file}
            className="w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white py-3 px-6 rounded-lg font-semibold hover:from-blue-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {loading ? 'Processando...' : 'Analisar Métricas'}
          </button>
        </div>

        {results && (
          <div className="animate-fadeIn">
            {selectedProject === 'perettas' ? renderPerettasResults() : renderGravaResults()}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;`,

  'server/index.js': `const express = require('express');
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

// Mapeamentos
const HUBLA_MAPPINGS = {
  'instagram|destaques': 'Instagram | Destaques',
  'instagram|bio': 'Instagram | Bio',
  'instagram|reels': 'Instagram | Reels',
  'meta-ads': 'Trafego',
  'hubla': 'Hubla | Área de membros',
  'whatsapp|renovacao': 'Whatsapp | Renovação',
  'whatsapp|upsell': 'Whatsapp | Upsell',
  'active|recuperacao': 'Active | Recuperação',
  'notion': 'Notion'
};

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
  
  const key = \`\${origem.toLowerCase()}|\${(termo || '').toLowerCase()}\`;
  
  if (HUBLA_MAPPINGS[key]) return HUBLA_MAPPINGS[key];
  
  if (origem.toLowerCase() === 'meta-ads') return 'Trafego';
  if (origem.toLowerCase() === 'instagram' && termo) {
    return \`Instagram | \${termo.charAt(0).toUpperCase() + termo.slice(1)}\`;
  }
  if (origem.toLowerCase() === 'hubla') return 'Hubla | Área de membros';
  
  return 'N/A';
}

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
  console.log(\`Server running on port \${PORT}\`);
});`,

  'README.md': `# 📈 Metrics Analyzer V1

Microsserviço para análise automatizada de métricas semanais.

## 🚀 Quick Start

\`\`\`bash
npm install
npm run build
npm start
\`\`\`

## 📖 Documentação Completa

Veja o arquivo CHECKLIST-DEPLOY.md para instruções completas de deploy.

## 🎯 Uso

1. Acesse a aplicação
2. Selecione o projeto (Perettas ou Grava Simples)
3. Upload do CSV
4. Visualize as métricas

## 🔧 Stack

- React + Vite + TailwindCSS
- Node.js + Express
- Docker

## 📦 Deploy

Deploy no EasyPanel via GitHub ou upload direto.
Porta: 3000
`
};

// Criar todos os arquivos
Object.entries(files).forEach(([filename, content]) => {
  fs.writeFileSync(filename, content);
  console.log(\`✅ Arquivo criado: \${filename}\`);
});

console.log('\\n✨ Projeto gerado com sucesso!\\n');
console.log('📋 Próximos passos:\\n');
console.log('1. npm install');
console.log('2. npm run build');
console.log('3. npm start\\n');
console.log('Para deploy:');
console.log('git init');
console.log('git add .');
console.log('git commit -m "Initial commit"');
console.log('git push\\n');
