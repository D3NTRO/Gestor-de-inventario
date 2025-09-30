console.log('Testing basic Electron import...');
try {
  const electron = require('electron');
  console.log('Electron object:', Object.keys(electron));
  console.log('App available:', typeof electron.app);
  
  const { app } = electron;
  console.log('App extracted:', typeof app);
  
  if (app && app.whenReady) {
    console.log('SUCCESS: Electron app is working');
    app.quit();
  } else {
    console.log('FAILED: app.whenReady not available');
  }
} catch (error) {
  console.error('ERROR importing Electron:', error.message);
}