class InventoryManager {
  constructor() {
    this.productos = [];
    this.categorias = [];
    this.subcategorias = [];
    this.filteredProducts = [];
    this.isEditing = false;
    this.editingCell = null;

    // Configuración de columnas visibles
    this.columnConfig = {
      stock: true,
      producto: true,
      cantidad: true,
      precio_usd: true,
      precio_cup: true,
      oprecio_cup: true,
      pxg_cup: true,
      extracciones: true,
      defectuosos: true,
      acciones: true
    };

    // Definición de columnas disponibles
    this.availableColumns = [
      { key: 'stock', label: 'Stock (fx)', required: true },
      { key: 'producto', label: 'Productos', required: true },
      { key: 'cantidad', label: 'Cantidad (u)', required: false },
      { key: 'precio_usd', label: 'Precio (USD)', required: false },
      { key: 'precio_cup', label: 'Precio (CUP x Tc) (fx)', required: false },
      { key: 'oprecio_cup', label: 'oPrecio (CUP)', required: false },
      { key: 'pxg_cup', label: 'PxG (CUP)', required: false },
      { key: 'extracciones', label: 'Extracciones(fx)', required: false },
      { key: 'defectuosos', label: 'Defectuosos(fx)', required: false },
      { key: 'acciones', label: 'Acciones', required: true }
    ];
  }

  // Inicializar aplicación
  async init() {
    console.log('Iniciando aplicación de inventario...');
    
    let user = null;
    if (window.sessionManager && typeof window.sessionManager.getCurrentUser === 'function') {
      try {
        user = window.sessionManager.getCurrentUser();
        if (user) {
          console.log('Usuario autenticado:', user.username);
        } else {
          console.warn('No hay sesión activa, pero continuando...');
        }
      } catch (error) {
        console.warn('Error obteniendo usuario:', error);
      }
    } else {
      console.warn('SessionManager no disponible, continuando sin validación...');
    }

    this.createParticles();
    this.setupEventListeners();
    this.setupModalEvents();
    this.loadColumnConfig();
    
    const container = document.getElementById('productsContainer');
    container.innerHTML = `
      <div class="loading">
        <div class="spinner"></div>
        <p style="margin-top: 16px; color: #718096;">Conectando con la base de datos...</p>
      </div>
    `;
    
    const connectionOk = await this.testConnection();
    if (!connectionOk) {
      return;
    }
    
    await this.loadInitialData();
  }

  // Crear partículas animadas
  createParticles() {
    const particles = document.querySelector('.particles');
    for (let i = 0; i < 20; i++) {
      const particle = document.createElement('div');
      particle.className = 'particle';
      particle.style.left = Math.random() * 100 + '%';
      particle.style.top = Math.random() * 100 + '%';
      particle.style.width = Math.random() * 6 + 3 + 'px';
      particle.style.height = particle.style.width;
      particle.style.animationDuration = Math.random() * 4 + 4 + 's';
      particle.style.animationDelay = Math.random() * 2 + 's';
      particles.appendChild(particle);
    }
  }

  // Configurar event listeners
  setupEventListeners() {
    const searchInput = document.getElementById('searchInput');
    searchInput.addEventListener('input', () => this.filterProducts());
    
    document.getElementById('categoriaFilter').addEventListener('change', () => this.filterProducts());
    document.getElementById('subcategoriaFilter').addEventListener('change', () => this.filterProducts());
    document.getElementById('stockFilter').addEventListener('change', () => this.filterProducts());
    document.getElementById('showZeroStock').addEventListener('change', () => this.filterProducts());
    document.getElementById('categoriaFilter').addEventListener('change', () => this.updateSubcategoriaFilter());
    document.getElementById('productCategoria').addEventListener('change', () => this.updateSubcategoriaModal());
    document.getElementById('productForm').addEventListener('submit', (e) => this.saveProduct(e));
    
    document.getElementById('productPriceUsd').addEventListener('input', function() {
      const usd = parseFloat(this.value) || 0;
      const cup = usd * 395;
      document.getElementById('productPriceCup').value = cup.toFixed(2);
    });
    
    searchInput.addEventListener('input', function() {
      const clearBtn = document.getElementById('clearSearch');
      clearBtn.style.display = this.value ? 'block' : 'none';
    });
  }

