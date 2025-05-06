const $tbodyBusqueda   = $('#productos-busqueda-lista');
const $btnVerMas       = $('#btn-ver-mas');
const $msgFin          = $('#mensaje-fin');
const $tblDetalle      = $('#orden-venta-lista');

let paginaActual  = 1;
let totalPaginas  = 1;
let termino       = '';
const PER_PAGE    = 20;
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
            <td>${p.stock}</td>
            <td><button class="btn btn-primary" onclick="agregarAOrden(${p.id})">Agregar</button></td>
          </tr>`);
      });

      paginaActual = res.pagina_actual;
      totalPaginas = res.paginas;
      if (paginaActual >= totalPaginas) { $btnVerMas.hide(); $msgFin.show(); }
      else                             { $btnVerMas.show().prop('disabled', false).text('Ver más'); $msgFin.hide(); }
    },
    error: err => { console.error('Error buscando productos', err); $btnVerMas.prop('disabled', false).text('Ver más'); }
  });
}

/* ----------------- listeners de búsqueda ----------------- */
$('#buscar-producto').on('input', function () {
  /* NOTE: Considera aplicar debounce (~300 ms) para reducir peticiones cuando el usuario escribe rápido. */
  termino       = $(this).val().trim();
  paginaActual  = 1; totalPaginas = 1;
  $tbodyBusqueda.empty(); $msgFin.hide(); $btnVerMas.show();
  buscarProductos(1, termino);
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
      $tblDetalle.append(`
        <tr id="producto-${p.id}" data-precio-soles="${p.precio}">
          <td>${p.id}</td>
          <td>${p.nombre}</td>
          <td>${p.stock}</td>

          <td><input type="number" class="form-control cant-necesaria" value="1" min="1"></td>
          <td class="precio-soles">${p.precio}</td>

          <td><input type="number" class="form-control margen" value="0" min="0"></td>
          <td class="precio-unit-sin-igv">${precioSinIGVSoles}</td>
          <td class="precio-total">${p.precio}</td>
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
              onclick="mostrarModalEditarPrecio(${p.id})"
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
  const $fila      = $(`#producto-${id}`);
  if (!$fila.length) return;

  // FIXME: Sintaxis inválida — la llamada a .val().max="${p.stock}" rompe la evaluación y debe eliminarse.
  const cantidad   = parseFloat($fila.find('.cant-necesaria').val()) || 1;
  const margen     = parseFloat($fila.find('.margen').val())         || 0;
  const precioSolesIGV = parseFloat($fila.data('precio-soles'))      || 0;

  /* 1) precio unitario CON IGV + margen en soles */
  const pUniFinalIGV_soles = precioSolesIGV * (1 + margen / 100);
  const pTotFinalIGV_soles = pUniFinalIGV_soles * cantidad;

  /* 2) precios SIN IGV en moneda seleccionada */
  const moneda   = $('#tipo-moneda-general').val();
  const tc       = parseFloat($('#monto-cambio').val()) || 1;
  const divisor  = (moneda === 'Soles') ? 1 : tc;

  const pUniSinIGV = (pUniFinalIGV_soles / 1.18) / divisor;
  const pTotSinIGV = pUniSinIGV * cantidad;

  /* 3) pinta celdas */
  $fila.find('.precio-unit-sin-igv')   .text(pUniSinIGV .toFixed(2));
  $fila.find('.precio-total-sin-igv') .text(pTotSinIGV.toFixed(2));
  $fila.find('.precio-total')         .text(pTotFinalIGV_soles.toFixed(2));

  /* 4) bloqueo tipo-compra si la cantidad cabe en stock */
  const stock = parseInt($fila.find('td').eq(2).text()) || 0;
  const $sel  = $fila.find('.tipo-compra');
  if (cantidad <= stock) { $sel.val('stock').prop('disabled', true); }
  else { $sel.prop('disabled', false); }
}

