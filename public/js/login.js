// public/js/login.js - Lógica del sistema de login

class LoginManager {
  constructor() {
    this.setupMockApi();
  }

  // Generar un token JWT mock válido
  generateMockToken(userId, username, rol) {
    const header = {
      alg: "HS256",
      typ: "JWT"
    };
    
    const payload = {
      userId: userId,
      username: username,
      rol: rol,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 horas
    };
    
    // Codificar en base64 (simulación de JWT)
    const encodedHeader = btoa(JSON.stringify(header));
    const encodedPayload = btoa(JSON.stringify(payload));
    const signature = btoa(`mock-signature-${userId}-${Date.now()}`);
    
    return `${encodedHeader}.${encodedPayload}.${signature}`;
  }

  // Configurar API simulada si no existe
  setupMockApi() {
    if (typeof window.api === 'undefined') {
      const self = this; // Guardar referencia a this
      
      window.api = {
        async login({ username, password }) {
          // Simular delay de red realista
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          // En desarrollo, permitir usuarios específicos
          if (username === 'admin' && password === '1234') {
            return {
              success: true,
              user: { id: 1, username: 'admin', rol: 'admin' },
              token: self.generateMockToken(1, 'admin', 'admin')
            };
          }

          if (username === 'usuario' && password === '1234') {
            return {
              success: true,
              user: { id: 2, username: 'usuario', rol: 'usuario' },
              token: self.generateMockToken(2, 'usuario', 'usuario')
            };
          }
          
          return { success: false, error: 'Credenciales incorrectas' };
        }
      };
    }
  }

  // Crear partículas animadas
  createParticles() {
    const particles = document.querySelector('.particles');
    if (!particles) return;
    
    for (let i = 0; i < 15; i++) {
      const particle = document.createElement('div');
      particle.className = 'particle';
      particle.style.left = Math.random() * 100 + '%';
      particle.style.top = Math.random() * 100 + '%';
      particle.style.width = Math.random() * 8 + 4 + 'px';
      particle.style.height = particle.style.width;
      particle.style.animationDuration = Math.random() * 3 + 3 + 's';
      particle.style.animationDelay = Math.random() * 2 + 's';
      particles.appendChild(particle);
    }
  }

  // Configurar event listeners
  setupEventListeners() {
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
      loginForm.addEventListener('submit', (e) => this.handleLogin(e));
    }

    // Limpiar mensaje al escribir
    const inputs = document.querySelectorAll('input');
    inputs.forEach(input => {
      input.addEventListener('input', () => {
        const messageEl = document.getElementById('message');
        if (messageEl) {
          messageEl.classList.remove('show');
        }
      });
    });
  }

  // Manejar login
  async handleLogin(e) {
    e.preventDefault();
    
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;

    if (!username || !password) {
      this.showMessage('Por favor, completa todos los campos', 'error');
      return;
    }

    this.setLoading(true);

    try {
      const result = await window.api.login({ username, password });

      if (result.success) {
        console.log('Login exitoso:', result);
        
        // Inicializar session manager
        if (window.sessionManager && window.sessionManager.initSession) {
          const sessionResult = await window.sessionManager.initSession(result);
          console.log('Sesión inicializada:', sessionResult);
        }
        
        this.showMessage('¡Acceso exitoso!', 'success');
        
        // Redirigir a index.html después del login exitoso
        setTimeout(() => {
          console.log('Redirigiendo a index.html...');
          window.location.href = 'index.html';
        }, 1000);
      } else {
        this.showMessage(result.error || 'Credenciales incorrectas', 'error');
      }
    } catch (error) {
      console.error('Error en login:', error);
      this.showMessage('Error de conexión', 'error');
    } finally {
      this.setLoading(false);
    }
  }

  // Mostrar mensajes
  showMessage(text, type) {
    const messageEl = document.getElementById('message');
    if (!messageEl) return;
    
    messageEl.textContent = text;
    messageEl.className = `toast ${type} show`;
    
    setTimeout(() => {
      messageEl.classList.remove('show');
    }, 4000);
  }

  // Controlar estado de carga
  setLoading(loading) {
    const button = document.getElementById('loginButton');
    const buttonText = document.getElementById('buttonText');
    const buttonLoading = document.getElementById('buttonLoading');
    
    if (!button || !buttonText || !buttonLoading) return;
    
    if (loading) {
      button.disabled = true;
      buttonText.style.visibility = 'hidden';
      buttonLoading.style.display = 'block';
    } else {
      button.disabled = false;
      buttonText.style.visibility = 'visible';
      buttonLoading.style.display = 'none';
    }
  }

  // Verificar si ya hay sesión activa
  checkExistingSession() {
    try {
      if (window.sessionManager && window.sessionManager.isAuthenticated && window.sessionManager.isAuthenticated()) {
        console.log('Usuario ya autenticado, redirigiendo...');
        window.location.href = 'index.html';
      }
    } catch (error) {
      console.log('Error verificando sesión existente:', error);
    }
  }

  // Inicializar
  init() {
    this.checkExistingSession();
    this.createParticles();
    this.setupEventListeners();
    
    // Focus en el primer campo
    setTimeout(() => {
      const usernameField = document.getElementById('username');
      if (usernameField) {
        usernameField.focus();
      }
    }, 500);

    console.log('Sistema de login inicializado');
  }
}

// Crear instancia global
const loginManager = new LoginManager();

// Inicializar cuando se carga el DOM
document.addEventListener('DOMContentLoaded', () => {
  loginManager.init();
});

// Atajos de teclado
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const usernameField = document.getElementById('username');
    const passwordField = document.getElementById('password');
    if (usernameField && passwordField) {
      usernameField.value = '';
      passwordField.value = '';
      usernameField.focus();
    }
  }
});