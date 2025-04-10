document.addEventListener("DOMContentLoaded", function () {
    console.log("cotizaciones.js cargado correctamente");
});

$(document).ready(function() {
    const tbody = $('#productos-busqueda-lista');
    const btnVerMas = $('#btn-ver-mas');
    const mensajeFin = $('#mensaje-fin');

    let paginaActual = 1;
    let totalPaginas = 1;
    let terminoBusqueda = '';
    const perPage = 20;

    // Cargar la primera página al inicio
    buscarProductos(1, terminoBusqueda);
    function buscarProductos(page, termino) {
        btnVerMas.prop('disabled', true).text('Cargando...');
        $.ajax({
            url: '/productos/buscar',
            method: 'GET',
            data: {
                page: page,
                per_page: perPage,
                termino: termino
            },
            success: function(response) {
                // Agregar sin borrar
                response.productos.forEach(function(producto) {
                    let row = `
                    <tr>
                        <td>${producto.id}</td>
                        <td>${producto.nombre}</td>
                        <td>${producto.stock}</td>
                        <td>
                            <button class="btn btn-primary" onclick="agregarAOrden(${producto.id})">Agregar</button>
                        </td>
                    </tr>
                    `;
                    tbody.append(row);
                });

                paginaActual = response.pagina_actual;
                totalPaginas = response.paginas;

                if (paginaActual >= totalPaginas) {
                    btnVerMas.hide();
                    mensajeFin.show();
                } else {
                    btnVerMas.show().prop('disabled', false).text('Ver más');
                    mensajeFin.hide();
                }
            },
            error: function(xhr, status, error) {
                console.error('Error al buscar productos:', error);
                btnVerMas.prop('disabled', false).text('Ver más');
            }
        });
    }
    // Al escribir en el input => reiniciar la tabla y cargar la página 1
    $('#buscar-producto').on('input', function() {
        terminoBusqueda = $(this).val().trim();
        paginaActual = 1;
        totalPaginas = 1;
        tbody.empty();
        mensajeFin.hide();
        btnVerMas.show();
        buscarProductos(paginaActual, terminoBusqueda);
    });

    // Botón "Ver más"
    btnVerMas.on('click', function() {
        if (paginaActual < totalPaginas) {
            buscarProductos(paginaActual + 1, terminoBusqueda);
        }
    });

    $(document).on('click', '#generar-cotizacion', function () {
        const productos = $('#orden-venta-lista tr');
    
        if (productos.length === 0) {
            alert('Debe agregar al menos un producto antes de generar la cotización.');
            return;
        }
    
        // Si hay productos, mostrar el modal
        $('#modalCotizacion').modal('show');
    }); 
    $('#tipo-moneda-general').on('change', function () {
        let tipo = $(this).val();
    
        if (tipo === 'Soles') {
            $('#monto-cambio').val('1.00').prop('readonly', true);
        } else {
            $('#monto-cambio').prop('readonly', false);
        }
    
        actualizarPreciosSinIGV();
    });
    
    if ($('#tipo-moneda-general').val() === 'Soles') {
        $('#monto-cambio').val('1.00').prop('readonly', true);
    }
    $('#monto-cambio').on('input', function () {
        actualizarPreciosSinIGV();
    });
});

function agregarAOrden(id) {
    // Verificar si el producto ya está en la lista
    if ($(`#producto-${id}`).length > 0) {
        alert('Este producto ya ha sido agregado a la cotización.');
        return;
    }

    $.ajax({
        url: `/productos/${id}`,
        method: 'GET',
        success: function(producto) {
            let precioSinIGV = (producto.precio / 1.18).toFixed(2);
            let row = `
                <tr id="producto-${producto.id}" data-precio-original-sin-igv="${precioSinIGV}">
                    <td>${producto.id}</td>
                    <td>${producto.nombre}</td>
                    <td>${producto.stock}</td>
                    <td><input type="number" class="form-control" id="stock-necesario-${producto.id}" value="1" min="1" onchange="calcularPrecioTotal(${producto.id})"></td>
                    <td id="precio-${producto.id}">${producto.precio}</td>
                    <td id="precio-sin-igv-${producto.id}">${precioSinIGV}</td>
                    <td><input type="number" class="form-control" id="ganancia-${producto.id}" value="0" min="0" onchange="calcularPrecioTotal(${producto.id})"></td>
                    <td id="precio-total-${producto.id}" class="precio-total">${producto.precio}</td>
                    <td id="precio-total-sin-igv-${producto.id}" class="precio-total-sin-igv">${precioSinIGV}</td>
                    <td>
                        <select class="form-control" id="tipo-compra-${producto.id}">
                            <option value="stock">Stock</option>
                            <option value="local">Compra Local</option>
                            <option value="pedido">Pedido</option>
                        </select>
                    </td>
                    <td><button class="btn btn-danger" onclick="eliminarDeOrden(${producto.id})">Eliminar</button></td>
                </tr>
            `;
            $('#orden-venta-lista').append(row);
            calcularPrecioTotal(producto.id); // Asegurarnos de que se aplique la lógica de restricciones inmediatamente
            actualizarTotal();
        }
    });
}

