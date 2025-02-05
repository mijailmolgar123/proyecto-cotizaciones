window.mostrarGuias = function(ordenId) {
    $(`.guia-row[data-orden-id="${ordenId}"]`).toggle();  // Mostrar u ocultar las guías relacionadas
};

window.eliminarGuia = function(numeroGuia) {
    if (confirm('¿Estás seguro de que deseas eliminar la guía ' + numeroGuia + '?')) {
        $.ajax({
            url: `/eliminar_guia/${numeroGuia}`,  // Ruta para eliminar la guía
            method: 'POST',  // Cambiamos a POST
            data: { _method: 'DELETE' },  // Simulamos DELETE con un campo en los datos del formulario
            success: function(response) {
                alert('Guía eliminada con éxito.');
                cargarOrdenesYGuias();  // Volver a cargar la lista
            },
            error: function(error) {
                console.error('Error al eliminar la guía:', error);
                alert('Hubo un error al eliminar la guía.');
            }
        });
    }
};


function cargarOrdenesYGuias() {
        $.ajax({
        url: '/ordenes_venta_guias',  // Asegurar que no se pase un numero_guia vacío
        method: 'GET',
        success: function(ordenes) {
            let tbody = $('#ordenes-lista');
            tbody.empty();

            ordenes.forEach(function(orden) {
                let ordenRow = `
                    <tr>
                        <td>${orden.id}</td>
                        <td>${orden.cliente}</td>
                        <td>${orden.fecha}</td>
                        <td>${orden.total}</td>
                        <td><button class="btn btn-info" onclick="mostrarGuias(${orden.id})">Ver Guías</button></td>
                    </tr>
                `;
                tbody.append(ordenRow);

                if (orden.guias && orden.guias.length > 0) {
                    orden.guias.forEach(function (guia) {
                        console.log("Número de Guía:", guia.numero_guia);
                        let guiaRow = `
                            <tr class="guia-row" data-orden-id="${orden.id}" style="display:none;">
                                <td colspan="2">Guía #${guia.numero_guia}</td>
                                <td>${guia.fecha_emision}</td>
                                <td>${guia.estado}</td>
                                <td>
                                    <button class="btn btn-primary" onclick="verDetalleGuia('${guia.numero_guia}')">Ver</button>
                                    <button class="btn btn-warning" onclick="editarGuia(${guia.numero_guia})">Editar</button>
                                    <button class="btn btn-danger" onclick="eliminarGuia(${guia.numero_guia})">Eliminar</button>
                                </td>
                            </tr>
                        `;
                        tbody.append(guiaRow);
                    });
                } else {
                    let noGuiasRow = `
                        <tr class="guia-row" data-orden-id="${orden.id}">
                            <td colspan="5">No hay guías de remisión asociadas a esta orden.</td>
                        </tr>
                    `;
                    tbody.append(noGuiasRow);
                }
            });
        },
        error: function(error) {
            console.error('Error al cargar las órdenes de venta y guías:', error);
            alert('Hubo un error al cargar las órdenes de venta y guías de remisión.');
        }
    });

}
$(document).ready(function () {
    cargarOrdenesYGuias();
    
    window.verDetalleGuia = function(numeroGuia) {
        if (!numeroGuia || numeroGuia.trim() === '') {
            alert('El número de guía es inválido.');
            return;
        }

        $.ajax({
            url: `/obtener_detalle_guia/${numeroGuia}`,
            method: 'GET',
            success: function(guia) {
                // Limpiamos la tabla de productos de la guía
                let tbody = $('#productos-guia-lista');
                tbody.empty();

                // Agregar cada producto a la tabla
                guia.productos.forEach(function(producto) {
                    let row = `
                        <tr>
                            <td>${producto.nombre}</td>
                            <td>${producto.cantidad}</td>
                            <td>
                                <input type="checkbox" ${producto.entregado ? 'checked' : ''} data-producto-id="${producto.id}" class="estado-producto">
                            </td>
                        </tr>
                    `;
                    tbody.append(row);
                });

                // Establecemos el estado actual de la guía
                $('#estadoGuia').val(guia.estado);

                // Mostramos el modal
                $('#detalleGuiaModal').modal('show');
            },
            error: function(error) {
                console.error('Error al obtener el detalle de la guía:', error);
                alert('Hubo un error al obtener los detalles de la guía.');
            }
        });
    };


    window.editarGuia = function(numeroGuia) {
        // Aquí implementaremos la lógica para editar una guía
        alert('Editar guía ' + numeroGuia);
    };

    window.verDetalleGuia = function(numeroGuia) {
        $.ajax({
            url: `/obtener_detalle_guia/${numeroGuia}`,  // Asegúrate de que esta URL coincide con la ruta en el backend
            method: 'GET',
            success: function(guia) {
                // Limpiamos la tabla de productos de la guía
                let tbody = $('#productos-guia-lista');
                tbody.empty();

                // Agregar cada producto a la tabla
                guia.productos.forEach(function(producto) {
                    let row = `
                        <tr>
                            <td>${producto.nombre}</td>
                            <td>${producto.cantidad}</td>
                            <td>
                                <input type="checkbox" ${producto.entregado ? 'checked' : ''} data-producto-id="${producto.id}" class="estado-producto">
                            </td>
                        </tr>
                    `;
                    tbody.append(row);
                });

                // Establecemos el estado actual de la guía
                $('#estadoGuia').val(guia.estado);

                // Mostramos el modal
                $('#detalleGuiaModal').modal('show');
            },
            error: function(error) {
                console.error('Error al obtener el detalle de la guía:', error);
                alert('Hubo un error al obtener los detalles de la guía.');
            }
        });
    };


    $('#guardarCambiosGuia').click(function() {
        let productos = [];

        $('#productos-guia-lista tr').each(function() {
            let productoId = $(this).find('.estado-producto').data('producto-id');
            let entregado = $(this).find('.estado-producto').is(':checked');

            productos.push({
                id: productoId,
                entregado: entregado
            });
        });

        let estadoGuia = $('#estadoGuia').val();

        // Enviar los cambios al servidor
        $.ajax({
            url: `/guardar_cambios_guia/${numeroGuia}`,  // Ruta para guardar los cambios
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({
                estado: estadoGuia,
                productos: productos
            }),
            success: function(response) {
                alert('Cambios guardados exitosamente.');
                $('#detalleGuiaModal').modal('hide');
                cargarOrdenesYGuias();  // Actualizar la lista
            },
            error: function(error) {
                console.error('Error al guardar los cambios de la guía:', error);
                alert('Hubo un error al guardar los cambios.');
            }
        });
    });
});
