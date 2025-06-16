const $tbodyBusqueda = $('#productos-busqueda-lista');
const $btnVerMas = $('#btn-ver-mas');
const $msgFin = $('#mensaje-fin');
const $tblDetalle = $('#orden-venta-lista');

let paginaActual = 1;
let totalPaginas = 1;
let termino = '';
const PER_PAGE = 20;
/* al arrancar */
const esSolesInicial = $('#tipo-moneda-general').val() === 'Soles';
$('#monto-cambio').prop({ readonly: esSolesInicial, disabled: esSolesInicial });

/* cada vez que cambie la moneda */
$('#tipo-moneda-general').on('change', function () {
  const esSoles = $(this).val() === 'Soles';

  $('#monto-cambio')
    .val(esSoles ? '1.00' : $('#monto-cambio').val())   // fuerza 1.00 si es Soles
    .prop({ readonly: esSoles, disabled: esSoles });    // bloquea / desbloquea

  recalcTodo();                                         // ← la función que ya tienes
});

/* ==========================================================================
   1.  BÚSQUEDA DE PRODUCTOS / PAGINACIÓN
   ====================================================================== */
function buscarProductos(page = 1, term = '') {
  $btnVerMas.prop('disabled', true).text('Cargando…');

  $.ajax({
    url: '/productos/buscar',
    method: 'GET',
    data: { page, per_page: PER_PAGE, termino: term },
    success(res) {
      res.productos.forEach(p => {
        /* NOTE: p.nombre se inserta sin escape → riesgo XSS si el backend no valida los datos. */
        $tbodyBusqueda.append(`
          <tr>
            <td>${p.id}</td>
            <td>${p.nombre}</td>
            <td>${parseFloat(p.precio).toFixed(2)}</td>
            <td>${p.stock}</td>
            <td><button class="btn btn-primary" onclick="agregarAOrden(${p.id})">Agregar</button></td>
          </tr>`);
      });

      paginaActual = res.pagina_actual;
      totalPaginas = res.paginas;
      if (paginaActual >= totalPaginas) { $btnVerMas.hide(); $msgFin.show(); }
      else { $btnVerMas.show().prop('disabled', false).text('Ver más'); $msgFin.hide(); }
    },
    error: err => { console.error('Error buscando productos', err); $btnVerMas.prop('disabled', false).text('Ver más'); }
  });
}

/* ----------------- listeners de búsqueda ----------------- */
$('#buscar-producto').on('input', function () {
  /* NOTE: Considera aplicar debounce (~300 ms) para reducir peticiones cuando el usuario escribe rápido. */
  termino = $(this).val().trim();
  paginaActual = 1; totalPaginas = 1;
  $tbodyBusqueda.empty(); $msgFin.hide(); $btnVerMas.show();
  buscarProductos(1, termino);
});

/* — Autocomplete Cliente → obtiene {id, nombre, ruc} — */
$("#cliente-busqueda").autocomplete({

  source(req, resp) {
    $.getJSON("/clientes", { term: req.term }, data => {
      resp(data.map(c => ({
        label: `${c.nombre} (RUC: ${c.ruc})`,
        value: c.nombre,
        id: c.id,
        ruc: c.ruc
      })));
    });
  },
  minLength: 2,
  select(ev, ui) {
    $("#cliente-id").val(ui.item.id);
    $("#ruc-input").val(ui.item.ruc);

    // Cargar contactos de este cliente
    $.getJSON(`/clientes/${ui.item.id}/contactos`, contactos => {
      const opts = ['<option value="">-- Selecciona un contacto --</option>']
        .concat(contactos.map(ct =>
          `<option value="${ct.id}">
             ${ct.solicitante} (${ct.email})
           </option>`
        ));
      $("#contacto-seleccion").html(opts.join(""));
    });

    return false;
  }
});

$btnVerMas.on('click', () => { if (paginaActual < totalPaginas) buscarProductos(paginaActual + 1, termino); });

/* Carga inicial */
buscarProductos();

/* ==========================================================================
   2.  AGREGAR PRODUCTO A LA COTIZACIÓN Y CONSTRUIR FILA
   ====================================================================== */
