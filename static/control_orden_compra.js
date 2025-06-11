let paginaOC = 1, totalPagOC = 1, currentOC = null;

// Al cargar la página
$(document).ready(() => {
  cargarOC(1);
  $('#btn-ver-mas-oc').click(() => {
    if (paginaOC < totalPagOC) cargarOC(paginaOC + 1);
  });
});

// 1) Listar Órdenes de Compra paginadas
function badgeEstado(estado) {
  const map = {
    'Pendiente': 'secondary',
    'En Proceso': 'warning',
    'Emitida':   'warning',
    'Cerrada':   'success'
  };
  return `<span class="badge badge-${map[estado]||'light'}">${estado}</span>`;
}

// 1) Listar Órdenes
function cargarOC(pagina = 1) {
  $.getJSON(`/orden_compra?page=${pagina}&per_page=20`, resp => {
    const $tb = $('#oc-lista');
    if (pagina === 1) $tb.empty();
    resp.ordenes.forEach(o => {
      $tb.append(`
        <tr>
          <td>${o.id}</td>
          <td>${o.cliente}</td>
          <td>${o.numero_orden}</td>
          <td>${o.numero_cotizacion}</td>
          <td>${o.fecha}</td>
          <td>${o.monto.toFixed(2)}</td>
          <td>${o.moneda}</td>
          <td>${badgeEstado(o.estado)}</td>
          <td>${o.solicitante}</td>
          <td>${o.tiempo_dias}</td>
          <td>
            <button class="btn btn-sm btn-primary" onclick="verDetalleOC(${o.id})">
              Detalle
            </button>
          </td>
        </tr>`);
    });
    $('#btn-ver-mas-oc').toggle(resp.pagina_actual < resp.paginas);
  }).fail(() => alert('Error al cargar órdenes de compra.'));
}

// 2) Ver detalle
function verDetalleOC(id) {
  currentOC = id;
  $.getJSON(`/orden_compra/${id}`, oc => {
    $('#detalle-observaciones').text(oc.observaciones);
    const $tb = $('#productos-orden-compra-lista').empty();
    oc.productos.forEach(p => {
      const porRecibir = p.cantidad_ordenada - p.cantidad_recibida;
      const totalLinea = (p.precio_unitario * p.cantidad_ordenada).toFixed(2);
      $tb.append(`
        <tr data-poc-id="${p.producto_orden_compra_id}" data-max="${porRecibir}">
          <td>${p.nombre_producto}</td>
          <td>${p.cantidad_ordenada}</td>
          <td>${p.cantidad_recibida}</td>
          <td>${porRecibir}</td>
          <td>${p.precio_unitario.toFixed(2)}</td>
          <td>${totalLinea}</td>
          <td>
            <input type="number" class="form-control form-control-sm cant-a-incluir"
                   value="${porRecibir}" min="0" max="${porRecibir}">
          </td>
        </tr>`);
    });
    listarGuiasCompra(id);
    $('#detalleOCModal').modal('show');
  }).fail(() => alert('Error al obtener detalles de la orden.'));
}

// 2.1) Listar guías
function listarGuiasCompra(ocId) {
  $.getJSON(`/orden_compra/${ocId}/guias_remision`, guias => {
    const $tb = $('#guias-compra-lista').empty();
    guias.forEach(g => {
      $tb.append(`
        <tr>
          <td>${g.numero_guia}</td>
          <td>${g.fecha_emision}</td>
          <td>${badgeEstado(g.estado)}</td>
          <td>
            <button class="btn btn-sm btn-secondary" onclick="verDetalleGuiaCompra(${g.id})">
              Ver/Editar
            </button>
          </td>
        </tr>`);
    });
  });
}

