document.addEventListener("DOMContentLoaded", function () {
    console.log("Cotizaciones.js cargado correctamente.");
});

$(document).ready(function () {
    // Cuando el usuario escribe en el campo de búsqueda
    $('#buscar-producto').on('input', function() {
        let termino = $(this).val();
        buscarProductos(termino);
    });
});

function buscarProductos(termino) {
    $.ajax({
        url: `/productos/buscar?termino=${termino}`,
        method: 'GET',
        success: function(response) {
            let tbody = $('#productos-busqueda-lista');
            tbody.empty();  // Limpiar la lista antes de agregar nuevos resultados
            response.forEach(function(producto) {
                let row = `
                    <tr>
                        <td>${producto.id}</td>
                        <td>${producto.nombre}</td>
                        <td>${producto.stock}</td>
                        <td><button class="btn btn-primary" onclick="agregarAOrden(${producto.id})">Agregar</button></td>
                    </tr>
                `;
                tbody.append(row);
            });
        },
        error: function(xhr, status, error) {
            console.error('Error al buscar productos:', error);
        }
    });
}


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
            let row = `
                <tr id="producto-${producto.id}">
                    <td>${producto.id}</td>
                    <td>${producto.nombre}</td>
                    <td>${producto.stock}</td>
                    <td><input type="number" class="form-control" id="stock-necesario-${producto.id}" value="1" min="1" onchange="calcularPrecioTotal(${producto.id})"></td>
                    <td id="precio-${producto.id}">${producto.precio}</td>
                    <td><input type="number" class="form-control" id="ganancia-${producto.id}" value="0" min="0" onchange="calcularPrecioTotal(${producto.id})"></td>
                    <td id="precio-total-${producto.id}" class="precio-total">${producto.precio}</td>
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

    let precioTotal = (precio + (precio * (porcentajeGanancia / 100))) * cantidad;
    $(`#precio-total-${id}`).text(precioTotal.toFixed(2));

    let stockDisponible = parseInt($(`#producto-${id} td:nth-child(3)`).text());

    // Si la cantidad necesaria es menor o igual al stock disponible
    let tipoCompra = $(`#tipo-compra-${id}`);
    if (cantidad <= stockDisponible) {
        // Solo mostrar "Stock" como opción y deshabilitar el select
        tipoCompra.html('<option value="stock">Stock</option>').prop('disabled', true);
    } else {
        // Mostrar solo "Compra Local" y "Pedido", eliminando "Stock"
        tipoCompra.html(`
            <option value="local">Compra Local</option>
            <option value="pedido">Pedido</option>
        `).prop('disabled', false);
    }

    actualizarTotal();
}

function actualizarTotal() {
    let total = 0;
    $('.precio-total').each(function() {
        total += parseFloat($(this).text());
    });
    $('#total-precio').text(total.toFixed(2));
}

function guardarCotizacion() {
    let cotizacion = {
        cliente: $('#cliente').val(),
        solicitante: $('#solicitante').val(),
        email: $('#email').val(),
        referencia: $('#referencia').val(),
        ruc: $('#ruc').val(),
        celular: $('#celular').val(),
        fecha: new Date().toLocaleDateString(), // Fecha actual
        productos: obtenerProductosDeCotizacion(),
        total: $('#total-precio').text(),
        plazo_entrega: $('#plazo_entrega').val(),
        pago_credito: $('#pago_credito').val(),
        tipo_cambio: $('#tipo_cambio').val(),
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
            $('#modalCotizacion').modal('hide'); // Cierra el modal
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
            precio_total: $(this).find('td').eq(6).text(),
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