window.agregarAOrden = function (id) {
  if ($(`#producto-${id}`).length) { alert('Ya está agregado.'); return; }

  $.ajax({
    url: `/productos/${id}`,
    method: 'GET',
    success: p => {
      const precioSinIGVSoles = (p.precio / 1.18).toFixed(2); // sin IGV, soles
      const precioFloat = parseFloat(p.precio) || 0;
      const precioCon2Decimales = precioFloat.toFixed(2);
      $tblDetalle.append(`
        <tr id="producto-${p.id}" data-precio-soles="${precioCon2Decimales}">
          <td>${p.id}</td>
          <td>${p.nombre}</td>
          <td>${p.stock}</td>
          <td>${p.unidad}</td> 

          <td><input type="number" class="form-control cant-necesaria" value="1" min="1"></td>
          <td class="precio-soles">${precioCon2Decimales}</td>

          <td><input type="number" class="form-control margen" value="0" min="0"></td>
          <td class="precio-unit-sin-igv">${precioSinIGVSoles}</td>
          <td class="precio-total">${precioCon2Decimales}</td>
          <td class="precio-total-sin-igv">${precioSinIGVSoles}</td>

          <td>
            <select class="form-control tipo-compra">
              <option value="stock">Stock</option>
              <option value="local">Compra Local</option>
              <option value="pedido">Pedido</option>
            </select>
          </td>
          <td>
            <button
              class="btn btn-sm btn-secondary"
              onclick="mostrarModalEditarProducto(${p.id})"
            >Editar</button>
            <button
              class="btn btn-sm btn-danger"
              onclick="eliminarDeOrden(${p.id})"
            >Eliminar</button>
          </td>
        </tr>`);

      recalcFila(p.id);
      recalcTotales();
    },
    error: err => console.error('Error obteniendo producto', err)
  });
};

/* ==========================================================================
   3.  RECÁLCULO FILA  +  TOTALES
   ====================================================================== */
function recalcFila(id) {
  const $fila = $(`#producto-${id}`);
  if (!$fila.length) return;

  // FIXME: Sintaxis inválida — la llamada a .val().max="${p.stock}" rompe la evaluación y debe eliminarse.
  const cantidad = parseFloat($fila.find('.cant-necesaria').val()) || 1;
  const margen = parseFloat($fila.find('.margen').val()) || 0;
  const precioSolesIGV = parseFloat($fila.data('precio-soles')) || 0;

  /* 1) precio unitario CON IGV + margen en soles */
  const pUniFinalIGV_soles = precioSolesIGV * (1 + margen / 100);
  const pTotFinalIGV_soles = pUniFinalIGV_soles * cantidad;

  /* 2) precios SIN IGV en moneda seleccionada */
  const moneda = $('#tipo-moneda-general').val();
  const tc = parseFloat($('#monto-cambio').val()) || 1;
  const divisor = (moneda === 'Soles') ? 1 : tc;

  const pUniSinIGV = (pUniFinalIGV_soles / 1.18) / divisor;
  const pTotSinIGV = pUniSinIGV * cantidad;

  /* 3) pinta celdas */
  $fila.find('.precio-unit-sin-igv').text(pUniSinIGV.toFixed(2));
  $fila.find('.precio-total-sin-igv').text(pTotSinIGV.toFixed(2));
  $fila.find('.precio-total').text(pTotFinalIGV_soles.toFixed(2));

  /* 4) bloqueo tipo-compra si la cantidad cabe en stock */
  const stock = parseInt($fila.find('td').eq(2).text()) || 0;
  const $sel = $fila.find('.tipo-compra');
  if (cantidad <= stock) { $sel.val('stock').prop('disabled', true); }
  else { $sel.prop('disabled', false); }
}

function recalcTotales() {
  /* TODO: Unifica los bucles para recorrer el DOM una sola vez y mejorar el rendimiento. */
  let totIGV = 0, totSinIGV = 0;
  $tblDetalle.find('.precio-total').each((_, td) => totIGV += parseFloat($(td).text()) || 0);
  $tblDetalle.find('.precio-total-sin-igv').each((_, td) => totSinIGV += parseFloat($(td).text()) || 0);

  $('#total-precio').text(totIGV.toFixed(2));
  $('#total-sin-igv').text(totSinIGV.toFixed(2));
}

function recalcTodo() {
  $tblDetalle.find('tr').each((_, tr) => { const id = $(tr).attr('id').split('-')[1]; recalcFila(id); });
  recalcTotales();
}

/* ---------------- inputs delegados en la tabla ---------------- */
$tblDetalle.on('input', '.cant-necesaria, .margen', function () {
  const id = $(this).closest('tr').attr('id').split('-')[1];
  recalcFila(id); recalcTotales();
});

/* ==========================================================================
   4.  MONEDA & TIPO DE CAMBIO
   ====================================================================== */
