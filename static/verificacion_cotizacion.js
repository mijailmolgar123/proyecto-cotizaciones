$(document).ready(function() {
    cargarCotizaciones();

    function cargarCotizaciones() {
        $.ajax({
            url: '/cotizaciones',  
            method: 'GET',
            success: function(cotizaciones) {
                let tbody = $('#cotizaciones-lista');
                tbody.empty();  

                cotizaciones.forEach(function(cotizacion) {
                    let estadoClass = 'secondary'; // Estado por defecto
                    if (cotizacion.estado === 'Pendiente') estadoClass = 'warning';
                    else if (cotizacion.estado === 'Finalizado Total') estadoClass = 'success';
                    else if (cotizacion.estado === 'Finalizado Parcial') estadoClass = 'info';
                    else if (cotizacion.estado === 'Rechazada') estadoClass = 'danger';

                    let row = `
                        <tr>
                            <td>${cotizacion.cliente}</td>
                            <td>${cotizacion.ruc}</td>
                            <td>${cotizacion.fecha}</td>
                            <td><span class="badge badge-${estadoClass}">${cotizacion.estado}</span></td>
                            <td>${cotizacion.creado_por}</td> 
                            <td>
                                <button class="btn btn-primary" onclick="verDetalleCotizacion(${cotizacion.id})">
                                    Transformar a Orden de Venta
                                </button>
                            </td>
                        </tr>
                    `;
                    tbody.append(row);
                });
            },
            error: function(xhr, status, error) {
                console.error('Error al cargar cotizaciones:', error);
                alert('Hubo un problema al cargar las cotizaciones. Intenta de nuevo.');
            }
        });
    }

    window.verDetalleCotizacion = function(id) {
        $.ajax({
            url: `/cotizacion/${id}`,
            method: 'GET',
            success: function(response) {
                if (response.mensaje === 'Cotización ya convertida') {
                    alert(`Esta cotización ya ha sido convertida en una orden de venta.`);
                    return;
                }

                let tbody = $('#productos-cotizacion-lista');
                tbody.empty();
                response.productos.forEach(function(producto) {
                    let row = `
                        <tr>
                            <td>${producto.nombre}</td>
                            <td>${producto.precio_unitario}</td>
                            <td>${producto.cantidad}</td>
                            <td>${producto.precio_total}</td>
                            <td><input type="checkbox" class="form-check-input" id="producto-${producto.id}"></td>
                        </tr>
                    `;
                    tbody.append(row);
                });

                window.currentCotizacionId = id;
                $('#detalleCotizacionModal').modal('show');
            },
            error: function(error) {
                console.error("Error al obtener los detalles de la cotización:", error);
                alert("Hubo un error al obtener los detalles de la cotización.");
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
        $('#productos-cotizacion-lista tr').each(function() {
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
                success: function(response) {
                    alert('Orden de venta generada exitosamente.');
                    $('#detalleCotizacionModal').modal('hide');
                    cargarCotizaciones();
                },
                error: function(xhr, status, error) {
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
            success: function(response) {
                alert('Cotización rechazada correctamente.');
                $('#detalleCotizacionModal').modal('hide');
                cargarCotizaciones();
            },
            error: function(error) {
                alert('Hubo un problema al rechazar la cotización.');
            }
        });
    });
});