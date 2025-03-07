window.mostrarGuias = function(ordenId) {
    let tbody = $(`#detalle-guias-${ordenId}`);

    // Si ya hay datos cargados, simplemente colapsar/expandir
    if (tbody.children().length > 0) {
        return;
    }

    $.ajax({
        url: `/obtener_guias_por_orden/${ordenId}`,
        method: 'GET',
        success: function(guias) {
            tbody.empty();

            if (guias.length > 0) {
                guias.forEach(function(guia) {
                    let guiaRow = `
                        <tr>
                            <td>Guía #${guia.numero_guia}</td>
                            <td>${guia.fecha_emision}</td>
                            <td>${guia.estado}</td>
                            <td>
                                <button class="btn btn-primary" onclick="modificarGuia(${guia.id})">Modificar</button>
                                <button class="btn btn-danger" onclick="eliminarGuia(${guia.id})">Eliminar</button>
                            </td>
                        </tr>
                    `;
                    tbody.append(guiaRow);
                });
            } else {
                tbody.append(`<tr><td colspan="4">No hay guías de remisión asociadas a esta orden.</td></tr>`);
            }
        },
        error: function(error) {
            console.error('Error al obtener las guías de la orden:', error);
            alert('Hubo un error al obtener las guías de la orden.');
        }
    });
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
        url: '/ordenes_venta_guias',
        method: 'GET',
        success: function(ordenes) {
            let tbody = $('#ordenes-lista');
            tbody.empty();

            ordenes.forEach(function(orden) {
                let ordenRow = `
                    <tr>
                        <td>${orden.id}</td>
                        <td>${orden.numero_orden_compra}</td> 
                        <td>${orden.cliente}</td>
                        <td>${orden.fecha}</td>
                        <td>${orden.total}</td>
                        <td>
                            <button class="btn btn-info" onclick="mostrarGuias(${orden.id})" 
                                data-toggle="collapse" data-target="#guias-${orden.id}" aria-expanded="false">
                                Ver Guías
                            </button>
                        </td>
                    </tr>
                    <tr id="guias-${orden.id}" class="collapse">
                        <td colspan="6">
                            <table class="table">
                                <thead>
                                    <tr>
                                        <th>Número Guía</th>
                                        <th>Fecha Emisión</th>
                                        <th>Estado</th>
                                        <th>Acciones</th>
                                    </tr>
                                </thead>
                                <tbody id="detalle-guias-${orden.id}">
                                    <!-- Aquí se insertarán dinámicamente las guías -->
                                </tbody>
                            </table>
                        </td>
                    </tr>
                `;
                tbody.append(ordenRow);
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

window.modificarGuia = function(idGuia) {
    if (!idGuia || isNaN(idGuia)) {
        console.error("Error: ID de la guía no recibido en modificarGuia.");
        alert("Error: No se recibió el ID de la guía.");
        return;
    }

    console.log("ID de Guía recibido en modificarGuia:", idGuia); // Debugging

    $.ajax({
        url: `/obtener_detalle_guia/${idGuia}`,
        method: 'GET',
        success: function(guia) {
            console.log("Guía encontrada:", guia);

            let tbody = $('#productos-guia-lista');
            tbody.empty();

            guia.productos.forEach(function(producto) {
                let row = `
                    <tr>
                        <td>${producto.nombre}</td>
                        <td>${producto.cantidad}</td>
                        <td>${producto.estado}</td>
                    </tr>
                `;
                tbody.append(row);
            });

            $('#estadoGuia').val(guia.estado);
            $('#comentarioGuia').val(guia.comentario || ''); // Agregar comentario si existe

            if (guia.imagen_url) {
                $('#imagenPrevia').attr('src', guia.imagen_url).show();
            } else {
                $('#imagenPrevia').hide();
            }
            $('#imagenGuia').val("");
            $('#detalleGuiaModal').data('idGuia', idGuia);
            console.log("ID de guía almacenado en modal:", $('#detalleGuiaModal').data('idGuia'));

            $('#detalleGuiaModal').modal('show');
        },
        error: function(error) {
            console.error('Error al obtener el detalle de la guía:', error);
            alert('Hubo un error al obtener los detalles de la guía.');
        }
    });
};

// Función para guardar los cambios de la guía
$('#guardarCambiosGuia').click(function() {
    let idGuia = $('#detalleGuiaModal').data('idGuia'); 

    console.log("ID de guía recuperado en guardarCambiosGuia:", idGuia);

    if (!idGuia || isNaN(idGuia)) {
        alert('Error: ID de la Guía no definido.');
        return;
    }

    let estadoGuia = $('#estadoGuia').val();
    let comentario = $('#comentarioGuia').val();
    let imagenInput = $('#imagenGuia')[0];
    let imagen = imagenInput && imagenInput.files.length > 0 ? imagenInput.files[0] : null;

    let formData = new FormData();
    formData.append('estado', estadoGuia);
    formData.append('comentario', comentario);
    if (imagen) {
        formData.append('imagen', imagen);
    }

    $.ajax({
        url: `/actualizar_guia/${idGuia}`, 
        method: 'POST',
        data: formData,
        processData: false,
        contentType: false,
        success: function(response) {
            alert('Cambios guardados exitosamente.');
            $('#detalleGuiaModal').modal('hide');  // Cerrar modal
            cargarOrdenesYGuias();  // Refrescar lista de guías
        },
        error: function(error) {
            console.error('Error al guardar los cambios de la guía:', error);
            alert('Hubo un error al guardar los cambios.');
        }
    });
});

window.volverADetalleOrden = function() {
    $('#detalleGuiaModal').modal('hide'); 
    if (window.modalAnterior) {
        $(window.modalAnterior).modal('show');
    }
};