$('#tipo-moneda-general').on('change', function () {
  const esSoles = $(this).val() === 'Soles';
  $('#monto-cambio').prop('readonly', esSoles);
  if (esSoles) $('#monto-cambio').val('1.00');
  recalcTodo();
});

$('#monto-cambio').on('input', recalcTodo);

// FIXME: eliminarDeOrden llama a actualizarTotal(), función inexistente; usa recalcTotales() para mantener consistencia.
function eliminarDeOrden(id) {
  $(`#producto-${id}`).remove();
  recalcTotales();
}
function guardarCotizacion() {
  const cotizacion = {
    cliente_id: parseInt($("#cliente-id").val(), 10),
    contacto_id: $("#contacto-seleccion").val() || null,
    fecha: new Date().toLocaleDateString(),
    productos: obtenerProductosDeCotizacion(),
    total: parseFloat($("#total-precio").text()),
    plazo_entrega: parseInt($("#plazo_entrega").val(), 10),
    pago_credito: $("#pago_credito").val(),
    tipo_cambio: $("#tipo-moneda-general").val(),
    valor_cambio: parseFloat($("#monto-cambio").val()),
    lugar_entrega: $("#lugar_entrega").val(),
    detalle_adicional: $("#detalle_adicional").val()
  };

  $.ajax({
    url: '/guardar_cotizacion',
    method: 'POST',
    contentType: 'application/json',
    data: JSON.stringify(cotizacion),
    success(response) {
      alert(response.mensaje);
      $('#modalCotizacion').modal('hide');
      limpiarTablaYTotales();
      window.location = "/descargar_excel/" + response.id;
    },
    error(xhr, status, error) {
      console.error('Error al guardar la cotización:', error);
      alert('Hubo un error al guardar la cotización.');
    }
  });
}

$('#form-cotizacion').on('submit', function (e) {
  e.preventDefault();
  guardarCotizacion();
});

function limpiarTablaYTotales() {
  // Vacía todas las filas del detalle
  $('#tblDetalle tbody').empty();

  // Reinicia tu array local si lo usas para acumular productos
  productosEnOrden = [];

  // Recalcula totales (o fija a 0 manualmente)
  recalcTotales();  // asume que esta función pone 0 en todos los totales si no hay filas
}

function obtenerProductosDeCotizacion() {
  let productos = [];
  $('#orden-venta-lista tr').each(function () {
    const id = $(this).find('td').eq(0).text();
    const cantidad = parseFloat($(this).find('input').eq(0).val()) || 1;
    const precioBase = parseFloat($(this).find('td').eq(4).text()) || 0; // Este ya tiene IGV
    const ganancia = parseFloat($(this).find('input').eq(1).val()) || 0;
    const tipo_compra = $(this).find('select').val();

    // Aplicar margen pero SIN quitar IGV (el precio base ya lo incluye)
    const precioUnitarioConMargen = precioBase * (1 + ganancia / 100);
    const precioTotalConMargen = precioUnitarioConMargen * cantidad;

    productos.push({
      id: id,
      cantidad: cantidad,
      precio_unitario: precioUnitarioConMargen.toFixed(2),  // <- CON IGV
      ganancia: ganancia,
      precio_total: precioTotalConMargen.toFixed(2),        // <- CON IGV
      tipo_compra: tipo_compra
    });
  });
  return productos;
}

function crearPreProducto() {
  let nombre = $('#nombre-preproducto').val().trim();
  let precio = parseFloat($('#precio-preproducto').val()) || 0;
  let stockInicial = parseInt($('#stock-preproducto').val()) || 0;

  if (!nombre) {
    alert("El nombre del pre-producto es obligatorio.");
    return;
  }

  // Construir el cuerpo de la petición
  let data = {
    nombre: nombre,
    precio: precio,
    stock: stockInicial,
    tipo_producto: "PRE",   // <--- para que se sepa que es un pre-producto
    descripcion: "Producto creado durante la cotización",
    comentario: "Generado al vuelo en la interfaz de cotizaciones"
  };

  $.ajax({
    url: '/productos',
    method: 'POST',
    contentType: 'application/json',
    data: JSON.stringify(data),
    success: function (response) {
      // response.mensaje, response.id
      let nuevoId = response.id;
      alert(response.mensaje);
      // Cerrar el modal
      $('#modalPreProducto').modal('hide');

      // Limpia los campos del modal
      $('#nombre-preproducto').val('');
      $('#precio-preproducto').val('0');
      $('#stock-preproducto').val('0');

      // Agregar a la "orden de venta" automáticamente
      // para reusar tu misma función
      agregarAOrden(nuevoId);
    },
    error: function (error) {
      console.error('Error al crear pre-producto:', error);
      alert('Hubo un error al crear el pre-producto.');
    }
  });
}

