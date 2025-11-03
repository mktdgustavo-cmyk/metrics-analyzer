import React, { useState } from 'react';
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
      setError('Por favor, selecione um arquivo CSV ou XLSX');
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
          
          {results.sales.ldr.categorias && (
            <div className="mb-3 p-3 bg-blue-50 rounded-lg">
              <h5 className="font-semibold text-sm text-blue-700 mb-2">📊 Distribuição por Oferta</h5>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white p-2 rounded text-center">
                  <div className="text-xs text-gray-500">LDR 77</div>
                  <div className="text-lg font-bold text-blue-600">
                    {results.sales.ldr.categorias.ldr77.quantidade}
                  </div>
                  <div className="text-xs text-gray-600">
                    {results.sales.ldr.categorias.ldr77.percentual}
                  </div>
                </div>
                <div className="bg-white p-2 rounded text-center">
                  <div className="text-xs text-gray-500">LDR 147</div>
                  <div className="text-lg font-bold text-purple-600">
                    {results.sales.ldr.categorias.ldr147.quantidade}
                  </div>
                  <div className="text-xs text-gray-600">
                    {results.sales.ldr.categorias.ldr147.percentual}
                  </div>
                </div>
              </div>
              {results.sales.ldr.categorias.outros.quantidade > 0 && (
                <div className="mt-2 text-xs text-gray-500 text-center">
                  Outras ofertas: {results.sales.ldr.categorias.outros.quantidade}
                </div>
              )}
            </div>
          )}
          
          <div className="ml-4 space-y-1">
            {Object.entries(results.sales.ldr.byOrigin).map(([origin, count]) => (
              <div key={origin} className="flex justify-between text-gray-700">
                <span>{origin}:</span>
                <span className="font-medium">{count}</span>
              </div>
            ))}
          </div>
          {results.sales.ldr.refunds > 0 && (
            <div className={`mt-2 ${results.sales.ldr.refunds > 0 ? 'text-red-600' : 'text-gray-500'}`}>
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
           <div className={`mt-2 ${results.sales.rnp.refunds > 0 ? 'text-red-600' : 'text-gray-500'}`}>
  Reembolsos: {results.sales.rnp.refunds}
</div>
          )}
        </div>
      </div>

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
                className={`p-4 rounded-lg border-2 transition-all ${
                  selectedProject === 'perettas'
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
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
                className={`p-4 rounded-lg border-2 transition-all ${
                  selectedProject === 'grava-simples'
                    ? 'border-purple-500 bg-purple-50 text-purple-700'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="font-bold">Grava Simples</div>
                <div className="text-sm text-gray-500">Hotmart</div>
              </button>
            </div>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Upload do Relatório (CSV ou XLSX)
            </label>
            <input
              type="file"
              accept=".csv,.xlsx,.xls"
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

export default App;