// 3) Generar nueva Guía desde la OC abierta
function generarGuiaCompra() {
  const numero = $('#numeroGuiaCompra').val().trim();
  if (!numero) return alert('Ingresa número de Guía.');

  const lineas = [];
  $('#productos-orden-compra-lista tr').each(function () {
    const pocId = $(this).data('poc-id');
    const max = parseInt($(this).data('max'), 10);
    const cant = parseInt($(this).find('.cant-a-incluir').val(), 10) || 0;

    if (cant < 0 || cant > max) {
      alert(`Cantidad inválida para POC ${pocId}. Debe estar entre 0 y ${max}.`);
      return false;
    }
    if (cant > 0) {
      lineas.push({ producto_orden_compra_id: pocId, cantidad_recibida: cant });
    }
  });

  if (lineas.length === 0) {
    return alert('Selecciona al menos una cantidad para incluir en la Guía.');
  }

  $.ajax({
    url: `/orden_compra/${currentOC}/guias_remision`,
    method: 'POST',
    contentType: 'application/json',
    data: JSON.stringify({ numero_guia: numero, productos: lineas }),
    success(res) {
      alert(res.mensaje);
      verDetalleOC(currentOC);
    },
    error(xhr) {
      console.error('Error creando guía', xhr);
      alert(xhr.responseJSON?.error || 'Error creando la Guía de Remisión.');
    }
  });
}

// 4) Ver/editar una Guía existente
let modalAnterior = null;
function verDetalleGuiaCompra(idGC){
  modalAnterior = '#detalleOCModal';
  $(modalAnterior).modal('hide');
  $('#gc-productos-lista').empty();
  $.getJSON(`/guia_remision_compra/${idGC}`, gc => {
    $('#detalleGCModal').data('gcId', idGC);
    gc.productos.forEach(p => {
      const maxRecibir = p.cantidad_ordenada - p.cantidad_recibida;
      $('#gc-productos-lista').append(`
        <tr data-pid="${p.producto_orden_compra_id}">
          <td>${p.nombre_producto}</td>
          <td>${p.cantidad_ordenada}</td>
          <td><input type="number" class="form-control form-control-sm cantidad-recibida-input"
                     value="${p.cantidad_recibida}" min="0" max="${maxRecibir}"></td>
          <td><span class="badge ${badgeForEstado(o.estado)}">${o.estado}</span></td>
        </tr>`);
    });
    $('#gc-estado').val(gc.estado);
    $('#gc-comentario').val(gc.comentario||'');
    $('#detalleGCModal').modal('show');
  });
}
// 5) Guardar cambios en la Guía abierta
function guardarCambiosGC() {
  const idGC = $('#detalleGCModal').data('gcId');
  const estado = $('#gc-estado').val();
  const comentario = $('#gc-comentario').val().trim();
  const detalles = [];

  let error = false;
  $('#gc-productos-lista tr').each(function () {
    const pid = $(this).data('pid');
    const max = parseInt($(this).data('max'), 10);
    const cant = parseInt($(this).find('.cantidad-recibida-input').val(), 10) || 0;

    if (cant < 0 || cant > max) {
      alert(`Cantidad inválida para POC ${pid}.`);
      error = true;
      return false;  // sale del each
    }
    if (cant > 0) detalles.push({ producto_orden_compra_id: pid, cantidad_recibida: cant });
  });
  if (error) return;
  if (detalles.length === 0) {
    return alert('Debes incluir al menos un producto.');
  }

  $.ajax({
    url: `/guia_remision_compra/${idGC}`,
    method: 'PUT',
    contentType: 'application/json',
    data: JSON.stringify({ estado, comentario, detalles }),
    success() {
      $('#detalleGCModal').modal('hide');
      verDetalleOC(currentOC);
    },
    error(e) {
      console.error('Error guardando guía', e);
      alert('No se pudieron guardar los cambios en la Guía.');
    }
  });
}

// control_orden_compra.js
function volverDetalleOC(){
  $('#detalleGCModal').modal('hide');
  $('#detalleOCModal').modal('show');
}
