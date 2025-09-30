// public/js/session-manager.js

(function() {
  'use strict';

  window.sessionManager = {
    currentUser: null,
    currentToken: null,

    // Inicializar sesion despues del login
    async initSession(loginResult) {
      if (loginResult.success) {
        this.currentUser = loginResult.user;
        this.currentToken = loginResult.token;
        
        // Guardar en memoria y como respaldo
        if (window.api && window.api.setSesionData) {
          window.api.setSesionData('currentUser', this.currentUser);
          window.api.setSesionData('sessionToken', this.currentToken);
        }
        
        this.logActivity('SESSION_INIT', { username: this.currentUser.username });
        return true;
      }
      return false;
    },

    // Obtener usuario actual
    getCurrentUser() {
      if (this.currentUser) {
        return this.currentUser;
      }
      
      // Intentar obtener de almacenamiento
      if (window.api && window.api.getSesionData) {
        this.currentUser = window.api.getSesionData('currentUser');
        return this.currentUser;
      }
      
      return null;
    },

    // Obtener token de sesion
    getSessionToken() {
      if (this.currentToken) {
        return this.currentToken;
      }
      
      if (window.api && window.api.getSesionData) {
        this.currentToken = window.api.getSesionData('sessionToken');
        return this.currentToken;
      }
      
      return null;
    },

    // Verificar si el token ha expirado (CORREGIDO)
    isTokenExpired() {
      const token = this.getSessionToken();
      if (!token) return true;

      try {
        // Verificar formato JWT
        const parts = token.split('.');
        if (parts.length !== 3) {
          console.warn('Token con formato inválido');
          return true;
        }
        
        // Decode JWT token payload
        const payload = JSON.parse(atob(parts[1]));
        
        // Verificar si tiene campo de expiración
        if (!payload.exp) {
          console.warn('Token sin campo de expiración, asumiendo válido');
          return false;
        }
        
        const currentTime = Date.now() / 1000;
        return payload.exp < currentTime;
      } catch (error) {
        console.warn('Error verificando token:', error.message);
        // En caso de error, asumir que el token es inválido
        return true;
      }
    },

    // Verificar si el usuario es administrador
    isAdmin() {
      const user = this.getCurrentUser();
      return user && user.rol === 'admin';
    },

    // Verificar autenticacion (solo verificar, no redirigir automaticamente)
    isAuthenticated() {
      const user = this.getCurrentUser();
      const token = this.getSessionToken();
      return !!(user && token && !this.isTokenExpired());
    },

    // Requerir autenticacion (usar solo cuando sea necesario)
    requireAuth() {
      if (!this.isAuthenticated()) {
        // Solo redirigir si no estamos ya en login
        const currentPage = window.location.pathname.split('/').pop() || 'index.html';
        if (currentPage !== 'login.html') {
          this.logActivity('AUTH_REQUIRED_REDIRECT', { currentPage });
          window.location.href = 'login.html';
        }
        return false;
      }
      
      return true;
    },

    // Requerir permisos de administrador
    requireAdmin() {
      if (!this.requireAuth()) return false;
      
      if (!this.isAdmin()) {
        this.showAlert('Acceso denegado: Se requieren permisos de administrador');
        window.location.href = 'index.html';
        return false;
      }
      
      return true;
    },

    // Mostrar alerta de manera consistente
    showAlert(message, type = 'warning') {
      if (window.showToast) {
        window.showToast(message, type);
      } else {
        alert(message);
      }
    },

    // Limpiar sesion
    clearSession() {
      this.logActivity('SESSION_CLEAR', { username: this.currentUser?.username });
      
      this.currentUser = null;
      this.currentToken = null;
      
      if (window.api && window.api.clearSesionData) {
        window.api.clearSesionData();
      }
    },

    // Logout completo
    async logout() {
      try {
        // Llamar API de logout si esta disponible
        if (window.api && window.api.logout && this.currentToken) {
          await window.api.logout(this.currentToken);
        }
      } catch (error) {
        console.warn('Error en logout:', error);
      } finally {
        // Siempre limpiar sesion local
        this.clearSession();
      }
      
      return { success: true };
    },

    // Validar sesion con el servidor (solo cuando sea necesario)
    async validateSession() {
      const token = this.getSessionToken();
      if (!token || !window.api) return false;

      // Verificar expiracion local primero
      if (this.isTokenExpired()) {
        this.clearSession();
        return false;
      }

      try {
        const result = await window.api.validarSesion(token);
        if (result.success) {
          this.currentUser = result.user;
          if (window.api.setSesionData) {
            window.api.setSesionData('currentUser', result.user);
          }
          return true;
        } else {
          this.clearSession();
          return false;
        }
      } catch (error) {
        console.error('Error validando sesion:', error);
        // En caso de error de red, mantener sesion local solo si no ha expirado
        return this.isAuthenticated();
      }
    },

    // Nuevo metodo para compatibilidad con la arquitectura refactorizada
    async validateSessionWithRetry(maxRetries = 2) {
      for (let i = 0; i < maxRetries; i++) {
        try {
          const result = await this.validateSession();
          return result;
        } catch (error) {
          console.warn(`Intento ${i + 1} de validacion fallo:`, error);
          if (i === maxRetries - 1) throw error;
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    },

    // Metodo para logging de actividad (compatible con nuevo sistema)
    logActivity(action, details = {}) {
      const logData = {
        action,
        timestamp: new Date().toISOString(),
        user: this.currentUser?.username || 'anonymous',
        ...details
      };

      if (window.api && window.api.logInfo) {
        window.api.logInfo(`Session activity: ${action}`, logData);
      } else {
        console.log(`[Session] ${action}:`, logData);
      }
    }
  };

})();