let paginaOC = 1, totalPagOC = 1, currentOC = null, modalAnterior = null;

$(document).ready(()=>{
  cargarOC();
  $('#btn-ver-mas-oc').click(()=>{
    if(paginaOC < totalPagOC) cargarOC(paginaOC+1);
  });
});

function cargarOC(page=1){
  $.getJSON(`/orden_compra?page=${page}&per_page=20`, resp=>{
    paginaOC = resp.pagina_actual;
    totalPagOC = resp.paginas;
    let $tb = $('#oc-lista');
    if(page===1) $tb.empty();
    resp.ordenes.forEach(o=>{
      $tb.append(`
        <tr>
          <td>${o.id}</td>
          <td>${o.cotizacion_compra_id||''}</td>
          <td>${o.numero_orden}</td>
          <td>${o.fecha_orden}</td>
          <td>${o.proveedor}</td>
          <td>${o.estado}</td>
          <td>${o.creado_por}</td>
          <td>
            <button class="btn btn-sm btn-primary"
                    onclick="verDetalleOC(${o.id})">Detalle</button>
          </td>
        </tr>`);
    });
    $('#btn-ver-mas-oc').toggle(paginaOC < totalPagOC);
  });
}

function verDetalleOC(id){
  currentOC = id;
  $('#productos-orden-compra-lista, #lista-guias-compra').empty();
  $('#numeroGuiaCompra').val('');
  // 1) Cargar detalle de la OC
  $.getJSON(`/orden_compra/${id}`, oc=>{
    oc.productos.forEach(p=>{
      let restante = p.cantidad - (p.cantidad_recibida||0);
      $('#productos-orden-compra-lista').append(`
        <tr data-poc-id="${p.id}">
          <td>${p.id}</td>
          <td>${p.cantidad}</td>
          <td>${p.cantidad_recibida||0}</td>
          <td>${restante}</td>
          <td>
            <input type="number" class="form-control form-control-sm cant-a-incluir"
                   min="0" max="${restante}" value="${restante}">
          </td>
        </tr>`);
    });
    // 2) Listar guías existentes
    $.getJSON(`/orden_compra/${id}/guias_remision`, guias=>{
      guias.forEach(g=>{
        $('#lista-guias-compra').append(`
          <tr>
            <td>${g.numero_guia}</td>
            <td>${g.fecha_emision.split('T')[0]}</td>
            <td>${g.estado}</td>
            <td>
              <button class="btn btn-info btn-sm"
                      onclick="verDetalleGuiaCompra(${g.id})">Ver</button>
            </td>
          </tr>`);
      });
    });
    $('#detalleOCModal').modal('show');
  });
}

// 3) Generar nueva Guía de Remisión de Compra
function generarGuiaCompra(){
  let numero = $('#numeroGuiaCompra').val().trim();
  if(!numero) return alert('Ingresa número de guía');
  // Recoger sólo las cantidades > 0
  const lineas = [];
  $('#productos-orden-compra-lista tr').each(function(){
    const poc_id = $(this).data('poc-id');
    const cant   = parseInt($(this).find('.cant-a-incluir').val())||0;
    if(cant>0) lineas.push({
      producto_orden_compra_id: poc_id,
      cantidad: cant
    });
  });
  if(lineas.length===0) return alert('Selecciona al menos una cantidad');

  $.ajax({
    url: `/orden_compra/${currentOC}/guias_remision`,
    method:'POST',
    contentType:'application/json',
    data: JSON.stringify({
      numero_guia: numero,
      productos: lineas
    }),
    success(res){
      alert(res.mensaje);
      verDetalleOC(currentOC);
    },
    error(xhr){
      alert(xhr.responseJSON.error || 'Error creando guía');
    }
  });
}

// 4) Ver/Editar detalle de una guía ya creada
function verDetalleGuiaCompra(idGC){
  modalAnterior = '#detalleOCModal';
  $(modalAnterior).modal('hide');
  $('#gc-productos-lista').empty();
  $.getJSON(`/guia_remision_compra/${idGC}`, gc=>{
    $('#detalleGCModal').data('gcId', idGC);
    gc.productos.forEach(p=>{
      $('#gc-productos-lista').append(`
        <tr data-pid="${p.producto_orden_compra_id}">
          <td>${p.producto_orden_compra_id}</td>
          <td><input type="number" class="form-control form-control-sm"
                     value="${p.cantidad_recibida}" min="0"></td>
          <td>${p.estado}</td>
        </tr>`);
    });
    $('#gc-estado').val(gc.estado);
    $('#gc-comentario').val(gc.comentario||'');
    $('#detalleGCModal').modal('show');
  });
}

// 5) Guardar cambios de Guía de Remisión de Compra
function guardarCambiosGC(){
  const idGC = $('#detalleGCModal').data('gcId');
  const estado = $('#gc-estado').val();
  const comentario = $('#gc-comentario').val();
  const detalles = [];
  $('#gc-productos-lista tr').each(function(){
    detalles.push({
      producto_orden_compra_id: $(this).data('pid'),
      cantidad_recibida: parseInt($(this).find('input').val())||0
    });
  });
  $.ajax({
    url: `/guia_remision_compra/${idGC}`,
    method: 'PUT',
    contentType: 'application/json',
    data: JSON.stringify({ estado, comentario, detalles }),
    success(){
      $('#detalleGCModal').modal('hide');
      $(modalAnterior).modal('show');
      verDetalleOC(currentOC);
    },
    error(e){ console.error(e); }
  });
}

function volverDetalleOC(){
  $('#detalleGCModal').modal('hide');
  $(modalAnterior).modal('show');
}
