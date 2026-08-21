window.ATM_CONFIG = {
  apiBaseUrl: (function () {
    var esLocal = ['localhost', '127.0.0.1'].indexOf(window.location.hostname) !== -1;
    return esLocal ? 'http://localhost:3000' : 'https://banco-atm-api.onrender.com';
  })(),
  segundosInactividad: 120,
  montosRapidosRetiro: [200, 500, 1000, 2000, 3000, 5000],
  montosRapidosDeposito: [500, 1000, 2000, 5000],
  nombreBanco: 'Banco ATM',
  identificadorCajero: 'ATM-001',
};