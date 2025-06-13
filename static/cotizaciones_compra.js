let itemsPendientes = [];
let itemsCotizacion = []; // array local para la cotización en construcción

document.addEventListener('DOMContentLoaded', function () {
    console.log("cotizaciones_compra.js cargado");
    cargarItemsPendientes();
});

// 1. Cargar items de la lista de deseos pendientes
function cargarItemsPendientes() {
    $.ajax({
        url: '/items_deseo_pendientes',
        method: 'GET',
        success: function (response) {
            itemsPendientes = response;
            renderItemsPendientes();
        },
        error: function (err) {
            console.error("Error al cargar items pendientes", err);
        }
    });
}

function renderItemsPendientes() {
    let tbody = $('#items-pendientes-lista');
    tbody.empty();
    itemsPendientes.forEach(item => {
        // Ej: item: {item_deseo_id, lista_id, nombre_lista, nombre_producto, stock_disponible, cantidad_necesaria...}
        let row = `
        <tr>
            <td>${item.nombre_lista}</td>
            <td>${item.nombre_producto}</td>
            <td>${item.stock_disponible}</td>
            <td>${item.cantidad_necesaria}</td>
            <td>
                <button class="btn btn-primary" onclick="agregarAFormularioCotizacion(${item.item_deseo_id}, '${item.nombre_producto}', ${item.stock_disponible}, ${item.cantidad_necesaria})">Agregar</button>
            </td>
        </tr>`;
        tbody.append(row);
    });
}

// 2. Agregar un ítem al array itemsCotizacion
function agregarAFormularioCotizacion(id, nombre, stock, necesario) {
    if (!id || !nombre) {
        console.error("Error: El producto no tiene datos válidos.");
        return;
    }

    // Ver si ya lo agregaste
    let existe = itemsCotizacion.find(item => item.item_deseo_id === id);
    if (existe) {
        alert("Este producto ya está en la cotización.");
        return;
    }

    // Agregar al array local
    itemsCotizacion.push({
        item_deseo_id: id,
        nombre_producto: nombre,
        stockDisponible: stock,
        cantidad: necesario,
        precio_ofrecido: 0
    });

    // Renderiza tabla usando itemsCotizacion
    renderCotizacionItems();
}

// 3. Renderizar la tabla de la derecha
function renderCotizacionItems() {
    let tbody = $('#cotizacion-compra-items');
    tbody.empty();
    itemsCotizacion.forEach((item, index) => {
        let row = `
        <tr id="fila-${index}">
            <td>${item.nombre_producto}</td>
            <td>
                <input type="number" class="form-control" value="${item.cantidad}"
                       onchange="cambiarCantidad(${index}, this.value)">
            </td>
            <td>
                <input type="number" step="0.01" class="form-control" min="0.01"
                     value="${item.precio_ofrecido}" onchange="cambiarPrecio(${index}, this.value)">
            </td>
            <td>
                <button class="btn btn-danger" onclick="eliminarItemCotizacion(${index})">Eliminar</button>
            </td>
        </tr>
        `;
        tbody.append(row);
    });
}

function cambiarPrecio(ind, val) {
    let p = parseFloat(val) || 0;
    itemsCotizacion[ind].precio_ofrecido = p;
}
function cambiarCantidad(ind, val) {
    let c = parseInt(val) || 1;
    itemsCotizacion[ind].cantidad = c;
}
function cambiarFechaEntrega(ind, val) {
    itemsCotizacion[ind].fecha_entrega_estimada = val; // YYYY-MM-DD string
}
function eliminarItemCotizacion(ind) {
    itemsCotizacion.splice(ind, 1);
    renderCotizacionItems();
}

// 4. Guardar la Cotización de Compra
function guardarCotizacionCompra() {
    const provId = $('#proveedor-id').val().trim();
    if (!provId) {
        alert("Debes seleccionar un proveedor válido.");
        return;
    }

    const dataCot = {
        proveedor_id: parseInt(provId, 10),              // <-- la FK
        forma_pago: $('#forma_pago').val().trim(),
        fecha_oferta: $('#fecha_oferta').val() || null,
        validez_dias: parseInt($('#validez_dias').val(), 10) || null,
        plazo_entrega_dias: parseInt($('#plazo_entrega_dias').val(), 10) || null,
        items: []
    };

    if (itemsCotizacion.length === 0) {
        alert("No hay ítems en la cotización de compra.");
        return;
    }

    for (let item of itemsCotizacion) {
        if (!item.precio_ofrecido || item.precio_ofrecido <= 0) {
            alert(`El producto "${item.nombre_producto}" tiene un precio ofrecido inválido.`);
            return;
        }
        dataCot.items.push({
            item_deseo_id: item.item_deseo_id,
            precio_ofrecido: item.precio_ofrecido,
            cantidad: item.cantidad
        });
    }

    $.ajax({
        url: '/cotizacion_compra/crear_con_items',
        method: 'POST',
        contentType: 'application/json',
        data: JSON.stringify(dataCot),
        success(resp) {
            alert(resp.mensaje);
            $('#form-cotizacion-compra')[0].reset();
            itemsCotizacion = [];
            renderCotizacionItems();
            // además, resetear proveedor-busqueda
            $('#proveedor-busqueda').prop('disabled', false).val('');
            $('#proveedor-id').val('');
            $('#btn-cambiar-proveedor').hide();
            cargarItemsPendientes();
        },
        error(err) {
            console.error("Error al crear cotizacion compra", err);
            alert("Ocurrió un error al crear la cotización de compra.");
        }
    });
}


$(function () {
    // Autocomplete de Proveedores
    $('#proveedor-busqueda').autocomplete({
        minLength: 2, delay: 300,
        source(request, response) {
            $.getJSON('/proveedores', { term: request.term }, data => {
                response(data.map(p => ({
                    label: `${p.nombre} — ${p.ruc}`,
                    value: p.nombre,
                    id: p.id
                })));
            });
        },
        select(e, ui) {
            $('#proveedor-busqueda')
                .val(ui.item.label).prop('disabled', true);
            $('#proveedor-id').val(ui.item.id);
            $('#btn-cambiar-proveedor').show();
            return false;
        }
    });

    // Cambiar proveedor
    $('#btn-cambiar-proveedor').click(() => {
        $('#proveedor-busqueda').prop('disabled', false).val('').focus();
        $('#proveedor-id').val('');
        $(this).hide();
    });

    // Nuevo proveedor (abre modal)
    $('#btn-nuevo-proveedor').click(() => {
        $('#modalProveedor').modal('show');
    });

    // Guardar nuevo proveedor
    $('#guardar-nuevo-proveedor').click(() => {
        const nombre = $('#nuevo-prov-nombre').val().trim();
        const ruc = $('#nuevo-prov-ruc').val().trim();
        if (!nombre || !ruc) { alert('Faltan datos'); return; }
        $.ajax({
            url: '/proveedores',
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({ nombre, ruc }),
            success(p) {
                $('#modalProveedor').modal('hide');
                $('#proveedor-busqueda')
                    .val(`${p.nombre} — ${p.ruc}`)
                    .prop('disabled', true);
                $('#proveedor-id').val(p.id);
                $('#btn-cambiar-proveedor').show();
            },
            error() {
                alert('Error al crear proveedor');
            }
        });
    });
});
