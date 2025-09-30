// currency-config.js - Sistema de gestión de tipos de cambio
(function() {
  'use strict';

  // Configuración global de monedas
  const currencyConfig = {
    // Tipos de cambio base (USD como referencia)
    exchangeRates: {
      USD_TO_CUP: 395,    // 1 USD = 395 CUP
      EUR_TO_USD: 1.08,   // 1 EUR = 1.08 USD (opcional)
      // Puedes agregar más monedas aquí
    },
    
    // Formato de monedas
    formats: {
      USD: { decimals: 2, symbol: '$', suffix: ' usd' },
      CUP: { decimals: 0, symbol: '$', suffix: ' cup' },
    }
  };

  // Funciones de conversión
  const currencyConverter = {
    // Convertir USD a CUP
    usdToCup(usdAmount) {
      return (parseFloat(usdAmount) || 0) * currencyConfig.exchangeRates.USD_TO_CUP;
    },

    // Convertir CUP a USD
    cupToUsd(cupAmount) {
      return (parseFloat(cupAmount) || 0) / currencyConfig.exchangeRates.USD_TO_CUP;
    },

    // Formatear moneda según configuración
    formatCurrency(amount, currency = 'USD') {
      const config = currencyConfig.formats[currency];
      if (!config) return amount.toString();
      
      const formatted = parseFloat(amount).toFixed(config.decimals);
      return formatted + config.suffix;
    },

    // Actualizar tipo de cambio
    updateExchangeRate(fromCurrency, toCurrency, rate) {
      const key = `${fromCurrency}_TO_${toCurrency}`;
      currencyConfig.exchangeRates[key] = parseFloat(rate);
      
      // Guardar en localStorage para persistencia
      this.saveConfig();
      
      // Disparar evento personalizado para notificar cambios
      window.dispatchEvent(new CustomEvent('currencyRatesUpdated', {
        detail: { fromCurrency, toCurrency, rate }
      }));
    },

    // Obtener tipo de cambio actual
    getExchangeRate(fromCurrency, toCurrency) {
      const key = `${fromCurrency}_TO_${toCurrency}`;
      return currencyConfig.exchangeRates[key] || 1;
    },

    // Guardar configuración
    saveConfig() {
      try {
        localStorage.setItem('currencyConfig', JSON.stringify(currencyConfig));
      } catch (error) {
        console.warn('No se pudo guardar la configuración de monedas:', error);
      }
    },

    // Cargar configuración guardada
    loadConfig() {
      try {
        const saved = localStorage.getItem('currencyConfig');
        if (saved) {
          const savedConfig = JSON.parse(saved);
          // Mergear configuraciones
          Object.assign(currencyConfig.exchangeRates, savedConfig.exchangeRates);
        }
      } catch (error) {
        console.warn('No se pudo cargar la configuración de monedas:', error);
      }
    }
  };

  // Cargar configuración al iniciar
  currencyConverter.loadConfig();

  // Exponer globalmente
  window.currencyConfig = currencyConfig;
  window.currencyConverter = currencyConverter;

  // Event listener para cambios de tipo de cambio
  window.addEventListener('currencyRatesUpdated', function(event) {
    console.log('Tipo de cambio actualizado:', event.detail);
    
    // Actualizar automáticamente los elementos visibles que muestran precios
    updateVisiblePrices();
  });

  // Función para actualizar precios visibles en la interfaz
  function updateVisiblePrices() {
    // Actualizar celdas editables con precios CUP
    document.querySelectorAll('[data-value][onclick*="precio_cup"]').forEach(cell => {
      const usdValue = parseFloat(cell.dataset.usdValue || 0);
      if (usdValue > 0) {
        const newCupValue = currencyConverter.usdToCup(usdValue);
        cell.textContent = currencyConverter.formatCurrency(newCupValue, 'CUP');
        cell.dataset.value = newCupValue;
      }
    });

    // Actualizar inputs de formularios
    const cupInputs = document.querySelectorAll('input[id*="cup"], input[id*="Cup"]');
    cupInputs.forEach(input => {
      const correspondingUsdInput = document.querySelector(`input[id="${input.id.replace('cup', 'usd').replace('Cup', 'Usd')}"]`);
      if (correspondingUsdInput && correspondingUsdInput.value) {
        const usdValue = parseFloat(correspondingUsdInput.value);
        input.value = currencyConverter.usdToCup(usdValue).toFixed(0);
      }
    });
  }

})();