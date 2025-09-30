class DashboardManager {
  constructor() {
    this.currentUser = null;
    this.isEditing = false;
    this.isEditingCurrency = false;
    
    // Datos mock para demostración
    this.currencies = [
      { code: 'USD', name: 'Dólar Estadounidense', rate: 1.00, isBase: true },
      { code: 'CUP', name: 'Peso Cubano', rate: 120.00, isBase: false },
      { code: 'EUR', name: 'Euro', rate: 0.85, isBase: false }
    ];
    
    this.setupMockApi();
  }

  // Configurar API simulada si no existe
  setupMockApi() {
    if (typeof window.api === 'undefined') {
      window.api = {
        users: [
          { id: 1, username: 'admin', password: 'admin123', rol: 'admin' },
          { id: 2, username: 'usuario', password: 'usuario123', rol: 'usuario' },
          { id: 3, username: 'vendedor', password: 'vendedor123', rol: 'usuario' }
        ],
        
        inventoryData: {
          total_productos: 156,
          productos_sin_stock: 23,
          productos_stock_bajo: 12
        },

        async listarUsuarios() {
          return new Promise((resolve) => {
            setTimeout(() => {
              resolve({
                success: true,
                usuarios: this.users.map(u => ({ id: u.id, username: u.username, rol: u.rol }))
              });
            }, 300);
          });
        },

        async agregarUsuario({ username, password, rol }) {
          return new Promise((resolve) => {
            setTimeout(() => {
              if (this.users.find(u => u.username === username)) {
                resolve({ success: false, error: 'El usuario ya existe' });
              } else {
                const newId = Math.max(...this.users.map(u => u.id)) + 1;
                this.users.push({ id: newId, username, password, rol });
                resolve({ success: true });
              }
            }, 300);
          });
        },

        async editarUsuario({ id, username, password, rol }) {
          return new Promise((resolve) => {
            setTimeout(() => {
              const userIndex = this.users.findIndex(u => u.id === parseInt(id));
              if (userIndex !== -1) {
                this.users[userIndex] = { id: parseInt(id), username, password, rol };
                resolve({ success: true });
              } else {
                resolve({ success: false, error: 'Usuario no encontrado' });
              }
            }, 300);
          });
        },

        async eliminarUsuario({ username }) {
          return new Promise((resolve) => {
            setTimeout(() => {
              const userIndex = this.users.findIndex(u => u.username === username);
              if (userIndex !== -1) {
                this.users.splice(userIndex, 1);
                resolve({ success: true });
              } else {
                resolve({ success: false, error: 'Usuario no encontrado' });
              }
            }, 300);
          });
        },

        async reporteInventario() {
          return new Promise((resolve) => {
            setTimeout(() => {
              resolve(this.inventoryData);
            }, 500);
          });
        }
      };
    }
  }

  // Inicialización
  async init() {
    try {
      // Verificar autenticación
      if (window.sessionManager && !window.sessionManager.isAuthenticated()) {
        console.warn('Usuario no autenticado, redirigiendo...');
        window.location.href = 'login.html';
        return;
      }

      await this.setupUserInterface();
      this.setupEventListeners();
      await this.loadDashboardData();
      
      console.log('Dashboard cargado correctamente');
      
    } catch (error) {
      console.error('Error en inicialización:', error);
      this.showMessage('Error cargando el panel principal', 'error');
    }
  }

  // Configurar interfaz según usuario
  async setupUserInterface() {
    try {
      if (window.sessionManager && window.sessionManager.getCurrentUser) {
        this.currentUser = window.sessionManager.getCurrentUser();
      }

      const userInfoElement = document.getElementById('user-info');
      const usersTab = document.getElementById('usersTab');

      // Actualizar información del usuario en el header
      if (userInfoElement) {
        if (this.currentUser) {
          userInfoElement.innerHTML = `
            <span>👤 ${this.currentUser.username} (${this.currentUser.rol})</span>
            <button class="logout-btn" onclick="dashboardManager.logout()">Cerrar Sesión</button>
          `;
        } else {
          userInfoElement.innerHTML = `
            <span>👤 Usuario Demo</span>
            <button class="logout-btn" onclick="dashboardManager.logout()">Cerrar Sesión</button>
          `;
        }
      }

      // Mostrar tab de usuarios solo para admins
      if (this.currentUser && this.currentUser.rol === 'admin' && usersTab) {
        usersTab.style.display = 'block';
        this.loadUsers();
      }
    } catch (error) {
      console.error('Error configurando interfaz:', error);
    }
  }

  // Event listeners
  setupEventListeners() {
    try {
      // Tabs
      document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => this.switchTab(tab.dataset.tab));
      });

      // User management
      const addUserBtn = document.getElementById('addUserBtn');
      if (addUserBtn) {
        addUserBtn.addEventListener('click', () => this.handleAddUser());
      }
      
      // Currency management
      const addCurrencyBtn = document.getElementById('addCurrencyBtn');
      if (addCurrencyBtn) {
        addCurrencyBtn.addEventListener('click', () => this.handleAddCurrency());
      }

      console.log('Event listeners configurados');
      
    } catch (error) {
      console.error('Error configurando event listeners:', error);
    }
  }

  // Cargar datos del dashboard
  async loadDashboardData() {
    try {
      const reporteInventario = await window.api.reporteInventario();

      if (reporteInventario) {
        const totalProducts = document.getElementById('totalProducts');
        const totalCategories = document.getElementById('totalCategories');
        const lowStock = document.getElementById('lowStock');
        
        if (totalProducts) totalProducts.textContent = reporteInventario.total_productos || 0;
        if (totalCategories) totalCategories.textContent = reporteInventario.productos_sin_stock || 0;
        if (lowStock) lowStock.textContent = reporteInventario.productos_stock_bajo || 0;
      }
      
    } catch (error) {
      console.error('Error cargando datos:', error);
      const elements = ['totalProducts', 'totalCategories', 'lowStock'];
      elements.forEach(id => {
        const element = document.getElementById(id);
        if (element) element.textContent = '—';
      });
    }
  }

  // Gestión de tabs
  switchTab(tabName) {
    // Actualizar tabs
    document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

    // Mostrar contenido
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    document.getElementById(tabName).classList.add('active');

    // Cargar datos específicos
    if (tabName === 'users' && this.currentUser && this.currentUser.rol === 'admin') {
      this.loadUsers();
    } else if (tabName === 'currencies') {
      this.loadCurrencies();
    }
  }

  // Cargar usuarios
  async loadUsers() {
    try {
      const result = await window.api.listarUsuarios();
      if (result.success) {
        this.displayUsers(result.usuarios);
      }
    } catch (error) {
      console.error('Error cargando usuarios:', error);
    }
  }

  // Mostrar usuarios en tabla
  displayUsers(users) {
    const tbody = document.getElementById('usersTableBody');
    if (!tbody) return;
    
    tbody.innerHTML = '';

    users.forEach(user => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td><strong>${user.username}</strong></td>
        <td><span class="role-badge role-${user.rol}">${user.rol}</span></td>
        <td>
          <button class="action-btn btn-edit" onclick="dashboardManager.editUser(${user.id}, '${user.username}', '${user.rol}')">✏️ Editar</button>
          <button class="action-btn btn-delete" onclick="dashboardManager.deleteUser('${user.username}')">🗑️ Eliminar</button>
        </td>
      `;
      tbody.appendChild(row);
    });
  }

  // Agregar/editar usuario
  async handleAddUser() {
    const username = document.getElementById('newUsername').value.trim();
    const password = document.getElementById('newPassword').value;
    const rol = document.getElementById('newRole').value;
    const editId = document.getElementById('editUserId').value;

    if (!username) {
      this.showMessage('El nombre de usuario es requerido', 'error');
      return;
    }

    if (!password && !this.isEditing) {
      this.showMessage('La contraseña es requerida', 'error');
      return;
    }

    try {
      let result;
      if (this.isEditing && editId) {
        result = await window.api.editarUsuario({ 
          id: editId, 
          username, 
          password: password || undefined, 
          rol 
        });
      } else {
        result = await window.api.agregarUsuario({ username, password, rol });
      }

      if (result.success) {
        this.showMessage(
          this.isEditing ? 'Usuario editado exitosamente' : 'Usuario agregado exitosamente', 
          'success'
        );
        this.clearUserForm();
        this.loadUsers();
      } else {
        this.showMessage(result.error || 'Error al procesar usuario', 'error');
      }
    } catch (error) {
      this.showMessage('Error de conexión', 'error');
    }
  }

  // Editar usuario
  editUser(id, username, rol) {
    document.getElementById('newUsername').value = username;
    document.getElementById('newPassword').value = '';
    document.getElementById('newPassword').placeholder = 'Nueva contraseña (opcional)';
    document.getElementById('newRole').value = rol;
    document.getElementById('editUserId').value = id;
    document.getElementById('addUserBtn').textContent = 'Actualizar Usuario';
    this.isEditing = true;
  }

  // Eliminar usuario
  async deleteUser(username) {
    if (!confirm(`¿Estás seguro de eliminar al usuario "${username}"?`)) {
      return;
    }

    try {
      const result = await window.api.eliminarUsuario({ username });
      if (result.success) {
        this.showMessage('Usuario eliminado exitosamente', 'success');
        this.loadUsers();
      } else {
        this.showMessage(result.error || 'Error al eliminar usuario', 'error');
      }
    } catch (error) {
      this.showMessage('Error de conexión', 'error');
    }
  }

  // Limpiar formulario de usuario
  clearUserForm() {
    document.getElementById('newUsername').value = '';
    document.getElementById('newPassword').value = '';
    document.getElementById('newPassword').placeholder = 'Contraseña';
    document.getElementById('newRole').value = 'usuario';
    document.getElementById('editUserId').value = '';
    document.getElementById('addUserBtn').textContent = 'Agregar Usuario';
    this.isEditing = false;
  }

  // Gestión de monedas
  loadCurrencies() {
    const tbody = document.getElementById('currenciesTableBody');
    if (!tbody) return;
    
    tbody.innerHTML = '';

    this.currencies.forEach(currency => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td><strong>${currency.code}</strong></td>
        <td>${currency.name}</td>
        <td style="color: #38a169; font-weight: 600;">${currency.rate.toFixed(2)}</td>
        <td style="color: #718096; font-size: 12px;">${currency.isBase ? 'Base' : 'Hoy'}</td>
        <td>
          <button class="action-btn btn-edit" onclick="dashboardManager.editCurrency('${currency.code}', '${currency.name}', ${currency.rate})">✏️ Editar</button>
          ${!currency.isBase ? `<button class="action-btn btn-delete" onclick="dashboardManager.deleteCurrency('${currency.code}')">🗑️ Eliminar</button>` : ''}
        </td>
      `;
      tbody.appendChild(row);
    });
  }

  // Agregar/editar moneda
  async handleAddCurrency() {
    const code = document.getElementById('currencyCode').value.trim().toUpperCase();
    const name = document.getElementById('currencyName').value.trim();
    const rate = parseFloat(document.getElementById('exchangeRate').value);

    if (!code) {
      this.showMessage('El código de moneda es requerido', 'error');
      return;
    }

    if (!name) {
      this.showMessage('El nombre de la moneda es requerido', 'error');
      return;
    }

    if (!rate || rate <= 0) {
      this.showMessage('La tasa de cambio debe ser mayor a 0', 'error');
      return;
    }

    try {
      if (this.isEditingCurrency) {
        const index = this.currencies.findIndex(c => c.code === code);
        if (index !== -1) {
          this.currencies[index] = {
            ...this.currencies[index],
            name: name,
            rate: rate
          };
          this.showMessage('Moneda actualizada exitosamente', 'success');
        }
      } else {
        if (this.currencies.find(c => c.code === code)) {
          this.showMessage('Esta moneda ya existe', 'error');
          return;
        }

        this.currencies.push({
          code: code,
          name: name,
          rate: rate,
          isBase: false
        });
        this.showMessage('Moneda agregada exitosamente', 'success');
      }

      this.clearCurrencyForm();
      this.loadCurrencies();
    } catch (error) {
      this.showMessage('Error procesando moneda', 'error');
    }
  }

  // Editar moneda
  editCurrency(code, name, rate) {
    const currency = this.currencies.find(c => c.code === code);
    if (currency && currency.isBase) {
      this.showMessage('No se puede editar la moneda base USD', 'error');
      return;
    }

    document.getElementById('currencyCode').value = code;
    document.getElementById('currencyCode').disabled = true;
    document.getElementById('currencyName').value = name;
    document.getElementById('exchangeRate').value = rate;
    document.getElementById('addCurrencyBtn').textContent = 'Actualizar Moneda';
    this.isEditingCurrency = true;
  }

  // Eliminar moneda
  deleteCurrency(code) {
    const currency = this.currencies.find(c => c.code === code);
    if (currency && currency.isBase) {
      this.showMessage('No se puede eliminar la moneda base USD', 'error');
      return;
    }

    if (!confirm(`¿Eliminar la moneda ${code}?`)) {
      return;
    }

    this.currencies = this.currencies.filter(c => c.code !== code);
    this.loadCurrencies();
    this.showMessage('Moneda eliminada exitosamente', 'success');
  }

  // Limpiar formulario de moneda
  clearCurrencyForm() {
    document.getElementById('currencyCode').value = '';
    document.getElementById('currencyCode').disabled = false;
    document.getElementById('currencyName').value = '';
    document.getElementById('exchangeRate').value = '';
    document.getElementById('addCurrencyBtn').textContent = 'Agregar Moneda';
    this.isEditingCurrency = false;
  }

  // Navegación segura
  navegarA(pagina) {
    try {
      if (window.sessionManager && !window.sessionManager.isAuthenticated()) {
        this.showMessage('Debes iniciar sesión', 'error');
        window.location.href = 'login.html';
        return;
      }

      const rutasPermitidas = ['public/ventas.html', 'public/servicios.html', 'public/reportes.html', 'public/inventario.html'];
      
      if (!rutasPermitidas.includes(pagina)) {
        this.showMessage('Ruta no válida', 'error');
        return;
      }

      console.log(`Navegando a: ${pagina}`);
      this.showMessage(`Cargando ${pagina.replace('.html', '')}...`, 'success');
      
      setTimeout(() => {
        window.location.href = pagina;
      }, 500);
      
    } catch (error) {
      console.error('Error en navegación:', error);
      this.showMessage('Error al navegar', 'error');
    }
  }

  // Navegación directa al inventario
  navegarAInventario() {
    this.navegarA('public/inventario.html');
  }

  // Cerrar sesión
  async logout() {
    if (confirm('¿Estás seguro de cerrar sesión?')) {
      if (window.sessionManager) {
        await window.sessionManager.logout();
      }
      window.location.href = 'login.html';
    }
  }

  // Función para mostrar mensajes
  showMessage(text, type) {
    const messageEl = document.getElementById('message');
    if (!messageEl) return;
    
    messageEl.textContent = text;
    messageEl.className = `message ${type} show`;
    
    setTimeout(() => {
      messageEl.classList.remove('show');
    }, 4000);
  }

  // Convertir entre monedas
  convertCurrency(amount, fromCode, toCode) {
    const fromCurrency = this.currencies.find(c => c.code === fromCode);
    const toCurrency = this.currencies.find(c => c.code === toCode);
    
    if (!fromCurrency || !toCurrency) return 0;
    
    const usdAmount = amount / fromCurrency.rate;
    return usdAmount * toCurrency.rate;
  }
}

// Crear instancia global
const dashboardManager = new DashboardManager();

// Inicializar cuando se carga el DOM
document.addEventListener('DOMContentLoaded', () => {
  dashboardManager.init();
});

// Atajos de teclado
document.addEventListener('keydown', (e) => {
  if (e.altKey) {
    switch(e.key) {
      case '1':
        e.preventDefault();
        dashboardManager.navegarAInventario();
        break;
      case '2':
        e.preventDefault();
        dashboardManager.navegarA('public/ventas.html');
        break;
      case '3':
        e.preventDefault();
        dashboardManager.navegarA('public/servicios.html');
        break;
      case '4':
        e.preventDefault();
        dashboardManager.navegarA('public/reportes.html');
        break;
    }
  }
  
  if (e.key === 'F5') {
    e.preventDefault();
    location.reload();
  }
});