  // Setup eventos de modales
  setupModalEvents() {
    document.querySelectorAll('.modal').forEach(modal => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          modal.classList.remove('show');
          if (this.isEditing) {
            this.cancelEditing();
          }
        }
      });
    });
    
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        document.querySelectorAll('.modal.show').forEach(modal => {
          modal.classList.remove('show');
        });
        if (this.isEditing) {
          this.cancelEditing();
        }
      }
    });
  }

  // Cargar configuración de columnas
  loadColumnConfig() {
    // Mantener configuración por defecto
    this.columnConfig = {
      stock: true,
      producto: true,
      cantidad: true,
      precio_usd: true,
      precio_cup: true,
      oprecio_cup: true,
      pxg_cup: true,
      extracciones: true,
      defectuosos: true,
      acciones: true
    };
  }

  // Probar conexión con base de datos
  async testConnection() {
    try {
      console.log('Probando conexión con la base de datos...');
      
      if (!window.api || typeof window.api.listarCategorias !== 'function') {
        console.error('APIs no disponibles - window.api:', window.api);
        throw new Error('Las APIs de Electron no están disponibles. Verifica que preload.js esté cargado correctamente.');
      }
      
      const testResult = await Promise.race([
        window.api.listarCategorias(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout de conexión - La base de datos no responde')), 5000)
        )
      ]);
      
      console.log('Conexión exitosa, categorías encontradas:', testResult?.length || 0);
      return true;
    } catch (error) {
      console.error('Error de conexión:', error);
      
      const container = document.getElementById('productsContainer');
      let errorMessage = 'Error de conexión desconocido';
      
      if (error.message.includes('APIs no están disponibles')) {
        errorMessage = 'Error: Las APIs de Electron no están cargadas.<br>Reinicia la aplicación.';
      } else if (error.message.includes('Timeout')) {
        errorMessage = 'Error: La base de datos no responde.<br>Verifica que PostgreSQL esté funcionando.';
      } else if (error.message.includes('ECONNREFUSED')) {
        errorMessage = 'Error: No se puede conectar a PostgreSQL.<br>Verifica que el servidor de base de datos esté corriendo.';
      } else {
        errorMessage = `Error: ${error.message}`;
      }
      
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">⚠️</div>
          <h3 class="empty-title">Problema de Conexión</h3>
          <p class="empty-description">${errorMessage}</p>
          <div style="margin-top: 20px;">
            <button class="btn btn-primary" onclick="location.reload()" style="margin-right: 10px;">
              🔄 Reintentar
            </button>
            <button class="btn btn-secondary" onclick="goBack()">
              ← Regresar
            </button>
          </div>
        </div>
      `;
      return false;
    }
  }

  // Cargar datos iniciales
  async loadInitialData() {
    try {
      console.log('Iniciando carga de datos...');
      
      const categoriesPromise = window.api.listarCategorias();
      const categoriesTimeout = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout cargando categorías')), 10000)
      );
      
      this.categorias = await Promise.race([categoriesPromise, categoriesTimeout]);
      console.log('Categorías cargadas:', this.categorias);
      this.populateCategoriaSelects();
      
      const productosPromise = window.api.listarProductos();
      const productosTimeout = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout cargando productos')), 10000)
      );
      
      this.productos = await Promise.race([productosPromise, productosTimeout]);
      console.log('Productos cargados:', this.productos);
      
      this.filteredProducts = [...this.productos];
      this.displayProducts();
      
      this.showToast('Datos cargados correctamente', 'success');
    } catch (error) {
      console.error('Error cargando datos:', error);
      
      if (error.message.includes('Timeout')) {
        this.showToast('Error: La conexión está tardando mucho. Verifica tu base de datos.', 'error');
      } else {
        this.showToast('Error cargando datos: ' + error.message, 'error');
      }
      
      this.categorias = [];
      this.productos = [];
      this.filteredProducts = [];
      
      this.populateCategoriaSelects();
      this.displayProducts();
    }
  }

  // Utilidades para manipular selectores
  clearSelectOptions(selectElement, defaultText) {
    selectElement.innerHTML = `<option value="">${defaultText}</option>`;
  }

  addSelectOption(selectElement, text, value) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = text;
    selectElement.appendChild(option);
  }

  // Poblar selects de categorías
  populateCategoriaSelects() {
    const categoriaFilter = document.getElementById('categoriaFilter');
    const productCategoria = document.getElementById('productCategoria');
    const subcategoriaParent = document.getElementById('subcategoriaParent');
    
    const filterValue = categoriaFilter?.value || '';
    const modalValue = productCategoria?.value || '';
    const parentValue = subcategoriaParent?.value || '';
    
    if (categoriaFilter) {
      this.clearSelectOptions(categoriaFilter, 'Todas las categorías');
    }
    if (productCategoria) {
      this.clearSelectOptions(productCategoria, 'Seleccione una categoría');
    }
    if (subcategoriaParent) {
      this.clearSelectOptions(subcategoriaParent, 'Seleccionar categoría padre');
    }
    
    this.categorias.forEach(categoria => {
      if (categoriaFilter) {
        this.addSelectOption(categoriaFilter, categoria.nombre, categoria.id);
      }
      if (productCategoria) {
        this.addSelectOption(productCategoria, categoria.nombre, categoria.id);
      }
      if (subcategoriaParent) {
        this.addSelectOption(subcategoriaParent, categoria.nombre, categoria.id);
      }
    });
    
    if (filterValue && categoriaFilter) categoriaFilter.value = filterValue;
    if (modalValue && productCategoria) productCategoria.value = modalValue;
    if (parentValue && subcategoriaParent) subcategoriaParent.value = parentValue;
  }

  // Actualizar subcategorias en filtros
  async updateSubcategoriaFilter() {
    const categoriaId = document.getElementById('categoriaFilter').value;
    const subcategoriaFilter = document.getElementById('subcategoriaFilter');
    
    this.clearSelectOptions(subcategoriaFilter, 'Todas las subcategorías');
    
    if (categoriaId && window.api.listarSubcategorias) {
      try {
        const subcategoriasData = await window.api.listarSubcategorias(categoriaId);
        subcategoriasData.forEach(sub => {
          this.addSelectOption(subcategoriaFilter, sub.nombre, sub.id);
        });
      } catch (error) {
        console.error('Error cargando subcategorías:', error);
      }
    }
    
    this.filterProducts();
  }

  // Actualizar subcategorias en modal
  async updateSubcategoriaModal() {
    const categoriaId = document.getElementById('productCategoria').value;
    const subcategoriaSelect = document.getElementById('productSubcategoria');
    
    this.clearSelectOptions(subcategoriaSelect, 'Seleccione una subcategoría');
    
    if (categoriaId && window.api.listarSubcategorias) {
      try {
        const subcategoriasData = await window.api.listarSubcategorias(categoriaId);
        subcategoriasData.forEach(sub => {
          this.addSelectOption(subcategoriaSelect, sub.nombre, sub.id);
        });
      } catch (error) {
        console.error('Error cargando subcategorías:', error);
      }
    }
  }

  // Mostrar toast de notificación
  showToast(message, type = 'info') {
    const existingToasts = document.querySelectorAll('.toast');
    existingToasts.forEach(toast => toast.remove());

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    
    document.body.appendChild(toast);
    
    setTimeout(() => toast.classList.add('show'), 100);
    
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  // Filtrar productos
  filterProducts() {
    const searchTerm = document.getElementById('searchInput')?.value.toLowerCase() || '';
    const categoriaId = document.getElementById('categoriaFilter')?.value || '';
    const subcategoriaId = document.getElementById('subcategoriaFilter')?.value || '';
    const stockFilter = document.getElementById('stockFilter')?.value || '';
    const showZeroStock = document.getElementById('showZeroStock')?.checked ?? true;

    this.filteredProducts = this.productos.filter(producto => {
      const matchSearch = !searchTerm || 
        producto.nombre.toLowerCase().includes(searchTerm) ||
        (producto.descripcion && producto.descripcion.toLowerCase().includes(searchTerm));
      
      const matchCategoria = !categoriaId || producto.categoria_id == categoriaId;
      const matchSubcategoria = !subcategoriaId || producto.subcategoria_id == subcategoriaId;
      
      let matchStock = true;
      if (stockFilter === 'high') matchStock = producto.stock > 20;
      else if (stockFilter === 'medium') matchStock = producto.stock >= 6 && producto.stock <= 20;
      else if (stockFilter === 'low') matchStock = producto.stock >= 1 && producto.stock <= 5;
      else if (stockFilter === 'empty') matchStock = producto.stock === 0;

      const matchZeroStock = showZeroStock || producto.stock > 0;

      return matchSearch && matchCategoria && matchSubcategoria && matchStock && matchZeroStock;
    });

    this.displayProducts();
  }

  // Mostrar productos
  displayProducts() {
    const container = document.getElementById('productsContainer');
    const productCount = document.getElementById('productCount');
    
    if (productCount) {
      productCount.textContent = this.filteredProducts.length;
    }

    if (this.filteredProducts.length === 0) {
      container.innerHTML = `
        <div class="empty-state fade-in">
          <div class="empty-icon">📦</div>
          <h3 class="empty-title">No hay productos</h3>
          <p class="empty-description">
            ${this.productos.length === 0 ? 
              'Aún no has agregado productos a tu inventario.' : 
              'No se encontraron productos con los filtros aplicados.'}
          </p>
        </div>
      `;
      return;
    }

    // Generar headers de tabla dinámicamente
    let headers = '';
    if (this.columnConfig.stock) headers += '<th style="min-width: 80px;">Stock (u)</th>';
    headers += '<th style="min-width: 120px;">Categoría</th>';
    if (this.columnConfig.producto) headers += '<th style="min-width: 200px;">Productos</th>';
    if (this.columnConfig.cantidad) headers += '<th style="min-width: 80px;">Cantidad (u)</th>';
    if (this.columnConfig.precio_usd) headers += '<th style="min-width: 120px;">Precio (USD)</th>';
    if (this.columnConfig.precio_cup) headers += '<th style="min-width: 140px;">Precio (CUP)</th>';
    if (this.columnConfig.oprecio_cup) headers += '<th style="min-width: 120px;">oPrecio (CUP x Tc)</th>';
    if (this.columnConfig.pxg_cup) headers += '<th style="min-width: 100px;">PxG (CUP)</th>';
    if (this.columnConfig.extracciones) headers += '<th style="min-width: 100px;">Extracciones</th>';
    if (this.columnConfig.defectuosos) headers += '<th style="min-width: 100px;">Defectuosos</th>';
    if (this.columnConfig.acciones) headers += '<th style="min-width: 120px;">Acciones</th>';

    const rows = this.filteredProducts.map(producto => {
      let cells = '';
      
      if (this.columnConfig.stock) {
        cells += `<td class="stock-cell ${this.getStockClass(producto.stock)}">${producto.stock} u</td>`;
      }
      
      cells += `<td style="text-align: center; font-weight: 500; color: #4a5568;">${this.getCategoriaName(producto.categoria_id) || 'Sin categoría'}</td>`;
      
      if (this.columnConfig.producto) {
        cells += `<td><div class="product-name">${this.escapeHtml(producto.nombre)}</div></td>`;
      }
      
      if (this.columnConfig.cantidad) {
        cells += `<td>${producto.cantidad || 1} u</td>`;
      }
      
      if (this.columnConfig.precio_usd) {
        cells += `<td class="price-cell">${parseFloat(producto.precio_usd || 0).toFixed(2)} usd</td>`;
      }
      
      if (this.columnConfig.precio_cup) {
        cells += `<td class="price-cell">${parseFloat(producto.precio_cup || 0).toFixed(0)} cup</td>`;
      }
      
      if (this.columnConfig.oprecio_cup) {
        cells += `<td class="price-cell">${producto.oprecio_cup ? parseFloat(producto.oprecio_cup).toFixed(0) + ' cup' : ''}</td>`;
      }
      
      if (this.columnConfig.pxg_cup) {
        cells += `<td class="price-cell">${producto.pxg_cup ? parseFloat(producto.pxg_cup).toFixed(0) + ' cup' : ''}</td>`;
      }
      
      if (this.columnConfig.extracciones) {
        cells += `<td>${producto.extracciones || 0}</td>`;
      }
      
      if (this.columnConfig.defectuosos) {
        cells += `<td>${producto.defectuosos || 0}</td>`;
      }
      
      if (this.columnConfig.acciones) {
        cells += `
          <td>
            <div class="table-actions">
              <button class="action-btn btn-edit" onclick="inventoryManager.editProduct(${producto.id})">✏️ Editar</button>
              <button class="action-btn btn-delete" onclick="inventoryManager.deleteProduct(${producto.id}, '${this.escapeHtml(producto.nombre)}')">🗑️ Eliminar</button>
            </div>
          </td>`;
      }

      return `<tr class="${producto.stock === 0 ? 'out-of-stock' : ''}">${cells}</tr>`;
    }).join('');

    const tableHTML = `
      <div class="table-container">
        <table class="products-table fade-in">
          <thead>
            <tr>${headers}</tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </div>
    `;

    container.innerHTML = tableHTML;
  }

  // Utilidades
  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  getStockClass(stock) {
    if (stock === 0) return 'stock-zero';
    if (stock <= 5) return 'stock-low';
    if (stock <= 20) return 'stock-medium';
    return 'stock-high';
  }

  getCategoriaName(categoriaId) {
    const categoria = this.categorias.find(c => c.id == categoriaId);
    return categoria ? categoria.nombre : '';
  }

  // Gestión de productos
  openProductModal(productId = null) {
    this.cancelEditing();
    
    const modal = document.getElementById('productModal');
    const title = document.getElementById('modalTitle');
    
    // Limpiar formulario
    document.getElementById('productId').value = '';
    document.getElementById('productName').value = '';
    document.getElementById('productDescription').value = '';
    document.getElementById('productStock').value = '';
    document.getElementById('productCantidad').value = '1';
    document.getElementById('productPriceUsd').value = '';
    document.getElementById('productPriceCup').value = '';
    document.getElementById('productOPrecioCup').value = '';
    document.getElementById('productPxgCup').value = '';
    document.getElementById('productExtracciones').value = '0';
    document.getElementById('productDefectuosos').value = '0';
    document.getElementById('productCategoria').value = '';
    document.getElementById('productSubcategoria').value = '';
    
    if (productId) {
      const producto = this.productos.find(p => p.id === productId);
      if (producto) {
        title.textContent = 'Editar Producto';
        document.getElementById('productId').value = producto.id;
        document.getElementById('productName').value = producto.nombre || '';
        document.getElementById('productDescription').value = producto.descripcion || '';
        document.getElementById('productStock').value = producto.stock || 0;
        document.getElementById('productCantidad').value = producto.cantidad || 1;
        document.getElementById('productPriceUsd').value = producto.precio_usd || 0;
        document.getElementById('productPriceCup').value = producto.precio_cup || 0;
        document.getElementById('productOPrecioCup').value = producto.oprecio_cup || 0;
        document.getElementById('productPxgCup').value = producto.pxg_cup || 0;
        document.getElementById('productExtracciones').value = producto.extracciones || 0;
        document.getElementById('productDefectuosos').value = producto.defectuosos || 0;
        
        if (producto.categoria_id) {
          document.getElementById('productCategoria').value = producto.categoria_id;
          this.updateSubcategoriaModal().then(() => {
            if (producto.subcategoria_id) {
              document.getElementById('productSubcategoria').value = producto.subcategoria_id;
            }
          });
        }
      }
    } else {
      title.textContent = 'Nuevo Producto';
    }
    
    modal.classList.add('show');
    setTimeout(() => {
      document.getElementById('productName').focus();
    }, 300);
  }

  closeProductModal() {
    document.getElementById('productModal').classList.remove('show');
    this.cancelEditing();
  }

  async saveProduct(e) {
    e.preventDefault();
    
    const productId = document.getElementById('productId').value;
    const isEdit = !!productId;
    
    const productData = {
      nombre: document.getElementById('productName').value.trim(),
      descripcion: document.getElementById('productDescription').value.trim(),
      stock: parseInt(document.getElementById('productStock').value) || 0,
      cantidad: parseInt(document.getElementById('productCantidad').value) || 1,
      precio_usd: parseFloat(document.getElementById('productPriceUsd').value) || 0,
      precio_cup: parseFloat(document.getElementById('productPriceCup').value) || 0,
      oprecio_cup: parseFloat(document.getElementById('productOPrecioCup').value) || 0,
      pxg_cup: parseFloat(document.getElementById('productPxgCup').value) || 0,
      extracciones: parseInt(document.getElementById('productExtracciones').value) || 0,
      defectuosos: parseInt(document.getElementById('productDefectuosos').value) || 0,
      categoria_id: parseInt(document.getElementById('productCategoria').value) || null,
      subcategoria_id: parseInt(document.getElementById('productSubcategoria').value) || null
    };

    if (!productData.nombre) {
      this.showToast('El nombre del producto es requerido', 'error');
      document.getElementById('productName').focus();
      return;
    }

    if (!productData.categoria_id) {
      this.showToast('Debe seleccionar una categoría', 'error');
      document.getElementById('productCategoria').focus();
      return;
    }

    try {
      if (isEdit && window.api.editarProducto) {
        await window.api.editarProducto({ id: parseInt(productId), ...productData });
        const index = this.productos.findIndex(p => p.id == productId);
        if (index !== -1) {
          this.productos[index] = { ...this.productos[index], ...productData };
        }
        this.showToast('Producto actualizado correctamente', 'success');
      } else if (window.api.agregarProducto) {
        const result = await window.api.agregarProducto(productData);
        if (result.success) {
          productData.id = result.id;
          this.productos.push(productData);
          this.showToast('Producto agregado correctamente', 'success');
        }
      } else {
        this.showToast('Funcionalidad de productos en desarrollo', 'info');
        this.closeProductModal();
        return;
      }
      
      this.filterProducts();
      this.closeProductModal();
    } catch (error) {
      console.error('Error guardando producto:', error);
      this.showToast('Error guardando producto', 'error');
    }
  }

  editProduct(productId) {
    this.openProductModal(productId);
  }

  async deleteProduct(productId, productName) {
    this.cancelEditing();

    if (!confirm(`¿Está seguro de eliminar el producto "${productName}"?`)) {
      return;
    }

    try {
      if (window.api.eliminarProducto) {
        await window.api.eliminarProducto(productId);
        this.productos = this.productos.filter(p => p.id !== productId);
        this.filterProducts();
        this.showToast('Producto eliminado correctamente', 'success');
      } else {
        this.showToast('Funcionalidad de eliminación en desarrollo', 'info');
      }
    } catch (error) {
      console.error('Error eliminando producto:', error);
      this.showToast('Error eliminando producto', 'error');
    }
  }

  // Gestión de columnas
  openViewModal() {
    this.cancelEditing();
    
    const columnConfigDiv = document.getElementById('columnConfig');
    
    columnConfigDiv.innerHTML = this.availableColumns.map(col => `
      <div class="column-item">
        <input type="checkbox" 
               id="col_${col.key}" 
               class="column-checkbox" 
               ${this.columnConfig[col.key] ? 'checked' : ''}
               ${col.required ? 'disabled' : ''}
               onchange="inventoryManager.updateColumnConfig('${col.key}', this.checked)">
        <label for="col_${col.key}" class="column-label">
          ${col.label} ${col.required ? '(Requerida)' : ''}
        </label>
      </div>
    `).join('');
    
    document.getElementById('viewModal').classList.add('show');
  }

  closeViewModal() {
    document.getElementById('viewModal').classList.remove('show');
    this.cancelEditing();
  }

  updateColumnConfig(columnKey, isVisible) {
    this.columnConfig[columnKey] = isVisible;
  }

  resetColumns() {
    this.columnConfig = {
      stock: true,
      producto: true,
      cantidad: true,
      precio_usd: true,
      precio_cup: true,
      oprecio_cup: true,
      pxg_cup: true,
      extracciones: true,
      defectuosos: true,
      acciones: true
    };
    
    this.availableColumns.forEach(col => {
      const checkbox = document.getElementById(`col_${col.key}`);
      if (checkbox && !col.required) {
        checkbox.checked = this.columnConfig[col.key];
      }
    });
  }

  applyColumnConfig() {
    this.displayProducts();
    this.closeViewModal();
    this.showToast('Configuración de columnas aplicada', 'success');
  }

  // Gestión de categorías
  openCategoriaModal() {
    this.cancelEditing();
    this.loadCategoriasList();
    document.getElementById('categoriaModal').classList.add('show');
  }

  closeCategoriaModal() {
    document.getElementById('categoriaModal').classList.remove('show');
    this.cancelEditing();
  }

  async loadCategoriasList() {
    const list = document.getElementById('categoriasList');
    
    try {
      list.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
      
      if (window.api.listarCategorias) {
        this.categorias = await window.api.listarCategorias();
      }
      
      list.innerHTML = '';
      
      if (this.categorias.length === 0) {
        const emptyDiv = document.createElement('div');
        emptyDiv.style.cssText = 'padding: 20px; text-align: center; color: #718096;';
        emptyDiv.textContent = 'No hay categorías';
        list.appendChild(emptyDiv);
        return;
      }
      
      for (const categoria of this.categorias) {
        const categoriaDiv = document.createElement('div');
        categoriaDiv.className = 'categoria-item';
        
        const nameSpan = document.createElement('span');
        nameSpan.className = 'categoria-name';
        nameSpan.textContent = categoria.nombre;
        
        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'categoria-actions';
        
        const editBtn = document.createElement('button');
        editBtn.className = 'action-btn btn-edit';
        editBtn.innerHTML = '✏️ Editar';
        editBtn.addEventListener('click', () => this.editCategoria(categoria.id, categoria.nombre));
        
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'action-btn btn-delete';
        deleteBtn.innerHTML = '🗑️ Eliminar';
        deleteBtn.addEventListener('click', () => this.deleteCategoria(categoria.id, categoria.nombre));
        
        actionsDiv.appendChild(editBtn);
        actionsDiv.appendChild(deleteBtn);
        categoriaDiv.appendChild(nameSpan);
        categoriaDiv.appendChild(actionsDiv);
        list.appendChild(categoriaDiv);
        
        // Cargar subcategorías si la API existe
        if (window.api.listarSubcategorias) {
          try {
            const subs = await window.api.listarSubcategorias(categoria.id);
            subs.forEach(sub => {
              const subDiv = document.createElement('div');
              subDiv.className = 'subcategoria-item';
              
              const subNameSpan = document.createElement('span');
              subNameSpan.className = 'subcategoria-name';
              subNameSpan.textContent = `↳ ${sub.nombre}`;
              
              const subActionsDiv = document.createElement('div');
              subActionsDiv.className = 'categoria-actions';
              
              const subEditBtn = document.createElement('button');
              subEditBtn.className = 'action-btn btn-edit';
              subEditBtn.innerHTML = '✏️ Editar';
              subEditBtn.addEventListener('click', () => this.editSubcategoria(sub.id, sub.nombre));
              
              const subDeleteBtn = document.createElement('button');
              subDeleteBtn.className = 'action-btn btn-delete';
              subDeleteBtn.innerHTML = '🗑️ Eliminar';
              subDeleteBtn.addEventListener('click', () => this.deleteSubcategoria(sub.id, sub.nombre));
              
              subActionsDiv.appendChild(subEditBtn);
              subActionsDiv.appendChild(subDeleteBtn);
              subDiv.appendChild(subNameSpan);
              subDiv.appendChild(subActionsDiv);
              list.appendChild(subDiv);
            });
          } catch (error) {
            console.error('Error cargando subcategorías:', error);
          }
        }
      }
    } catch (error) {
      console.error('Error cargando categorías:', error);
      const errorDiv = document.createElement('div');
      errorDiv.style.cssText = 'padding: 20px; text-align: center; color: #e53e3e;';
      errorDiv.textContent = 'Error cargando categorías';
      list.innerHTML = '';
      list.appendChild(errorDiv);
    }
  }

  async addCategoria() {
    const input = document.getElementById('newCategoriaName');
    const name = input.value.trim();
    
    if (!name) {
      this.showToast('Ingrese un nombre para la categoría', 'error');
      input.focus();
      return;
    }

    try {
      if (window.api.agregarCategoria) {
        const result = await window.api.agregarCategoria(name);
        if (result.success) {
          this.showToast('Categoría agregada correctamente', 'success');
          input.value = '';
          await this.loadCategoriasList();
          this.populateCategoriaSelects();
        } else {
          this.showToast(result?.error || 'Error agregando categoría', 'error');
        }
      } else {
        this.showToast('Funcionalidad de categorías en desarrollo', 'info');
      }
    } catch (error) {
      console.error('Error agregando categoría:', error);
      this.showToast('Error agregando categoría: ' + error.message, 'error');
    }
  }

  editCategoria(id, currentName) {
    this.cancelEditing();
    
    document.getElementById('editCategoriaId').value = id;
    document.getElementById('editCategoriaName').value = currentName;
    document.getElementById('editCategoriaModal').classList.add('show');
    
    setTimeout(() => {
      const input = document.getElementById('editCategoriaName');
      input.focus();
      input.select();
    }, 300);
  }

  closeEditCategoriaModal() {
    document.getElementById('editCategoriaModal').classList.remove('show');
    this.cancelEditing();
  }

  async saveEditCategoria() {
    const id = document.getElementById('editCategoriaId').value;
    const newName = document.getElementById('editCategoriaName').value.trim();
    
    if (!newName) {
      this.showToast('El nombre de la categoría es requerido', 'error');
      return;
    }

    try {
      if (window.api.actualizarCategoria) {
        const result = await window.api.actualizarCategoria({ id: parseInt(id), nombre: newName });
        
        if (result && result.success) {
          this.showToast('Categoría actualizada correctamente', 'success');
          this.closeEditCategoriaModal();
          await this.loadCategoriasList();
          this.populateCategoriaSelects();
        } else {
          this.showToast(result?.error || 'Error actualizando categoría', 'error');
        }
      } else {
        this.showToast('Funcionalidad de edición en desarrollo', 'info');
        this.closeEditCategoriaModal();
      }
    } catch (error) {
      console.error('Error actualizando categoría:', error);
      this.showToast('Error actualizando categoría: ' + error.message, 'error');
    }
  }

  async deleteCategoria(id, name) {
    this.cancelEditing();

    if (!confirm(`¿Eliminar la categoría "${name}"?\n\nEsto también eliminará todas sus subcategorías.`)) {
      return;
    }

    try {
      if (window.api.eliminarCategoria) {
        const result = await window.api.eliminarCategoria(id);
        
        if (result && result.success) {
          this.showToast('Categoría eliminada correctamente', 'success');
          await this.loadCategoriasList();
          this.populateCategoriaSelects();
        } else {
          this.showToast(result?.error || 'Error eliminando categoría', 'error');
        }
      } else {
        this.showToast('Funcionalidad de eliminación en desarrollo', 'info');
      }
    } catch (error) {
      console.error('Error eliminando categoría:', error);
      this.showToast('Error eliminando categoría: ' + error.message, 'error');
    }
  }

  // Funciones de subcategorías similares
  async addSubcategoria() {
    const parentSelect = document.getElementById('subcategoriaParent');
    const nameInput = document.getElementById('newSubcategoriaName');
    
    const categoriaId = parentSelect.value;
    const name = nameInput.value.trim();
    
    if (!categoriaId) {
      this.showToast('Seleccione una categoría padre', 'error');
      parentSelect.focus();
      return;
    }
    
    if (!name) {
      this.showToast('Ingrese un nombre para la subcategoría', 'error');
      nameInput.focus();
      return;
    }

    try {
      if (window.api.agregarSubcategoria) {
        const result = await window.api.agregarSubcategoria({ 
          nombre: name, 
          categoriaId: parseInt(categoriaId) 
        });
        
        if (result && result.success) {
          this.showToast('Subcategoría agregada correctamente', 'success');
          nameInput.value = '';
          await this.loadCategoriasList();
          this.populateCategoriaSelects();
        } else {
          this.showToast(result?.error || 'Error agregando subcategoría', 'error');
        }
      } else {
        this.showToast('Funcionalidad de subcategorías en desarrollo', 'info');
      }
    } catch (error) {
      console.error('Error agregando subcategoría:', error);
      this.showToast('Error agregando subcategoría: ' + error.message, 'error');
    }
  }

  editSubcategoria(id, currentName) {
    this.cancelEditing();

    document.getElementById('editSubcategoriaId').value = id;
    document.getElementById('editSubcategoriaName').value = currentName;
    document.getElementById('editSubcategoriaModal').classList.add('show');
    
    setTimeout(() => {
      const input = document.getElementById('editSubcategoriaName');
      input.focus();
      input.select();
    }, 300);
  }

  closeEditSubcategoriaModal() {
    document.getElementById('editSubcategoriaModal').classList.remove('show');
    this.cancelEditing();
  }

  async saveEditSubcategoria() {
    const id = document.getElementById('editSubcategoriaId').value;
    const newName = document.getElementById('editSubcategoriaName').value.trim();
    
    if (!newName) {
      this.showToast('El nombre de la subcategoría es requerido', 'error');
      return;
    }

    try {
      if (window.api.actualizarSubcategoria) {
        const result = await window.api.actualizarSubcategoria({ id: parseInt(id), nombre: newName });
        
        if (result && result.success) {
          this.showToast('Subcategoría actualizada correctamente', 'success');
          this.closeEditSubcategoriaModal();
          await this.loadCategoriasList();
          this.populateCategoriaSelects();
        } else {
          this.showToast(result?.error || 'Error actualizando subcategoría', 'error');
        }
      } else {
        this.showToast('Funcionalidad de edición en desarrollo', 'info');
        this.closeEditSubcategoriaModal();
      }
    } catch (error) {
      console.error('Error actualizando subcategoría:', error);
      this.showToast('Error actualizando subcategoría: ' + error.message, 'error');
    }
  }

  async deleteSubcategoria(id, name) {
    this.cancelEditing();

    if (!confirm(`¿Eliminar la subcategoría "${name}"?`)) {
      return;
    }

    try {
      if (window.api.eliminarSubcategoria) {
        const result = await window.api.eliminarSubcategoria(id);
        
        if (result && result.success) {
          this.showToast('Subcategoría eliminada correctamente', 'success');
          await this.loadCategoriasList();
          this.populateCategoriaSelects();
        } else {
          this.showToast(result?.error || 'Error eliminando subcategoría', 'error');
        }
      } else {
        this.showToast('Funcionalidad de eliminación en desarrollo', 'info');
      }
    } catch (error) {
      console.error('Error eliminando subcategoría:', error);
      this.showToast('Error eliminando subcategoría: ' + error.message, 'error');
    }
  }

  // Gestión de stock - Extracciones
  openExtraccionModal() {
    this.cancelEditing();
    this.populateProductSelect('extraccion');
    document.getElementById('extraccionModal').classList.add('show');
    
    // Limpiar formulario
    document.getElementById('extraccionProducto').value = '';
    document.getElementById('extraccionStockActual').value = '';
    document.getElementById('extraccionCantidad').value = '1';
    document.getElementById('extraccionMotivo').value = '';
  }

  closeExtraccionModal() {
    document.getElementById('extraccionModal').classList.remove('show');
    this.cancelEditing();
  }

  populateProductSelect(modalType) {
    const selectId = modalType === 'extraccion' ? 'extraccionProducto' : 'defectuososProducto';
    const select = document.getElementById(selectId);
    
    this.clearSelectOptions(select, 'Seleccione un producto');
    
    this.productos.forEach(producto => {
      if (producto.stock > 0) {
        this.addSelectOption(select, `${producto.nombre} (Stock: ${producto.stock})`, producto.id);
      }
    });
  }

  updateStockDisplay(modalType) {
    const productSelect = document.getElementById(modalType + 'Producto');
    const stockInput = document.getElementById(modalType + 'StockActual');
    const productoId = parseInt(productSelect.value);
    
    if (productoId) {
      const producto = this.productos.find(p => p.id === productoId);
      if (producto) {
        stockInput.value = `${producto.stock} unidades`;
        
        if (modalType === 'defectuosos') {
          const defectuososActuales = document.getElementById('defectuososActuales');
          if (defectuososActuales) {
            defectuososActuales.value = `${producto.defectuosos || 0} unidades`;
          }
        }
      }
    } else {
      stockInput.value = '';
      if (modalType === 'defectuosos') {
        const defectuososActuales = document.getElementById('defectuososActuales');
        if (defectuososActuales) {
          defectuososActuales.value = '';
        }
      }
    }
  }

  async procesarExtraccion() {
    const productoId = parseInt(document.getElementById('extraccionProducto').value);
    const cantidad = parseInt(document.getElementById('extraccionCantidad').value) || 1;
    const motivo = document.getElementById('extraccionMotivo').value.trim();
    
    if (!productoId) {
      this.showToast('Seleccione un producto', 'error');
      return;
    }

    const producto = this.productos.find(p => p.id === productoId);
    if (!producto) {
      this.showToast('Producto no encontrado', 'error');
      return;
    }

    if (cantidad > producto.stock) {
      this.showToast(`No hay suficiente stock. Stock actual: ${producto.stock}`, 'error');
      return;
    }

    if (!confirm(`¿Extraer ${cantidad} unidad(es) de "${producto.nombre}"?${motivo ? `\nMotivo: ${motivo}` : ''}`)) {
      return;
    }

    try {
      if (window.api.actualizarProducto) {
        const nuevoStock = producto.stock - cantidad;
        const nuevasExtracciones = (producto.extracciones || 0) + cantidad;
        
        const result = await window.api.actualizarProducto({
          id: productoId,
          stock: nuevoStock,
          extracciones: nuevasExtracciones
        });

        if (result && result.success) {
          const index = this.productos.findIndex(p => p.id === productoId);
          if (index !== -1) {
            this.productos[index].stock = nuevoStock;
            this.productos[index].extracciones = nuevasExtracciones;
          }
          
          this.showToast(`Extracción procesada: ${cantidad} unidad(es) de "${producto.nombre}"`, 'success');
          this.closeExtraccionModal();
          this.displayProducts();
        } else {
          this.showToast(result?.error || 'Error procesando extracción', 'error');
        }
      } else {
        this.showToast('Funcionalidad de extracción en desarrollo', 'info');
        this.closeExtraccionModal();
      }
    } catch (error) {
      console.error('Error procesando extracción:', error);
      this.showToast('Error procesando extracción: ' + error.message, 'error');
    }
  }

  // Gestión de defectuosos
  openDefectuososModal() {
    this.cancelEditing();
    this.populateProductSelect('defectuosos');
    document.getElementById('defectuososModal').classList.add('show');
    
    // Limpiar formulario
    document.getElementById('defectuososProducto').value = '';
    document.getElementById('defectuososStockActual').value = '';
    document.getElementById('defectuososActuales').value = '';
    document.getElementById('defectuososCantidad').value = '1';
    document.getElementById('defectuososDescripcion').value = '';
  }

  closeDefectuososModal() {
    document.getElementById('defectuososModal').classList.remove('show');
    this.cancelEditing();
  }

  async procesarDefectuosos() {
    const productoId = parseInt(document.getElementById('defectuososProducto').value);
    const cantidad = parseInt(document.getElementById('defectuososCantidad').value) || 1;
    const descripcion = document.getElementById('defectuososDescripcion').value.trim();
    
    if (!productoId) {
      this.showToast('Seleccione un producto', 'error');
      return;
    }

    const producto = this.productos.find(p => p.id === productoId);
    if (!producto) {
      this.showToast('Producto no encontrado', 'error');
      return;
    }

    if (cantidad > producto.stock) {
      this.showToast(`No hay suficiente stock. Stock actual: ${producto.stock}`, 'error');
      return;
    }

    if (!confirm(`¿Marcar ${cantidad} unidad(es) de "${producto.nombre}" como defectuosas?${descripcion ? `\nMotivo: ${descripcion}` : ''}`)) {
      return;
    }

    try {
      if (window.api.actualizarProducto) {
        const nuevoStock = producto.stock - cantidad;
        const nuevosDefectuosos = (producto.defectuosos || 0) + cantidad;
        
        const result = await window.api.actualizarProducto({
          id: productoId,
          stock: nuevoStock,
          defectuosos: nuevosDefectuosos
        });

        if (result && result.success) {
          const index = this.productos.findIndex(p => p.id === productoId);
          if (index !== -1) {
            this.productos[index].stock = nuevoStock;
            this.productos[index].defectuosos = nuevosDefectuosos;
          }
          
          this.showToast(`Marcados como defectuosos: ${cantidad} unidad(es) de "${producto.nombre}"`, 'success');
          this.closeDefectuososModal();
          this.displayProducts();
        } else {
          this.showToast(result?.error || 'Error marcando defectuosos', 'error');
        }
      } else {
        this.showToast('Funcionalidad de defectuosos en desarrollo', 'info');
        this.closeDefectuososModal();
      }
    } catch (error) {
      console.error('Error marcando defectuosos:', error);
      this.showToast('Error marcando defectuosos: ' + error.message, 'error');
    }
  }

  // Exportar a Excel
  exportToExcel() {
    try {
      const csvContent = this.generateCSV();
      this.downloadCSV(csvContent, 'inventario.csv');
      this.showToast('Inventario exportado correctamente', 'success');
    } catch (error) {
      console.error('Error exportando:', error);
      this.showToast('Error al exportar inventario', 'error');
    }
  }

  generateCSV() {
    const headers = ['Stock', 'Producto', 'Cantidad', 'Precio USD', 'Precio CUP', 'oPrecio CUP', 'PxG CUP', 'Extracciones', 'Defectuosos', 'Categoría'];
    const rows = this.filteredProducts.map(p => [
      p.stock,
      `"${p.nombre}"`,
      p.cantidad || 1,
      p.precio_usd || 0,
      p.precio_cup || 0,
      p.oprecio_cup || 0,
      p.pxg_cup || 0,
      p.extracciones || 0,
      p.defectuosos || 0,
      `"${this.getCategoriaName(p.categoria_id)}"`
    ]);
    
    return [headers, ...rows].map(row => row.join(',')).join('\n');
  }

  downloadCSV(content, filename) {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // Cancelar edición
  cancelEditing() {
    this.isEditing = false;
    this.editingCell = null;
  }

  // Funciones de navegación
  goBack() {
    window.location.href = '../index.html';
  }

  clearSearch() {
    const searchInput = document.getElementById('searchInput');
    const clearBtn = document.getElementById('clearSearch');
    if (searchInput && clearBtn) {
      searchInput.value = '';
      clearBtn.style.display = 'none';
      this.filterProducts();
    }
  }
}

// Crear instancia global
const inventoryManager = new InventoryManager();

// Funciones globales para compatibilidad
function goBack() {
  inventoryManager.goBack();
}

function clearSearch() {
  inventoryManager.clearSearch();
}

function openProductModal() {
  inventoryManager.openProductModal();
}

function closeProductModal() {
  inventoryManager.closeProductModal();
}

function openViewModal() {
  inventoryManager.openViewModal();
}

function closeViewModal() {
  inventoryManager.closeViewModal();
}

function resetColumns() {
  inventoryManager.resetColumns();
}

function applyColumnConfig() {
  inventoryManager.applyColumnConfig();
}

function openCategoriaModal() {
  inventoryManager.openCategoriaModal();
}

function closeCategoriaModal() {
  inventoryManager.closeCategoriaModal();
}

function addCategoria() {
  inventoryManager.addCategoria();
}

function addSubcategoria() {
  inventoryManager.addSubcategoria();
}

function closeEditCategoriaModal() {
  inventoryManager.closeEditCategoriaModal();
}

function saveEditCategoria() {
  inventoryManager.saveEditCategoria();
}

function closeEditSubcategoriaModal() {
  inventoryManager.closeEditSubcategoriaModal();
}

function saveEditSubcategoria() {
  inventoryManager.saveEditSubcategoria();
}

function exportToExcel() {
  inventoryManager.exportToExcel();
}

function openExtraccionModal() {
  inventoryManager.openExtraccionModal();
}

function closeExtraccionModal() {
  inventoryManager.closeExtraccionModal();
}

function procesarExtraccion() {
  inventoryManager.procesarExtraccion();
}

function updateStockDisplay(modalType) {
  inventoryManager.updateStockDisplay(modalType);
}

function openDefectuososModal() {
  inventoryManager.openDefectuososModal();
}

function closeDefectuososModal() {
  inventoryManager.closeDefectuososModal();
}

function procesarDefectuosos() {
  inventoryManager.procesarDefectuosos();
}

// Inicializar cuando se carga el DOM
document.addEventListener('DOMContentLoaded', () => {
  inventoryManager.init();
});