/* ── 5 · Generar cotización ───────────────────────────────────────── */
/* coloca esto después de buscarProductos(); o dentro del $(document).ready */
$('#generar-cotizacion').on('click', function () {
  if (!$tblDetalle.find('tr').length) {
    alert('Debes agregar al menos un producto antes de generar la cotización.');
    return;
  }
  $('#modalCotizacion').modal('show');      // ya tienes el modal en la vista
});

let productoAEditar = null;
// unidadesDisponibles sigue siendo tu array, p. ej.:
let unidadesDisponibles = ['UNIDAD', 'CAJA', 'ROLLO', 'METRO'];

$('#modalEditarProducto')
  .on('shown.bs.modal', function () {
    $(this).attr('aria-hidden', 'false');
    $('#input-nuevo-precio').trigger('focus');
  });

window.mostrarModalEditarProducto = function (id) {
  productoAEditar = id;
  const $fila = $(`#producto-${id}`);
  const precioActual = parseFloat($fila.data('precio-soles')) || 0;
  const unidadActual = $fila.find('td').eq(3).text().trim();

  // 1) Precio
  $('#input-nuevo-precio').val(precioActual.toFixed(2));

  // 2) Poblar datalist
  const opciones = unidadesDisponibles
    .map(u => `<option value="${u}">`)
    .join('');
  $('#datalist-unidades').html(opciones);

  // 3) Valor inicial del input (puede ser personalizado)
  $('#input-nueva-unidad').val(unidadActual);

  // 4) Mostrar modal
  $('#modalEditarProducto').modal('show');

};

// 2) Al hacer clic en “Guardar”
$('#btn-guardar-producto').on('click', function () {
  const nuevoPrecio = parseFloat($('#input-nuevo-precio').val());
  const nuevaUnidad = $('#input-nueva-unidad').val();
  if (isNaN(nuevoPrecio) || nuevoPrecio < 0) {
    return alert('Ingresa un precio válido.');
  }
  if (!nuevaUnidad) {
    return alert('Selecciona una unidad.');
  }

  // AJAX a tu endpoint de actualización
  $.ajax({
    url: `/productos/${productoAEditar}`,   // backend: acepta precio y unidad
    method: 'PUT',
    contentType: 'application/json',
    data: JSON.stringify({
      precio: nuevoPrecio,
      unidad: nuevaUnidad
    }),
    success: () => {
      // 1) Actualizo el DOM:
      const $fila = $(`#producto-${productoAEditar}`);
      $fila
        .data('precio-soles', nuevoPrecio)
        .find('.precio-soles').text(nuevoPrecio.toFixed(2));
      $fila.find('td').eq(3).text(nuevaUnidad);  // columna Unidad

      // 2) Recalculo todo
      recalcFila(productoAEditar);
      recalcTotales();

      // 3) Cierro modal
      $('#modalEditarProducto').modal('hide');

      $('#modalEditarProducto').on('hidden.bs.modal', function () {
        $(this).attr('aria-hidden', 'true');
      });
    },
    error: err => {
      console.error('Error al actualizar producto:', err);
      alert('No se pudo actualizar en el servidor.');
    }
  });
});


(function () {
  let timeout = null;

  function renderClientes(data) {
    const items = data.map(c =>
      `<li class="list-group-item list-group-item-action"
           data-id="${c.id}"
           data-ruc="${c.ruc}"
           data-nombre="${c.nombre}">
         <strong>${c.nombre}</strong>
         <small>(RUC: ${c.ruc})</small>
       </li>`);
    $('#lista-clientes')
      .html(items.length ? items.join('') :
        '<li class="list-group-item text-muted">No hay coincidencias</li>')
      .show();
  }

  function fetchClientes(term = '') {
    $.getJSON('/clientes', { term }, renderClientes);
  }

  $('#cliente-busqueda')
    .on('input', function () {
      clearTimeout(timeout);
      const val = $(this).val().trim();
      timeout = setTimeout(() => {
        fetchClientes(val);
      }, 300);         // debounce
    })
    .on('focus', function () {
      fetchClientes(); // por defecto trae term="" → primeros 10
    });

  // Si haces clic fuera, oculta la lista
  $(document).on('click', e => {
    if (!$(e.target).closest('#cliente-busqueda, #lista-clientes').length) {
      $('#lista-clientes').hide();
    }
  });
})();