function recalcTotales() {
  /* TODO: Unifica los bucles para recorrer el DOM una sola vez y mejorar el rendimiento. */
  let totIGV = 0, totSinIGV = 0;
  $tblDetalle.find('.precio-total').each((_,td)=> totIGV   += parseFloat($(td).text()) || 0);
  $tblDetalle.find('.precio-total-sin-igv').each((_,td)=> totSinIGV += parseFloat($(td).text()) || 0);

  $('#total-precio').text(totIGV.toFixed(2));
  $('#total-sin-igv').text(totSinIGV.toFixed(2));
}

function recalcTodo() {
  $tblDetalle.find('tr').each((_,tr)=>{ const id = $(tr).attr('id').split('-')[1]; recalcFila(id); });
  recalcTotales();
}

/* ---------------- inputs delegados en la tabla ---------------- */
$tblDetalle.on('input', '.cant-necesaria, .margen', function(){
  const id = $(this).closest('tr').attr('id').split('-')[1];
  recalcFila(id); recalcTotales();
});

/* ==========================================================================
   4.  MONEDA & TIPO DE CAMBIO
   ====================================================================== */
$('#tipo-moneda-general').on('change', function(){
  const esSoles = $(this).val()==='Soles';
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
    let cotizacion = {
        cliente: $('#cliente').val(),
        solicitante: $('#solicitante').val(),
        email: $('#email').val(),
        referencia: $('#referencia').val(),
        ruc: $('#ruc').val(),
        celular: $('#celular').val(),
        fecha: new Date().toLocaleDateString(),
        productos: obtenerProductosDeCotizacion(),
        total: $('#total-precio').text(),
        plazo_entrega: $('#plazo_entrega').val(),
        pago_credito: $('#pago_credito').val(),
        tipo_cambio: $('#tipo-moneda-general').val(),
        valor_cambio: parseFloat($('#monto-cambio').val()),
        lugar_entrega: $('#lugar_entrega').val(),
        detalle_adicional: $('#detalle_adicional').val()
    };

    $.ajax({
        url: '/guardar_cotizacion',
        method: 'POST',
        contentType: 'application/json',
        data: JSON.stringify(cotizacion),
        success: function(response) {
            alert(response.mensaje);
            $('#modalCotizacion').modal('hide');
            limpiarTablaYTotales();
            window.location = "/descargar_excel/" + response.id;
        },
        error: function(xhr, status, error) {
            console.error('Error al guardar la cotización:', error);
            alert('Hubo un error al guardar la cotización.');
        }
    });
}

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
    $('#orden-venta-lista tr').each(function() {
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
        success: function(response) {
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
        error: function(error) {
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

  // 1) Abre el modal y precarga el precio actual
  window.mostrarModalEditarPrecio = function(id) {
    productoAEditar = id;
    const $fila = $(`#producto-${id}`);
    const precioActual = parseFloat($fila.data('precio-soles')) || 0;
    $('#input-nuevo-precio').val(precioActual.toFixed(2));
    $('#modalEditarPrecio').modal('show');
  };
  
  // 2) Al hacer clic en “Guardar”
  $('#btn-guardar-precio').on('click', function() {
    const nuevoPrecio = parseFloat($('#input-nuevo-precio').val());
    if (isNaN(nuevoPrecio) || nuevoPrecio < 0) {
      return alert('Ingresa un precio válido.');
    }
  
    // 3) Llamada AJAX al backend
    $.ajax({
      url: `/productos/${productoAEditar}`,   // veremos el endpoint en el back
      method: 'PUT',
      contentType: 'application/json',
      data: JSON.stringify({ precio: nuevoPrecio }),
      success: () => {
        // 4) Actualizo el DOM sin recargar:
        const $fila = $(`#producto-${productoAEditar}`);
        $fila.data('precio-soles', nuevoPrecio);
        $fila.find('.precio-soles').text(nuevoPrecio.toFixed(2));
        recalcFila(productoAEditar);
        recalcTotales();
        $('#modalEditarPrecio').modal('hide');
      },
      error: (xhr, status, err) => {
        console.error('Error al actualizar precio:', err);
        alert('No se pudo actualizar el precio en el servidor.');
      }
    });
  });
  