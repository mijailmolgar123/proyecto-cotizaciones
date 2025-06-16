$(function () {
  const tbody       = $('#cotizaciones-lista');
  const btnAnt      = $('#btn-anterior');
  const btnSig      = $('#btn-siguiente');
  const btnFiltrar  = $('#btn-filtrar');
  const lblPage     = $('#page-actual');
  const lblTotal    = $('#page-total');
  const perPage     = 20;

  let paginaActual = 1;
  let totalPaginas = 1;

  function obtenerFiltros() {
    return {
      page: paginaActual,
      per_page: perPage,
      fecha_inicio: $('#filtro-fecha-inicio').val(),
      fecha_fin:    $('#filtro-fecha-fin').val(),
      ruc:          $('#filtro-ruc').val().trim(),
      estado:       $('#filtro-estado').val()
    };
  }

  function cargarCotizaciones(page = 1) {
    paginaActual = page;
    tbody.empty();
    $.ajax({
      url: '/cotizaciones',
      method: 'GET',
      data: obtenerFiltros(),
      success(res) {
        // Inyectar filas
        res.cotizaciones.forEach(c => {
          const clase = c.estado==='Pendiente' ? 'warning'
                      : c.estado==='Rechazada'? 'danger'
                      : c.estado.includes('Finalizado')? 'success'
                      : 'secondary';
          tbody.append(`
            <tr id="cot-${c.id}">
              <td>${c.id}</td>
              <td>${c.cliente}</td>
              <td>${c.ruc}</td>
              <td>${c.fecha}</td>
              <td>${parseFloat(c.monto).toLocaleString('es-PE',{minimumFractionDigits:2})}</td>
              <td>${c.moneda}</td>
              <td><span class="badge badge-${clase}">${c.estado}</span></td>
              <td>${c.creado_por}</td>
              <td>
                <button class="btn btn-primary"
                        onclick="verDetalleCotizacion(${c.id})">
                  Transformar a Orden de Venta
                </button>
              </td>
            </tr>
          `);
        });

        // Actualizar controles de paginación
        paginaActual = res.pagina_actual;
        totalPaginas = res.paginas;
        lblPage.text(paginaActual);
        lblTotal.text(totalPaginas);
        btnAnt.prop('disabled', paginaActual <= 1);
        btnSig.prop('disabled', paginaActual >= totalPaginas);
      },
      error() {
        alert('Error cargando cotizaciones.');
      }
    });
  }

  // -----------------------------------------------------------
  // Aquí: dispara la búsqueda SOLO al hacer click en “Filtrar”
  btnFiltrar.on('click', () => cargarCotizaciones(1));

  // Navegación de páginas
  btnAnt.on('click', () => {
    if (paginaActual > 1) cargarCotizaciones(paginaActual - 1);
  });
  btnSig.on('click', () => {
    if (paginaActual < totalPaginas) cargarCotizaciones(paginaActual + 1);
  });

  // Carga inicial sin filtros
  cargarCotizaciones();

    window.verDetalleCotizacion = function (id) {
        $.ajax({
            url: `/cotizacion/${id}`,
            method: 'GET',
            success: function (response) {
                // 1) Si el backend envía 'mensaje' bloquea
                if (response.mensaje) {
                    alert(response.mensaje);
                    return;
                }

                // 2) Si no hay mensaje, cargamos productos y abrimos modal
                const tbody = $('#productos-cotizacion-lista').empty();
                response.productos.forEach(function (producto) {
                    const row = `
                    <tr>
                        <td>${producto.nombre}</td>
                        <td>${producto.precio_unitario}</td>
                        <td>${producto.cantidad}</td>
                        <td>${producto.precio_total}</td>
                        <td>
                          <input type="checkbox"
                                 class="form-check-input"
                                 id="producto-${producto.id}">
                        </td>
                    </tr>`;
                    tbody.append(row);
                });

                window.currentCotizacionId = id;
                $('#detalleCotizacionModal').modal('show');
            },
            error: function (xhr) {
                // 3) Si el backend respondió con un status ≠ 200 y mensaje, lo mostramos
                const json = xhr.responseJSON;
                if (json && json.mensaje) {
                    alert(json.mensaje);
                } else {
                    alert("Hubo un error al obtener los detalles de la cotización.");
                }
            }
        });
    };

    $('#transformar-orden-venta').click(function () {
        let numeroOrdenCompra = $('#numeroOrdenCompra').val();
        let fechaOrdenCompra = $('#fechaOrdenCompra').val();

        if (!numeroOrdenCompra || !fechaOrdenCompra) {
            alert("Debe ingresar el número y la fecha de la Orden de Compra.");
            return;
        }
        let productosSeleccionados = [];
        $('#productos-cotizacion-lista tr').each(function () {
            if ($(this).find('input[type="checkbox"]').is(':checked')) {
                productosSeleccionados.push({
                    id: $(this).find('input[type="checkbox"]').attr('id').replace('producto-', ''),
                    cantidad: $(this).find('td').eq(2).text(),
                    precio_unitario: $(this).find('td').eq(1).text(),
                    precio_total: $(this).find('td').eq(3).text()
                });
            }
        });

        if (productosSeleccionados.length > 0) {
            $.ajax({
                url: `/transformar_orden_venta/${window.currentCotizacionId}`,
                method: 'POST',
                contentType: 'application/json',
                data: JSON.stringify({
                    numero_orden_compra: numeroOrdenCompra,
                    fecha_orden_compra: fechaOrdenCompra,
                    productos: productosSeleccionados
                }),
                success: function (response) {
                    alert(response.lista_deseo_info || 'Orden de venta generada exitosamente.');
                    $('#detalleCotizacionModal').modal('hide');

                    // 2) Obtengo el nuevo estado y determino la clase bootstrap
                    const nuevoEstado = response.estado;
                    const claseBadge = (nuevoEstado === 'Finalizado Total')
                        ? 'success'   // verde
                        : 'info';     // azul
                    const $fila = $(`#cotizacion-${window.currentCotizacionId}`);

                    // 4) Reemplazo sólo la columna del estado (índice 3)
                    $fila
                        .find('td').eq(3)
                        .html(`<span class="badge badge-${claseBadge}">${nuevoEstado}</span>`);

                    window.location.reload();
                },
                error: function (xhr, status, error) {
                    console.error('Error al obtener los detalles de la orden de venta:', xhr.responseText);
                    alert("Hubo un error al obtener los detalles de la orden de venta.");
                }
            });
        } else {
            alert('Debe seleccionar al menos un producto.');
        }
    });

    // Nueva función para rechazar una cotización
    $('#rechazar-cotizacion').click(function () {
        if (!confirm("¿Está seguro de que desea rechazar esta cotización? Esta acción no se puede deshacer.")) {
            return;
        }

        $.ajax({
            url: `/rechazar_cotizacion/${window.currentCotizacionId}`,
            method: 'POST',
            success: function (response) {
                alert('Cotización rechazada correctamente.');
                $('#detalleCotizacionModal').modal('hide');
                window.location.reload();
            },
            error: function (error) {
                alert('Hubo un problema al rechazar la cotización.');
            }
        });
    });

});