function eliminarDeOrden(id) {
    $(`#producto-${id}`).remove();
    actualizarTotal();
}

function calcularPrecioTotal(id) {
    let precio = parseFloat($(`#precio-${id}`).text());
    let cantidad = parseInt($(`#stock-necesario-${id}`).val());
    let porcentajeGanancia = parseFloat($(`#ganancia-${id}`).val()) || 0;

    let precioUnitarioFinal = precio + (precio * (porcentajeGanancia / 100));
    let precioTotal = precioUnitarioFinal * cantidad;
    let precioTotalSinIGV = precioTotal / 1.18;
    let precioUnitarioSinIGV = precioUnitarioFinal / 1.18;

    $(`#precio-total-${id}`).text(precioTotal.toFixed(2));
    $(`#precio-total-sin-igv-${id}`).text(precioTotalSinIGV.toFixed(2));
    $(`#precio-sin-igv-${id}`).text(precioUnitarioSinIGV.toFixed(2));

    let stockDisponible = parseInt($(`#producto-${id} td:nth-child(3)`).text());

    let tipoCompra = $(`#tipo-compra-${id}`);
    if (cantidad <= stockDisponible) {
        tipoCompra.html('<option value="stock">Stock</option>').prop('disabled', true);
    } else {
        tipoCompra.html(`
            <option value="local">Compra Local</option>
            <option value="pedido">Pedido</option>
        `).prop('disabled', false);
    }

    actualizarTotal();
    actualizarPreciosSinIGV();

}

function actualizarTotal() {
    let total = 0;
    let totalSinIGV = 0;
    let totalSinIGVConvertido = 0;
    const tipoCambio = parseFloat($('#monto-cambio').val()) || 1;

    $('.precio-total').each(function() {
        total += parseFloat($(this).text());
    });

    $('.precio-total-sin-igv').each(function() {
        const valor = parseFloat($(this).text()) || 0;
        totalSinIGV += valor;
    });

    $('#total-precio').text(total.toFixed(2));
    $('#total-sin-igv').text(totalSinIGV.toFixed(2));
    $('#total-sin-igv-convertido').text(totalSinIGVConvertido.toFixed(2));
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
            location.reload();
        },
        error: function(xhr, status, error) {
            console.error('Error al guardar la cotización:', error);
            alert('Hubo un error al guardar la cotización.');
        }
    });
}

function obtenerProductosDeCotizacion() {
    let productos = [];
    $('#orden-venta-lista tr').each(function() {
        let producto = {
            id: $(this).find('td').eq(0).text(),
            cantidad: $(this).find('input').eq(0).val(),
            precio_unitario: $(this).find('td').eq(4).text(),
            ganancia: $(this).find('input').eq(1).val(),
            precio_total: $(this).find('td').eq(7).text(),
            tipo_compra: $(this).find('select').val()
        };
        productos.push(producto);
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

function actualizarPreciosSinIGV() {
    const tipoCambio = parseFloat($('#monto-cambio').val()) || 1;
    const tipoMoneda = $('#tipo-moneda-general').val();
    let totalSinIGVConvertido = 0;

    $('#orden-venta-lista tr').each(function () {
        const fila = $(this);
        const cantidad = parseInt(fila.find('input').eq(0).val()) || 1;
        const precioTotalSinIGVTexto = fila.find('.precio-total-sin-igv').text();
        const precioTotalSinIGV = parseFloat(precioTotalSinIGVTexto) || 0;

        let convertido;
        if (tipoMoneda === "Soles") {
            convertido = precioTotalSinIGV;
        } else {
            convertido = precioTotalSinIGV / tipoCambio;
        }

        totalSinIGVConvertido += convertido;
    });

    $('#total-sin-igv-convertido').text(totalSinIGVConvertido.toFixed(2));
}
