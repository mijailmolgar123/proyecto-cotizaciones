$(document).ready(function () {

    // Cargar todas las órdenes de venta
    cargarOrdenesVenta();

    function cargarOrdenesVenta() {
        $.ajax({
            url: '/ordenes_venta',  
            method: 'GET',
            success: function (ordenes) {
                let tbody = $('#ordenes-lista');
                tbody.empty();  // Limpiar la tabla antes de agregar filas nuevas

                ordenes.forEach(function (orden) {
                    let row = `
                        <tr>
                            <td>${orden.cliente}</td>
                            <td>${orden.solicitante}</td>
                            <td>${orden.fecha}</td>
                            <td>${orden.email}</td>
                            <td><span class="badge badge-${orden.estado === 'Pendiente' ? 'warning' : 'success'}">${orden.estado}</span></td>
                            <td>${orden.creado_por}</td>
                            <td><button class="btn btn-primary" onclick="verDetalleOrden(${orden.id})">Ver Detalle</button></td>
                        </tr>
                    `;
                    tbody.append(row);  // Agregar fila a la tabla
                });
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
        limpiarDetalleOrden();

        $.ajax({
            url: `/orden_venta/${id}`,
            method: 'GET',
            success: function (orden) {
                window.currentOrdenId = id;
                mostrarProductosOrden(orden.productos);
                obtenerGuiasRemision(id); // Ahora también obtendrá los detalles de las guías
                $('#detalleOrdenModal').modal('show');
            },
            error: function (error) {
                console.error("Error al obtener los detalles de la orden de Venta:", error);
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
        $.ajax({
            url: `/orden_venta/${ordenId}/productos_remision`,
            method: 'GET',
            success: function (productosRemisionados) {
                if (Object.keys(productosRemisionados).length === 0) {
                    console.warn('No se encontraron productos remitidos para esta orden.');
                }
                actualizarCantidadesRemisionadas(productosRemisionados);
            },
            error: function (err) {
                if (err.status === 404) {
                    console.warn('No se encontraron productos remitidos para esta orden.');
                    actualizarCantidadesRemisionadas({});  // Pasar un objeto vacío si no hay remitidos
                } else {
                    console.error('Error al obtener productos remitidos:', err);
                }
            }
        });
    }


    // Actualizar la tabla con las cantidades remitidas
    function actualizarCantidadesRemisionadas(productosRemisionados) {
        $('#productos-orden-lista tr').each(function () {
            const productoId = $(this).data('producto-id');
            const totalRemitido = productosRemisionados[productoId] 
                ? productosRemisionados[productoId].cantidad_total - productosRemisionados[productoId].cantidad_pendiente 
                : 0; // Si no hay cantidad remitida, usar 0

            console.log(`Producto ID ${productoId}, Cantidad Remitida Total desde backend: ${totalRemitido}`);

            $(this).find('td').eq(3).text(totalRemitido);  // Actualiza la columna de cantidad ya incluida en la Guía
            const cantidadMax = $(this).find('td').eq(2).text() - totalRemitido;
            $(this).find('.cantidad-seleccionada').attr('max', cantidadMax);  // Ajusta el max según la cantidad remitida

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

        $('#productos-orden-lista tr').each(function () {
            const productoId = $(this).data('producto-id');
            const cantidadSeleccionada = $(this).find('.cantidad-seleccionada').val();

            if (productoId && cantidadSeleccionada > 0) {
                productos.push({
                    id: productoId,
                    cantidad: cantidadSeleccionada
                });
            }
        });

        console.log("Productos enviados para la guía:", productos);

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
    };

    // Función para obtener el detalle de la guía de remisión
    window.verDetalleGuia = function (idGuia) {
        $.ajax({
            url: `/guia_remision/${idGuia}/productos`,
            method: 'GET',
            success: function (productos) {
                console.log("Productos obtenidos de la guía:", productos); // Depuración
                mostrarProductosGuia(productos);
                $('#detalleGuiaModal').modal('show');  // Mostrar el modal con los productos
            },
            error: function (error) {
                console.error("Error al obtener los detalles de la guía:", error);
                alert("Hubo un error al obtener los detalles de la guía.");
            }
        });
    };

    // Función para mostrar los productos de la guía en el modal
    function mostrarProductosGuia(productos) {
        let tbody = $('#productos-guia-lista');
        tbody.empty(); // Limpiar antes de agregar nuevos datos

        productos.forEach(function (producto) {
            let row = `
                <tr>
                    <td>${producto.nombre}</td>
                    <td>${producto.cantidad}</td>
                    <td>${producto.estado}</td>
                </tr>
            `;
            tbody.append(row);
        });

        if (productos.length === 0) {
            tbody.append('<tr><td colspan="3" class="text-center">No hay productos en esta guía.</td></tr>');
        }
    }


});
