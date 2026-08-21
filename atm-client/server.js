const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const puerto = Number(process.env.ATM_PORT) || 5500;
const raiz = __dirname;

const tipos = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
};

const servidor = http.createServer((peticion, respuesta) => {
  const url = new URL(peticion.url, `http://${peticion.headers.host}`);
  let rutaRelativa = decodeURIComponent(url.pathname);

  if (rutaRelativa === '/' || rutaRelativa === '') {
    rutaRelativa = '/index.html';
  }

  const rutaAbsoluta = path.join(raiz, rutaRelativa);

  if (!rutaAbsoluta.startsWith(raiz)) {
    respuesta.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    respuesta.end('Acceso no permitido');
    return;
  }

  fs.readFile(rutaAbsoluta, (error, contenido) => {
    if (error) {
      respuesta.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      respuesta.end('Recurso no encontrado');
      return;
    }

    const extension = path.extname(rutaAbsoluta).toLowerCase();
    respuesta.writeHead(200, {
      'Content-Type': tipos[extension] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    respuesta.end(contenido);
  });
});

servidor.listen(puerto, () => {
  console.log(`Interfaz ATM disponible en http://localhost:${puerto}`);
});
