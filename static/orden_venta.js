$(document).ready(function () {

    // Cargar todas las órdenes de venta
    cargarOrdenesVenta();

    let paginaActual = 1;
    let totalPaginas = 1;

    function cargarOrdenesVenta(pagina = 1) {
        $.ajax({
            url: `/ordenes_venta?page=${pagina}&per_page=20`,
            method: 'GET',
            success: function (response) {
                const ordenes = response.ordenes;
                paginaActual = response.pagina_actual;
                totalPaginas = response.total_paginas;
    
                let tbody = $('#ordenes-lista');
                if (pagina === 1) tbody.empty(); // Solo vaciar si es la primera página
    
                ordenes.forEach(function (orden) {
                    let row = `
                        <tr>
                            <td>${orden.cliente}</td>
                            <td>${orden.solicitante}</td>
                            <td>${orden.fecha_orden_compra || 'No definida'}</td>
                            <td><span class="badge badge-${badgeClass(orden.estado)}">${orden.estado}</span></td>
                            <td>${orden.estado_tiempo}</td>
                            <td>${orden.total}</td>
                            <td>${orden.tipo_cambio}</td>
                            <td>${orden.total_convertido || '-'}</td>
                            <td>${orden.plazo_entrega}</td>
                            <td>${orden.pago_credito}</td>
                            <td>${orden.creado_por}</td>
                            <td><button class="btn btn-primary" onclick="verDetalleOrden(${orden.id})">Ver Detalle</button></td>
                        </tr>
                    `;
                    tbody.append(row);
                });
    
                // Mostrar u ocultar el botón "Ver más"
                if (paginaActual >= totalPaginas) {
                    $('#btn-ver-mas-ordenes').hide();
                } else {
                    $('#btn-ver-mas-ordenes').show();
                }
            },
            error: function (xhr, status, error) {
                console.error('Error al cargar órdenes de Venta:', error);
                alert('Hubo un problema al cargar las órdenes de Venta. Intenta de nuevo.');
            }
        });
    }
    
    // Limpiar los detalles de la orden seleccionada
    function limpiarDetalleOrden() {
        $('#productos-orden-lista').empty();  // Limpiar la lista de productos
        $('#lista-guias-remision').empty();   // Limpiar la lista de guías de remisión
        $('#numeroGuia').val('');             // Limpiar el campo del número de guía
    }

    // Función para obtener el detalle de la orden seleccionada
    window.verDetalleOrden = function (id) {
        console.log(` Cargando detalles de la orden ${id}`);

        limpiarDetalleOrden();

        $.ajax({
            url: `/orden_venta/${id}`,
            method: 'GET',
            success: function (orden) {
                window.currentOrdenId = id;
                mostrarProductosOrden(orden.productos);
                obtenerGuiasRemision(id); 
                
                console.log(" Llamando a obtenerProductosRemisionados...");
                obtenerProductosRemisionados(id);  // <- Esto asegura que se ejecute

                $('#detalleOrdenModal').modal('show');
            },
            error: function (error) {
                console.error(" Error al obtener los detalles de la orden de Venta:", error);
                alert("Hubo un error al obtener los detalles de la orden de Venta.");
            }
        });
    };

    // Mostrar los productos de la orden en la tabla
    function mostrarProductosOrden(productos) {
        let tbody = $('#productos-orden-lista');
        tbody.empty();  // Limpiar antes de agregar

        productos.forEach(function (producto) {
            let row = `
                <tr data-producto-id="${producto.id}">
                    <td>${producto.nombre}</td>
                    <td>${producto.stock !== undefined ? producto.stock : 'No disponible'}</td>
                    <td>${producto.cantidad}</td>
                    <td>0</td> <!-- Por defecto, cantidad remitida es 0 hasta que se carguen los remitidos -->
                    <td>
                        <input type="number" class="cantidad-seleccionada" min="0" max="${producto.cantidad}" value="0">
                    </td>
                </tr>
            `;
            tbody.append(row);
        });
    }

    // Obtener los productos remitidos para la orden de venta
    function obtenerProductosRemisionados(ordenId) {
        console.log(`📡 Intentando obtener productos remitidos de: /orden_venta/${ordenId}/productos_remision`);  // Log de depuración

        $.ajax({
            url: `/orden_venta/${ordenId}/productos_remision`,
            method: 'GET',
            success: function (productosRemisionados) {
                console.log(" Datos recibidos de productos remitidos:", productosRemisionados);
                if (Object.keys(productosRemisionados).length === 0) {
                    console.warn(' No se encontraron productos remitidos para esta orden.');
                }
                actualizarCantidadesRemisionadas(productosRemisionados);
            },
            error: function (err) {
                console.error(' Error al obtener productos remitidos:', err);
            }
        });
    }

    // Actualizar la tabla con las cantidades remitidas
    function actualizarCantidadesRemisionadas(productosRemisionados) {
        console.log("Productos remitidos recibidos:", productosRemisionados);

        $('#productos-orden-lista tr').each(function () {
            const productoId = $(this).data('producto-id');
            const cantidadTotalOrden = parseInt($(this).find('td').eq(2).text()); // Cantidad total en la orden

            const totalRemitido = productosRemisionados[productoId]
                ? productosRemisionados[productoId].cantidad_remitida  // Ahora usa la cantidad correcta del backend
                : 0;

            console.log(
                `Producto_Orden_ID ${productoId} -> Total en Orden: ${cantidadTotalOrden}, `
                + `Cantidad Remitida: ${totalRemitido}`
            );

            $(this).find('td').eq(3).text(totalRemitido);

            const cantidadMax = cantidadTotalOrden - totalRemitido;
            console.log(`Producto ID ${productoId} -> Máximo Permitido en Nueva Guía: ${cantidadMax}`);

            $(this).find('.cantidad-seleccionada').attr('max', cantidadMax);

            if (cantidadMax <= 0) {
                $(this).find('.cantidad-seleccionada').prop('disabled', true);
            }
        });
    }

    // Obtener las guías de remisión asociadas a la orden
    function obtenerGuiasRemision(ordenId) {
        $.ajax({
            url: `/orden_venta/${ordenId}/guias_remision`,
            method: 'GET',
            success: function (guias) {
                mostrarGuiasRemision(guias);
            },
            error: function (err) {
                if (err.status === 404) {
                    console.warn('No se encontraron guías de remisión para esta orden.');
                    mostrarGuiasRemision([]);  // Pasar una lista vacía
                } else {
                    console.error('Error al obtener las guías de remisión:', err);
                }
            }
        });
    }

    // Mostrar las guías de remisión en la tabla correspondiente
    // Función para mostrar las guías de remisión en la tabla correspondiente
    function mostrarGuiasRemision(guias) {
        let guiaTbody = $('#lista-guias-remision');
        guiaTbody.empty();  // Limpiar la tabla antes de agregar nuevas filas

        guias.forEach(function (guia) {
            console.log("Datos de la guía recibida:", guia); // Depuración

            let idGuia = guia.id || guia.guia_remision_id; // Asegurar que se usa el ID correcto

            if (!idGuia) {
                console.warn("ID de la guía no encontrado:", guia);
                return; // Evita agregar filas si el ID no está definido
            }

            let row = `
                <tr>
                    <td>${guia.numero_guia}</td>
                    <td>${guia.fecha_emision}</td>
                    <td>${guia.estado}</td>
                    <td><button class="btn btn-info" onclick="verDetalleGuia(${idGuia})">Ver Detalle</button></td> 
                </tr>
            `;
            guiaTbody.append(row);
        });
    }

    // Generar una nueva guía de remisión
    window.generarGuiaRemision = function () {
        const numeroGuia = $('#numeroGuia').val();
        const productos = [];

        let errorExceso = false;

        $('#productos-orden-lista tr').each(function () {
            const productoId = $(this).data('producto-id');
            const cantidadSeleccionada = parseInt($(this).find('.cantidad-seleccionada').val());
            const cantidadMax = parseInt($(this).find('.cantidad-seleccionada').attr('max'));

            if (cantidadSeleccionada > 0) {
                if (cantidadSeleccionada > cantidadMax) {
                    errorExceso = true;
                    alert(`Error: La cantidad ingresada para el producto con ID ${productoId} supera el máximo permitido (${cantidadMax}).`);
                    return false;  // Detener el bucle
                }

                productos.push({
                    id: productoId,
                    cantidad: cantidadSeleccionada
                });
            }
        });

        if (errorExceso) return;  // Evitar el envío si hay errores

        if (productos.length === 0) {
            alert('Debe seleccionar al menos un producto para generar la guía de remisión.');
            return;
        }
        if (!window.currentOrdenId) {
            alert('ID de la orden no definido.');
            return;
        }

        $.ajax({
            url: `/orden_venta/${window.currentOrdenId}/guias_remision`,
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({
                numero_guia: numeroGuia,
                productos: productos
            }),
            success: function (response) {
                console.log('Guía de remisión generada:', response);
                alert('Guía de remisión creada con éxito');
                $('#detalleOrdenModal').modal('hide');
            },
            error: function (err) {
                console.error('Error al crear la guía de remisión:', err);
            }
        });
        cargarOrdenesVenta(1);
    };

   // Función para obtener el detalle de la guía de remisión
    window.verDetalleGuia = function (idGuia) {
        if (!idGuia || isNaN(idGuia)) {
            alert('Error: Número de Guía inválido.');
            return;
        }

        // Guardar el modal anterior (orden de venta)
        $('#detalleOrdenModal').modal('hide'); // Ocultar modal anterior
        window.modalAnterior = '#detalleOrdenModal'; // Guardar referencia

        $.ajax({
            url: `/obtener_detalle_guia/${idGuia}`,
            method: 'GET',
            success: function (guia) {
                let tbody = $('#productos-guia-lista');
                tbody.empty();

                guia.productos.forEach(function (producto) {
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
                $('#comentarioGuia').val(guia.comentario || '');

                if (guia.imagen_url) {
                    $('#imagenPrevia').attr('src', guia.imagen_url).show();
                } else {
                    $('#imagenPrevia').hide();
                }
                $('#imagenGuia').val("");  // Resetear input de archivo

                // Almacenar número de guía en el modal
                $('#detalleGuiaModal').data('numeroGuia', idGuia);
                console.log("Número de guía almacenado en modal:", $('#detalleGuiaModal').data('numeroGuia'));

                $('#detalleGuiaModal').modal('show');
            },
            error: function (error) {
                console.error('Error al obtener el detalle de la guía:', error);
                alert('Hubo un error al obtener los detalles de la guía.');
            }
        });
    };

    window.volverADetalleOrden = function () {
    $('#detalleGuiaModal').modal('hide'); // Cerrar modal de guía de remisión

        setTimeout(function () {
                if (window.modalAnterior) {
                    $(window.modalAnterior).modal('show'); // Mostrar el modal anterior
                }
            }, 500); // Retraso para evitar conflictos con Bootstrap
    };


    // Restaurar el desplazamiento cuando se cierre el modal de detalle de la guía
    $('#detalleGuiaModal').on('hidden.bs.modal', function () {
        if (!$('.modal.show').length) {  // Si no hay otros modales abiertos
            $('body').removeClass('modal-open');
            $('.modal-backdrop').remove();
            $('body').css('padding-right', ''); 
        }
    });
    $('#total-sin-igv-convertido').text(totalSinIGVConvertido.toFixed(2));

});

$('#guardarCambiosGuia').click(function() {
    let numeroGuia = $('#detalleGuiaModal').data('numeroGuia'); // Obtener el número de guía
    if (!numeroGuia || isNaN(numeroGuia)) {
        alert('Error: Número de Guía no definido.');
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
        url: `/actualizar_guia/${numeroGuia}`,
        method: 'POST',
        data: formData,
        processData: false,
        contentType: false,
        success: function(response) {
            alert('Guía actualizada correctamente.');

            // 🔹 Restaurar el desplazamiento antes de volver al modal anterior
            $('body').removeClass('modal-open');
            $('.modal-backdrop').remove();
            $('body').css('padding-right', ''); // Opcional: quitar el padding derecho que Bootstrap agrega

            $('#detalleGuiaModal').modal('hide');

            // 🔹 Recargar el detalle de la orden para reflejar los cambios
            if (window.currentOrdenId) {
                setTimeout(function () {
                    verDetalleOrden(window.currentOrdenId); // Llama a la función para recargar los datos
                }, 500); // Pequeño retraso para evitar conflictos visuales
            }
        },
        error: function(error) {
            console.error('Error al actualizar la guía:', error);
            alert('Hubo un error al actualizar la guía.');
        }
    });
});

window.cargarOrdenesVenta = function () {
    $.ajax({
        url: '/ordenes_venta',
        method: 'GET',
        success: function (ordenes) {
            let tbody = $('#ordenes-lista');
            tbody.empty();

            ordenes.forEach(function (orden) {
                let row = `
                    <tr>
                        <td>${orden.cliente}</td>
                        <td>${orden.solicitante}</td>
                        <td>${orden.fecha_orden_compra || 'No definida'}</td>
                        <td><span class="badge badge-${orden.estado === 'Pendiente' ? 'warning' : 'success'}">${orden.estado}</span></td>
                        <td>${orden.estado_tiempo}</td>
                        <td>${orden.total}</td>
                        <td>${orden.tipo_cambio}</td>
                        <td>${orden.total_convertido || '-'}</td>
                        <td>${orden.plazo_entrega}</td>
                        <td>${orden.pago_credito}</td>
                        <td>${orden.creado_por}</td>
                        <td><button class="btn btn-primary" onclick="verDetalleOrden(${orden.id})">Ver Detalle</button></td>
                    </tr>
                `;
                tbody.append(row);
            });
        },
        error: function (xhr, status, error) {
            console.error('Error al cargar órdenes de Venta:', error);
            alert('Hubo un problema al cargar las órdenes de Venta. Intenta de nuevo.');
        }
    });
};

$('#btn-ver-mas-ordenes').on('click', function () {
    if (paginaActual < totalPaginas) {
        cargarOrdenesVenta(paginaActual + 1);
    }
});

function badgeClass(estado){
    switch (estado) {
      case 'Completada':      return 'success';      // verde
      case 'Observaciones':   return 'warning';      // amarillo
      case 'Parcial':         return 'info';         // celeste
      case 'En Proceso':      return 'secondary';    // gris
      default:                return 'dark';
    }
  }