import React, { useState } from 'react';

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
      setError('Por favor, selecione um arquivo');
      return;
    }

    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const endpoint = selectedProject === 'perettas' 
        ? '/api/process-hubla' 
        : '/api/process-hotmart';

      const response = await fetch(`http://localhost:5000${endpoint}`, {
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-4xl font-bold text-gray-800 mb-8 text-center">
          📊 Dashboard de Vendas
        </h1>

        {/* Seletor de Projeto */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Selecione o Projeto
          </label>
          <select
            value={selectedProject}
            onChange={(e) => setSelectedProject(e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="perettas">Perettas (Hubla)</option>
            <option value="gravacao">Gravação (Hotmart)</option>
          </select>
        </div>

        {/* Upload */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Upload da Planilha
          </label>
          <input
            type="file"
            accept=".csv,.xlsx"
            onChange={handleFileChange}
            className="w-full p-3 border border-gray-300 rounded-lg"
          />
          <button
            onClick={handleProcess}
            disabled={loading}
            className="mt-4 w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg transition disabled:opacity-50"
          >
            {loading ? 'Processando...' : 'Processar Planilha'}
          </button>
        </div>

        {/* Erro */}
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {/* Resultados - PERETTAS */}
        {results && selectedProject === 'perettas' && (
          <div className="space-y-6">
            {/* Período */}
            {results.period && (
              <div className="bg-white rounded-lg shadow-lg p-6">
                <h3 className="text-xl font-bold mb-2 text-gray-800">📅 Período</h3>
                <p className="text-gray-600">
                  {results.period.start} até {results.period.end}
                </p>
              </div>
            )}

            {/* Alertas de produtos não mapeados */}
            {results.unmappedProducts && results.unmappedProducts.length > 0 && (
              <div className="bg-yellow-100 border border-yellow-400 text-yellow-800 px-4 py-3 rounded-lg">
                <h4 className="font-bold mb-2">⚠️ Produtos não identificados:</h4>
                <ul className="list-disc list-inside">
                  {results.unmappedProducts.map((p, i) => (
                    <li key={i}>{p}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Vendas por Produto */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h3 className="text-xl font-bold mb-4 text-gray-800">💰 Vendas por Produto</h3>
              <div className="space-y-4">
                {Object.entries(results.sales).map(([key, data]) => (
                  <div key={key} className="border-l-4 border-blue-500 pl-4">
                    <div className="flex justify-between items-center mb-2">
                      <h4 className="font-semibold text-lg">{data.displayName}</h4>
                      <span className="text-2xl font-bold text-blue-600">
                        {data.total}
                      </span>
                    </div>
                    
                    {/* Origem */}
                    <div className="text-sm space-y-1">
                      {Object.entries(data.byOrigin).map(([origin, count]) => (
                        <div key={origin} className="flex justify-between text-gray-600">
                          <span>{origin}:</span>
                          <span className="font-medium">{count}</span>
                        </div>
                      ))}
                    </div>
                    
                    {/* Reembolsos */}
                    {results.refunds[key] > 0 && (
                      <div className="mt-2 text-red-600 text-sm">
                        ❌ Reembolsos: {results.refunds[key]}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Categorias LDR */}
            {results.ldrCategories && results.ldrCategories.quantities && (
              <div className="bg-white rounded-lg shadow-lg p-6">
                <h3 className="text-xl font-bold mb-4 text-gray-800">
                  📊 Distribuição LDR (77 vs 147)
                </h3>
                
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-lg text-center">
                    <div className="text-sm text-gray-600 mb-1">LDR 77</div>
                    <div className="text-3xl font-bold text-blue-600">
                      {results.ldrCategories.quantities.ldr77}
                    </div>
                    <div className="text-lg text-gray-700 mt-1">
                      {results.ldrCategories.percentages.ldr77}
                    </div>
                  </div>
                  
                  <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-4 rounded-lg text-center">
                    <div className="text-sm text-gray-600 mb-1">LDR 147</div>
                    <div className="text-3xl font-bold text-purple-600">
                      {results.ldrCategories.quantities.ldr147}
                    </div>
                    <div className="text-lg text-gray-700 mt-1">
                      {results.ldrCategories.percentages.ldr147}
                    </div>
                  </div>
                </div>
                
                {/* Outras categorias */}
                {(results.ldrCategories.quantities.ldr244 > 0 || 
                  results.ldrCategories.quantities.outros > 0) && (
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    {results.ldrCategories.quantities.ldr244 > 0 && (
                      <div className="bg-gray-50 p-3 rounded text-center">
                        <div className="text-gray-600">LDR 244</div>
                        <div className="font-bold text-gray-800">
                          {results.ldrCategories.quantities.ldr244} ({results.ldrCategories.percentages.ldr244})
                        </div>
                      </div>
                    )}
                    {results.ldrCategories.quantities.outros > 0 && (
                      <div className="bg-gray-50 p-3 rounded text-center">
                        <div className="text-gray-600">Outros</div>
                        <div className="font-bold text-gray-800">
                          {results.ldrCategories.quantities.outros} ({results.ldrCategories.percentages.outros})
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Order Bumps */}
            {results.bumps && Object.keys(results.bumps).length > 0 && (
              <div className="bg-white rounded-lg shadow-lg p-6">
                <h3 className="text-xl font-bold mb-4 text-gray-800">
                  🎁 Order Bumps - Taxa de Conversão
                </h3>
                
                {Object.entries(results.bumps).map(([productKey, productData]) => (
                  <div key={productKey} className="mb-6 last:mb-0">
                    <h4 className="font-semibold text-lg mb-3 text-blue-600">
                      {productData.displayName}
                    </h4>
                    
                    <div className="space-y-2">
                      {Object.entries(productData.bumps).map(([bumpKey, bumpData]) => (
                        <div 
                          key={bumpKey} 
                          className="flex items-center justify-between bg-gray-50 p-3 rounded-lg"
                        >
                          <div>
                            <div className="font-medium">{bumpData.displayName}</div>
                            <div className="text-xs text-gray-500">
                              Base: {bumpData.basePrincipal} vendas
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-2xl font-bold text-green-600">
                              {bumpData.taxa}
                            </div>
                            <div className="text-sm text-gray-600">
                              {bumpData.quantidade} vendas
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Resumo */}
            <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg shadow-lg p-6 text-white">
              <h3 className="text-xl font-bold mb-4">📈 Resumo Geral</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm opacity-90">Total de Vendas</div>
                  <div className="text-3xl font-bold">{results.totalSales}</div>
                </div>
                <div>
                  <div className="text-sm opacity-90">Total de Reembolsos</div>
                  <div className="text-3xl font-bold">{results.totalRefunds}</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Resultados - GRAVAÇÃO (placeholder) */}
        {results && selectedProject === 'gravacao' && (
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h3 className="text-xl font-bold text-gray-800">
              Resultados da Gravação (Hotmart)
            </h3>
            <pre className="mt-4 text-xs overflow-auto">
              {JSON.stringify(results, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
