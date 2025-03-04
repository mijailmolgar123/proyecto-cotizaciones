$(document).ready(function() {
    cargarCotizaciones();

    function cargarCotizaciones() {
        $.ajax({
            url: '/cotizaciones',  // Esta ruta debería devolver todas las cotizaciones
            method: 'GET',
            success: function(cotizaciones) {
                let tbody = $('#cotizaciones-lista');
                tbody.empty();  // Vaciar la tabla antes de añadir nuevas filas

                // Iterar sobre cada cotización y construir las filas de la tabla
                cotizaciones.forEach(function(cotizacion) {
                    let row = `
                        <tr>
                            <td>${cotizacion.cliente}</td>
                            <td>${cotizacion.ruc}</td>
                            <td>${cotizacion.fecha}</td>
                            <td><span class="badge badge-${cotizacion.estado === 'Pendiente' ? 'warning' : 'success'}">${cotizacion.estado}</span></td>
                            <td>${cotizacion.creado_por}</td> <!-- Mostrar el creador de la cotización -->
                            <td><button class="btn btn-primary" onclick="verDetalleCotizacion(${cotizacion.id})">Transformar a Orden de Venta</button></td>
                        </tr>
                    `;
                    tbody.append(row);  // Añadir la fila al cuerpo de la tabla
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
                    alert(`Esta cotización ya ha sido convertida en una orden de venta. Puedes verla en el listado de órdenes de venta (ID de la orden: ${response.orden_venta_id}).`);
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
});