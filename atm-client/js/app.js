(function () {
  'use strict';

  var config = window.ATM_CONFIG || {};
  var api = window.AtmApi;

  var estado = {
    numeroTarjeta: '',
    pin: '',
    pantallaActual: 'inicio',
    temporizadorInactividad: null,
    segundosRestantes: 0,
    proveedores: [],
    limites: null,
  };

  function nodo(selector) {
    return document.querySelector(selector);
  }

  function nodos(selector) {
    return Array.prototype.slice.call(document.querySelectorAll(selector));
  }

  function formatearMoneda(valor) {
    var numero = Number(valor);
    if (isNaN(numero)) {
      return '—';
    }
    return numero.toLocaleString('es-MX', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: 2,
    });
  }

  function formatearFecha(valor) {
    if (!valor) {
      return '—';
    }
    var fecha = new Date(valor);
    if (isNaN(fecha.getTime())) {
      return String(valor);
    }
    return fecha.toLocaleString('es-MX');
  }

  function mostrarCarga(texto) {
    nodo('#textoCarga').textContent = texto || 'Procesando operación...';
    nodo('#capaCarga').hidden = false;
  }

  function ocultarCarga() {
    nodo('#capaCarga').hidden = true;
  }

  function irA(nombre) {
    nodos('.pantalla').forEach(function (seccion) {
      seccion.classList.toggle(
        'activa',
        seccion.getAttribute('data-pantalla') === nombre,
      );
    });
    estado.pantallaActual = nombre;
    if (api.haySesion()) {
      reiniciarInactividad();
    }
  }

  function mostrarMensaje(titulo, texto, etiquetaBoton, alContinuar) {
    nodo('#mensajeTitulo').textContent = titulo;
    nodo('#mensajeTexto').textContent = texto;
    var boton = nodo('#botonMensaje');
    boton.textContent = etiquetaBoton || 'Continuar';
    boton.onclick = function () {
      if (typeof alContinuar === 'function') {
        alContinuar();
      } else {
        irA('inicio');
      }
    };
    irA('mensaje');
  }

  function manejarError(error, alContinuar) {
    ocultarCarga();
    var mensaje = error && error.message ? error.message : 'Ocurrió un error inesperado.';

    if (error && error.codigo === 401 && api.haySesion()) {
      api.limpiarSesion();
      detenerInactividad();
      mostrarMensaje('Sesión finalizada', 'Su sesión expiró. Retire su tarjeta e inténtelo de nuevo.', 'Aceptar', function () {
        reiniciarFlujo();
      });
      return;
    }

    mostrarMensaje('No se pudo completar', mensaje, 'Aceptar', alContinuar || function () {
      irA(api.haySesion() ? 'menu' : 'inicio');
    });
  }

  function reiniciarFlujo() {
    estado.numeroTarjeta = '';
    estado.pin = '';
    pintarEntradaTarjeta();
    pintarEntradaPin();
    irA('inicio');
  }

  function detenerInactividad() {
    if (estado.temporizadorInactividad) {
      clearInterval(estado.temporizadorInactividad);
      estado.temporizadorInactividad = null;
    }
    nodo('#avisoInactividad').textContent = '';
  }

  function reiniciarInactividad() {
    estado.segundosRestantes = config.segundosInactividad || 120;
    if (estado.temporizadorInactividad) {
      return;
    }
    estado.temporizadorInactividad = setInterval(function () {
      estado.segundosRestantes -= 1;
      nodo('#avisoInactividad').textContent =
        'Sesión activa · cierre automático en ' + estado.segundosRestantes + ' s';
      if (estado.segundosRestantes <= 0) {
        detenerInactividad();
        api.logout().then(function () {
          mostrarMensaje(
            'Sesión cerrada',
            'Se cerró la sesión por inactividad. Retire su tarjeta.',
            'Aceptar',
            reiniciarFlujo,
          );
        });
      }
    }, 1000);
  }

  function pintarEntradaTarjeta() {
    var texto = estado.numeroTarjeta || '';
    var agrupado = texto.replace(/(.{4})/g, '$1 ').trim();
    nodo('#entradaTarjeta').textContent = agrupado || '----';
  }

  function pintarEntradaPin() {
    nodo('#entradaPin').textContent = new Array(estado.pin.length + 1).join('•');
  }

  function construirTeclado(contenedor, campo) {
    var teclas = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'Borrar', '0', 'Limpiar'];
    contenedor.innerHTML = '';
    teclas.forEach(function (tecla) {
      var boton = document.createElement('button');
      boton.type = 'button';
      boton.className = 'tecla' + (/^\d$/.test(tecla) ? '' : ' tecla--accion');
      boton.textContent = tecla;
      boton.addEventListener('click', function () {
        manejarTecla(campo, tecla);
      });
      contenedor.appendChild(boton);
    });
  }

  function manejarTecla(campo, tecla) {
    var limite = campo === 'tarjeta' ? 19 : 6;
    var actual = campo === 'tarjeta' ? estado.numeroTarjeta : estado.pin;

    if (tecla === 'Borrar') {
      actual = actual.slice(0, -1);
    } else if (tecla === 'Limpiar') {
      actual = '';
    } else if (actual.length < limite) {
      actual += tecla;
    }

    if (campo === 'tarjeta') {
      estado.numeroTarjeta = actual;
      pintarEntradaTarjeta();
    } else {
      estado.pin = actual;
      pintarEntradaPin();
    }

    if (api.haySesion()) {
      reiniciarInactividad();
    }
  }

  function confirmarTarjeta() {
    if (!/^\d{13,19}$/.test(estado.numeroTarjeta)) {
      mostrarMensaje(
        'Tarjeta no válida',
        'El número de tarjeta debe tener entre 13 y 19 dígitos.',
        'Reintentar',
        function () {
          irA('tarjeta');
        },
      );
      return;
    }
    nodo('#textoTarjetaEnmascarada').textContent =
      'Tarjeta ****' + estado.numeroTarjeta.slice(-4);
    estado.pin = '';
    pintarEntradaPin();
    irA('pin');
  }

  function confirmarPin() {
    if (!/^\d{4,6}$/.test(estado.pin)) {
      mostrarMensaje('PIN no válido', 'El PIN debe tener entre 4 y 6 dígitos.', 'Reintentar', function () {
        estado.pin = '';
        pintarEntradaPin();
        irA('pin');
      });
      return;
    }

    mostrarCarga('Validando su tarjeta...');

    api
      .login(estado.numeroTarjeta, estado.pin)
      .then(function (datos) {
        ocultarCarga();
        estado.pin = '';
        pintarEntradaPin();
        nodo('#textoBienvenida').textContent =
          'Sesión de ' + datos.usuario.nombreCompleto + ' · Cuenta ' + datos.cuenta.numeroCuenta;
        cargarLimites();
        reiniciarInactividad();
        irA('menu');
      })
      .catch(function (error) {
        ocultarCarga();
        estado.pin = '';
        pintarEntradaPin();

        if (error.codigo === 403) {
          detenerInactividad();
          mostrarMensaje(
            'Tarjeta bloqueada',
            error.message + ' Acuda a su sucursal o utilice la app móvil para gestionar su tarjeta.',
            'Retirar tarjeta',
            reiniciarFlujo,
          );
          return;
        }

        if (error.codigo === 401) {
          mostrarMensaje('PIN incorrecto', error.message, 'Reintentar', function () {
            irA('pin');
          });
          return;
        }

        manejarError(error, reiniciarFlujo);
      });
  }

  function aplicarLimites(limites) {
    estado.limites = limites;

    var retiro = nodo('#montoRetiro');
    retiro.min = limites.retiro.minimo;
    retiro.max = limites.retiro.maximo;
    retiro.step = limites.retiro.denominacion;

    var deposito = nodo('#montoDeposito');
    deposito.min = limites.deposito.minimo;
    deposito.max = limites.deposito.maximo;
    deposito.step = limites.deposito.denominacion;

    nodo('#notaRetiro').textContent =
      'Montos entre ' +
      formatearMoneda(limites.retiro.minimo) +
      ' y ' +
      formatearMoneda(limites.retiro.maximo) +
      ', en múltiplos de ' +
      limites.retiro.denominacion +
      '.';

    nodo('#notaDeposito').textContent =
      'Montos entre ' +
      formatearMoneda(limites.deposito.minimo) +
      ' y ' +
      formatearMoneda(limites.deposito.maximo) +
      ', en múltiplos de ' +
      limites.deposito.denominacion +
      '.';

    var transferencia = nodo('#montoTransferencia');
    transferencia.max = limites.transferencia.maximo;
  }

  function cargarLimites() {
    return api
      .consultarLimites()
      .then(aplicarLimites)
      .catch(function () {
        return null;
      });
  }

  function consultarSaldo() {
    mostrarCarga('Consultando saldo...');
    api
      .consultarSaldo()
      .then(function (datos) {
        ocultarCarga();
        nodo('#saldoCuenta').textContent = datos.numeroCuenta;
        nodo('#saldoMonto').textContent = formatearMoneda(datos.saldo);
        nodo('#saldoFecha').textContent = 'Consulta realizada el ' + formatearFecha(datos.consultadoEn);
        irA('saldo');
      })
      .catch(manejarError);
  }

  function construirComprobante(comprobante) {
    var lineas = [];
    var ancho = 40;
    var separador = new Array(ancho + 1).join('=');

    lineas.push(centrar((config.nombreBanco || 'Banco ATM').toUpperCase(), ancho));
    lineas.push(centrar('COMPROBANTE DE OPERACION', ancho));
    lineas.push(separador);
    lineas.push('Cajero      : ' + (config.identificadorCajero || 'ATM-001'));
    lineas.push('Folio       : ' + comprobante.folio);
    lineas.push('Fecha       : ' + formatearFecha(comprobante.fecha));
    lineas.push('Operacion   : ' + comprobante.tipo);
    lineas.push('Canal       : ' + comprobante.canal);
    lineas.push('Estado      : ' + comprobante.estado);
    lineas.push(separador);

    if (comprobante.cuentaOrigen) {
      lineas.push('Cuenta cargo: ' + comprobante.cuentaOrigen);
    }
    if (comprobante.cuentaDestino) {
      lineas.push('Cuenta abono: ' + comprobante.cuentaDestino);
    }

    lineas.push('Monto       : ' + formatearMoneda(comprobante.monto));

    if (comprobante.saldoResultante !== null && comprobante.saldoResultante !== undefined) {
      lineas.push('Saldo final : ' + formatearMoneda(comprobante.saldoResultante));
    }

    if (comprobante.descripcion) {
      lineas.push('Concepto    : ' + comprobante.descripcion);
    }

    lineas.push(separador);
    lineas.push(centrar('CONSERVE ESTE COMPROBANTE', ancho));
    lineas.push(centrar('Documento simulado - proyecto academico', ancho));

    return lineas.join('\n');
  }

  function centrar(texto, ancho) {
    if (texto.length >= ancho) {
      return texto;
    }
    var espacios = Math.floor((ancho - texto.length) / 2);
    return new Array(espacios + 1).join(' ') + texto;
  }

  function mostrarComprobante(comprobante) {
    nodo('#textoComprobante').textContent = construirComprobante(comprobante);
    irA('comprobante');
  }

  function leerMonto(idCampo) {
    var valor = Number(nodo(idCampo).value);
    if (!valor || valor <= 0) {
      return null;
    }
    return valor;
  }

  function ejecutarOperacion(promesa, textoCarga) {
    mostrarCarga(textoCarga);
    return promesa
      .then(function (comprobante) {
        ocultarCarga();
        mostrarComprobante(comprobante);
      })
      .catch(function (error) {
        manejarError(error, function () {
          irA('menu');
        });
      });
  }

  function confirmarRetiro() {
    var monto = leerMonto('#montoRetiro');
    if (monto === null) {
      mostrarMensaje('Monto requerido', 'Seleccione o capture un monto válido.', 'Aceptar', function () {
        irA('retiro');
      });
      return;
    }
    ejecutarOperacion(api.retirar(monto), 'Dispensando efectivo...').then(function () {
      nodo('#montoRetiro').value = '';
    });
  }

  function confirmarDeposito() {
    var monto = leerMonto('#montoDeposito');
    if (monto === null) {
      mostrarMensaje('Monto requerido', 'Seleccione o capture un monto válido.', 'Aceptar', function () {
        irA('deposito');
      });
      return;
    }
    ejecutarOperacion(api.depositar(monto), 'Validando billetes...').then(function () {
      nodo('#montoDeposito').value = '';
    });
  }

  function confirmarTransferencia() {
    var cuenta = nodo('#cuentaDestino').value.trim();
    var monto = leerMonto('#montoTransferencia');
    var concepto = nodo('#conceptoTransferencia').value.trim();

    if (!/^\d{6,30}$/.test(cuenta)) {
      mostrarMensaje('Cuenta no válida', 'Capture una cuenta destino de 6 a 30 dígitos.', 'Aceptar', function () {
        irA('transferencia');
      });
      return;
    }

    if (monto === null) {
      mostrarMensaje('Monto requerido', 'Capture un monto válido.', 'Aceptar', function () {
        irA('transferencia');
      });
      return;
    }

    ejecutarOperacion(
      api.transferir(cuenta, monto, concepto),
      'Enviando transferencia...',
    ).then(function () {
      nodo('#cuentaDestino').value = '';
      nodo('#montoTransferencia').value = '';
      nodo('#conceptoTransferencia').value = '';
    });
  }

  function consultarMovimientos() {
    mostrarCarga('Recuperando movimientos...');
    api
      .consultarMovimientos(10)
      .then(function (lista) {
        ocultarCarga();
        var contenedor = nodo('#listaMovimientos');
        contenedor.innerHTML = '';

        if (!lista.length) {
          contenedor.innerHTML = '<p class="pantalla__texto">No hay movimientos registrados.</p>';
          irA('movimientos');
          return;
        }

        lista.forEach(function (movimiento) {
          var fila = document.createElement('div');
          fila.className = 'movimiento';

          var izquierda = document.createElement('div');
          var titulo = document.createElement('div');
          titulo.textContent = movimiento.tipo + (movimiento.estado === 'FALLIDA' ? ' (fallida)' : '');
          var detalle = document.createElement('div');
          detalle.className = 'movimiento__detalle';
          detalle.textContent =
            formatearFecha(movimiento.fecha) +
            (movimiento.contraparte ? ' · ' + movimiento.contraparte : '') +
            (movimiento.descripcion ? ' · ' + movimiento.descripcion : '');
          izquierda.appendChild(titulo);
          izquierda.appendChild(detalle);

          var monto = document.createElement('div');
          monto.className =
            'movimiento__monto ' +
            (movimiento.signo === 'ABONO' ? 'movimiento__monto--abono' : 'movimiento__monto--cargo');
          monto.textContent =
            (movimiento.signo === 'ABONO' ? '+' : '-') + formatearMoneda(movimiento.monto);

          fila.appendChild(izquierda);
          fila.appendChild(monto);
          contenedor.appendChild(fila);
        });

        irA('movimientos');
      })
      .catch(manejarError);
  }

  function cargarCatalogo() {
    mostrarCarga('Cargando catálogo...');
    api
      .catalogoServicios()
      .then(function (lista) {
        ocultarCarga();
        estado.proveedores = lista;
        var select = nodo('#proveedorServicio');
        select.innerHTML = '';
        lista.forEach(function (proveedor) {
          var opcion = document.createElement('option');
          opcion.value = proveedor.codigo;
          opcion.textContent = proveedor.nombre;
          select.appendChild(opcion);
        });
        actualizarNotaProveedor();
        irA('pago');
      })
      .catch(manejarError);
  }

  function actualizarNotaProveedor() {
    var codigo = nodo('#proveedorServicio').value;
    var proveedor = estado.proveedores.filter(function (item) {
      return item.codigo === codigo;
    })[0];

    if (!proveedor) {
      nodo('#notaProveedor').textContent = '';
      return;
    }

    nodo('#notaProveedor').textContent =
      'Categoría ' +
      proveedor.categoria +
      ' · monto entre ' +
      formatearMoneda(proveedor.montoMinimo) +
      ' y ' +
      formatearMoneda(proveedor.montoMaximo) +
      ' · referencia de ' +
      proveedor.longitudReferencia +
      ' caracteres.';
  }

  function confirmarPago() {
    var codigo = nodo('#proveedorServicio').value;
    var referencia = nodo('#referenciaServicio').value.trim();
    var monto = leerMonto('#montoServicio');

    if (!codigo) {
      mostrarMensaje('Proveedor requerido', 'Seleccione un proveedor del catálogo.', 'Aceptar', function () {
        irA('pago');
      });
      return;
    }

    if (!/^[A-Za-z0-9]{4,20}$/.test(referencia)) {
      mostrarMensaje(
        'Referencia no válida',
        'La referencia debe ser alfanumérica de 4 a 20 caracteres.',
        'Aceptar',
        function () {
          irA('pago');
        },
      );
      return;
    }

    if (monto === null) {
      mostrarMensaje('Monto requerido', 'Capture un monto válido.', 'Aceptar', function () {
        irA('pago');
      });
      return;
    }

    ejecutarOperacion(
      api.pagarServicio(codigo, referencia, monto),
      'Aplicando el pago...',
    ).then(function () {
      nodo('#referenciaServicio').value = '';
      nodo('#montoServicio').value = '';
    });
  }

  function confirmarCambioPin() {
    var actual = nodo('#pinActual').value.trim();
    var nuevo = nodo('#pinNuevo').value.trim();
    var confirmacion = nodo('#pinConfirmacion').value.trim();

    if (!/^\d{4,6}$/.test(actual) || !/^\d{4,6}$/.test(nuevo)) {
      mostrarMensaje('PIN no válido', 'Ambos PIN deben tener entre 4 y 6 dígitos.', 'Aceptar', function () {
        irA('cambio-pin');
      });
      return;
    }

    if (nuevo !== confirmacion) {
      mostrarMensaje('PIN no coincide', 'La confirmación no coincide con el nuevo PIN.', 'Aceptar', function () {
        irA('cambio-pin');
      });
      return;
    }

    mostrarCarga('Actualizando PIN...');
    api
      .cambiarPin(actual, nuevo)
      .then(function (resultado) {
        ocultarCarga();
        nodo('#pinActual').value = '';
        nodo('#pinNuevo').value = '';
        nodo('#pinConfirmacion').value = '';
        mostrarMensaje('PIN actualizado', resultado.mensaje, 'Menú principal', function () {
          irA('menu');
        });
      })
      .catch(function (error) {
        manejarError(error, function () {
          irA('cambio-pin');
        });
      });
  }

  function consultarTarjeta() {
    mostrarCarga('Consultando su tarjeta...');
    api
      .consultarTarjeta()
      .then(function (tarjeta) {
        ocultarCarga();
        nodo('#tarjetaNumero').textContent = tarjeta.numeroTarjeta;
        nodo('#tarjetaEstado').textContent =
          tarjeta.estado + (tarjeta.motivoBloqueo ? ' (' + tarjeta.motivoBloqueo + ')' : '');
        nodo('#tarjetaIntentos').textContent = tarjeta.intentosFallidos;
        irA('tarjeta-gestion');
      })
      .catch(manejarError);
  }

  function confirmarBloqueo() {
    if (!window.confirm('¿Confirma el bloqueo de su tarjeta? La sesión se cerrará.')) {
      return;
    }

    mostrarCarga('Bloqueando tarjeta...');
    api
      .bloquearTarjeta()
      .then(function () {
        ocultarCarga();
        detenerInactividad();
        api.limpiarSesion();
        mostrarMensaje(
          'Tarjeta bloqueada',
          'Su tarjeta quedó bloqueada. Puede desbloquearla desde la app móvil o el portal web.',
          'Retirar tarjeta',
          reiniciarFlujo,
        );
      })
      .catch(function (error) {
        manejarError(error, function () {
          irA('tarjeta-gestion');
        });
      });
  }

  function cerrarSesion() {
    mostrarCarga('Finalizando sesión...');
    detenerInactividad();
    api.logout().then(function () {
      ocultarCarga();
      mostrarMensaje(
        'Gracias por su preferencia',
        'Retire su tarjeta. La sesión finalizó correctamente.',
        'Aceptar',
        reiniciarFlujo,
      );
    });
  }

  function construirMontosRapidos(contenedorId, montos, campoId) {
    var contenedor = nodo(contenedorId);
    contenedor.innerHTML = '';
    (montos || []).forEach(function (monto) {
      var boton = document.createElement('button');
      boton.type = 'button';
      boton.className = 'monto';
      boton.textContent = formatearMoneda(monto);
      boton.addEventListener('click', function () {
        nodo(campoId).value = monto;
      });
      contenedor.appendChild(boton);
    });
  }

  function verificarConexion() {
    var indicador = nodo('#indicadorConexion');
    var texto = nodo('#textoConexion');

    nodo('#avisoApi').textContent = 'API: ' + api.obtenerBaseUrl();

    api
      .estadoServicio()
      .then(function (salud) {
        indicador.className = 'indicador indicador--ok';
        texto.textContent = 'En línea · BD ' + salud.database;
        nodo('#notaConexion').textContent = '';
      })
      .catch(function () {
        indicador.className = 'indicador indicador--error';
        texto.textContent = 'Sin enlace';
        nodo('#notaConexion').textContent =
          'No hay comunicación con la API en ' +
          api.obtenerBaseUrl() +
          '. Use el botón API para cambiar la dirección.';
      });
  }

  function configurarApi() {
    var actual = api.obtenerBaseUrl();
    var nueva = window.prompt('Dirección base de la API bancaria:', actual);
    if (nueva === null) {
      return;
    }
    api.definirBaseUrl(nueva.trim());
    verificarConexion();
  }

  var acciones = {
    'insertar-tarjeta': function () {
      estado.numeroTarjeta = '';
      pintarEntradaTarjeta();
      irA('tarjeta');
    },
    'confirmar-tarjeta': confirmarTarjeta,
    'confirmar-pin': confirmarPin,
    'cancelar-sesion': reiniciarFlujo,
    'volver-menu': function () {
      irA('menu');
    },
    'cerrar-sesion': cerrarSesion,
    'confirmar-retiro': confirmarRetiro,
    'confirmar-deposito': confirmarDeposito,
    'confirmar-transferencia': confirmarTransferencia,
    'confirmar-pago': confirmarPago,
    'confirmar-cambio-pin': confirmarCambioPin,
    'confirmar-bloqueo': confirmarBloqueo,
    'imprimir-comprobante': function () {
      window.print();
    },
  };

  var destinos = {
    saldo: consultarSaldo,
    movimientos: consultarMovimientos,
    pago: cargarCatalogo,
    'tarjeta-gestion': consultarTarjeta,
    retiro: function () {
      irA('retiro');
    },
    deposito: function () {
      irA('deposito');
    },
    transferencia: function () {
      irA('transferencia');
    },
    'cambio-pin': function () {
      irA('cambio-pin');
    },
  };

  function inicializar() {
    nodo('#etiquetaBanco').textContent = config.nombreBanco || 'Banco ATM';
    nodo('#etiquetaCajero').textContent = config.identificadorCajero || 'ATM-001';

    construirTeclado(nodo('[data-teclado="tarjeta"]'), 'tarjeta');
    construirTeclado(nodo('[data-teclado="pin"]'), 'pin');
    construirMontosRapidos('#montosRetiro', config.montosRapidosRetiro, '#montoRetiro');
    construirMontosRapidos('#montosDeposito', config.montosRapidosDeposito, '#montoDeposito');

    document.addEventListener('click', function (evento) {
      var boton = evento.target.closest('[data-accion], [data-ir]');
      if (!boton) {
        return;
      }
      var accion = boton.getAttribute('data-accion');
      var destino = boton.getAttribute('data-ir');

      if (accion && acciones[accion]) {
        acciones[accion]();
      } else if (destino && destinos[destino]) {
        destinos[destino]();
      }
    });

    nodo('#botonConfiguracion').addEventListener('click', configurarApi);
    nodo('#proveedorServicio').addEventListener('change', actualizarNotaProveedor);

    document.addEventListener('keydown', function (evento) {
      if (estado.pantallaActual !== 'tarjeta' && estado.pantallaActual !== 'pin') {
        return;
      }
      var campo = estado.pantallaActual;
      if (/^\d$/.test(evento.key)) {
        manejarTecla(campo, evento.key);
      } else if (evento.key === 'Backspace') {
        manejarTecla(campo, 'Borrar');
      } else if (evento.key === 'Enter') {
        if (campo === 'tarjeta') {
          confirmarTarjeta();
        } else {
          confirmarPin();
        }
      }
    });

    pintarEntradaTarjeta();
    pintarEntradaPin();
    verificarConexion();
    irA('inicio');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inicializar);
  } else {
    inicializar();
  }
})();