$('#lista-clientes').on('click', 'li[data-id]', function () {
  const id = $(this).data('id');
  const nombre = $(this).data('nombre');
  const ruc = $(this).data('ruc');
  $('#cliente-busqueda').val(`${nombre} — ${ruc}`);
  $('#cliente-id').val(id);
  $('#ruc-input').val(ruc);
  $('#lista-clientes').hide();
  $('#btn-cambiar-cliente').show();
  $('#btn-cambiar-cliente').click(resetClienteSelection);

  $('#paso-2-contacto').show();
  cargarContactos(id);
});

$('#btn-nuevo-cliente').click(() => {
  $('#form-nuevo-cliente').toggle();
});

$('#guardar-nuevo-cliente').click(e => {
  e.preventDefault();
  const nombre = $('#nuevo-cliente-nombre').val();
  const ruc = $('#nuevo-cliente-ruc').val();

  $.ajax({
    url: '/clientes',
    method: 'POST',
    contentType: 'application/json; charset=UTF-8',  // aseguras JSON
    dataType: 'json',
    data: JSON.stringify({ nombre, ruc }),            // cadena JSON
    success(cli) {
      // cli = { id, nombre, ruc }
      $('#cliente-id').val(cli.id);
      $('#cliente-busqueda')
        .val(`${cli.nombre} — ${cli.ruc}`)
        .prop('disabled', true);
      $('#ruc-input').val(cli.ruc);
      $('#form-nuevo-cliente').hide();
      $('#btn-cambiar-cliente').show();
      $('#paso-2-contacto').show();
      cargarContactos(cli.id);
    },
    error(xhr) {
      console.error('Error creando cliente:', xhr.status);
    }
  });
});

function cargarContactos(clienteId) {
  $.getJSON(`/clientes/${clienteId}/contactos`, data => {
    const opts = data.map(ct =>
      `<option value="${ct.id}">
         ${ct.solicitante} — ${ct.email}
       </option>`
    );
    $('#contacto-seleccion').html(
      `<option value="">-- Selecciona un contacto --</option>${opts.join('')}`
    );
  });
}

$('#btn-nuevo-contacto').click(() => {
  $('#form-nuevo-contacto').toggle();
});

$('#guardar-nuevo-contacto').click(function (e) {
  e.preventDefault();
  const clienteId = $('#cliente-id').val();
  const solicitante = $('#nuevo-contacto-nombre').val();
  const email = $('#nuevo-contacto-email').val();
  const referencia = $('#nuevo-contacto-referencia').val();
  const celular = $('#nuevo-contacto-celular').val();

  $.ajax({
    url: `/clientes/${clienteId}/contactos`,
    method: 'POST',
    contentType: 'application/json; charset=UTF-8',
    dataType: 'json',
    data: JSON.stringify({ solicitante, email, referencia, celular }),
    success: ct => {
      // 1) Añadimos al <select> y lo seleccionamos:
      $('#contacto-seleccion')
        .append(new Option(`${ct.solicitante} — ${ct.email}`, ct.id))
        .val(ct.id);
      // 2) Ocultamos el form, mostramos el botón de editar y el dropdown:
      $('#form-nuevo-contacto').hide();
      $('#btn-cambiar-contacto').show();
    },
    error: xhr => {
      console.error('Error creando contacto:', xhr.status, xhr.responseText);
    }
  });
});


$('#cancelar-nuevo-cliente').click(() => {
  $('#form-nuevo-cliente').hide();
});
$('#cancelar-nuevo-contacto').click(() => {
  $('#form-nuevo-contacto').hide();
});

function resetClienteSelection() {
  // 1) Limpiar y reactivar el input
  $('#cliente-busqueda')
    .val('')
    .prop('disabled', false)
    .focus();                  // le devolvemos el foco al usuario

  $('#cliente-id').val('');
  $('#ruc-input').val('').prop('readonly', true);

  // 2) Limpiar listado y forzar su visibilidad
  $('#lista-clientes')
    .empty()
    .show();                   // ¡muy importante!

  // 3) Ocultar edición de cliente y paso 2
  $('#btn-cambiar-cliente').hide();
  $('#paso-2-contacto, #form-nuevo-contacto').hide();
}


$('#btn-cambiar-contacto').click(() => {
  $('#paso-2-contacto').show();
  $('#form-nuevo-contacto').hide();
  $('#btn-cambiar-contacto').hide();
});

