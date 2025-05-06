let itemsPendientes = [];
let itemsCotizacion = []; // array local para la cotización en construcción

document.addEventListener('DOMContentLoaded', function(){
    console.log("cotizaciones_compra.js cargado");
    cargarItemsPendientes();
});

// 1. Cargar items de la lista de deseos pendientes
function cargarItemsPendientes(){
    $.ajax({
        url: '/items_deseo_pendientes',
        method: 'GET',
        success: function(response){
            itemsPendientes = response; 
            renderItemsPendientes();
        },
        error: function(err){
            console.error("Error al cargar items pendientes", err);
        }
    });
}

function renderItemsPendientes(){
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
function renderCotizacionItems(){
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

function cambiarPrecio(ind, val){
    let p = parseFloat(val) || 0;
    itemsCotizacion[ind].precio_ofrecido = p;
}
function cambiarCantidad(ind, val){
    let c = parseInt(val) || 1;
    itemsCotizacion[ind].cantidad = c;
}
function cambiarFechaEntrega(ind, val){
    itemsCotizacion[ind].fecha_entrega_estimada = val; // YYYY-MM-DD string
}
function eliminarItemCotizacion(ind){
    itemsCotizacion.splice(ind, 1);
    renderCotizacionItems();
}

// 4. Guardar la Cotización de Compra
function guardarCotizacionCompra(){
    let proveedor = $('#proveedor').val().trim();
    if(!proveedor){
        alert("Debes ingresar el nombre del proveedor.");
        return;
    }
    let dataCot = {
        proveedor: proveedor,
        ruc_proveedor: $('#ruc_proveedor').val().trim(),
        forma_pago: $('#forma_pago').val().trim(),
        fecha_oferta: $('#fecha_oferta').val() || null,
        validez_dias: parseInt($('#validez_dias').val()) || null,

        // Nuevo campo:
        plazo_entrega_dias: parseInt($('#plazo_entrega_dias').val()) || null,

        items: []
    };

    if(itemsCotizacion.length === 0){
        alert("No hay ítems en la cotización de compra.");
        return;
    }

    // Llenar items
    for (let item of itemsCotizacion) {
        if (!item.precio_ofrecido || item.precio_ofrecido <= 0) {
            alert(`El producto "${item.nombre_producto}" tiene un precio ofrecido inválido. Por favor ingrésalo correctamente.`);
            return;
        }

        dataCot.items.push({
            item_deseo_id: item.item_deseo_id,
            precio_ofrecido: item.precio_ofrecido,
            cantidad: item.cantidad
        });
    }



    // POST al backend
    $.ajax({
        url: '/cotizacion_compra/crear_con_items',
        method: 'POST',
        contentType: 'application/json',
        data: JSON.stringify(dataCot),
        success: function(resp){
            alert(resp.mensaje);
            // Limpia
            $('#form-cotizacion-compra')[0].reset();
            itemsCotizacion = [];
            renderCotizacionItems();
        },
        error: function(err){
            console.error("Error al crear cotizacion compra", err);
            alert("Ocurrió un error al crear la cotización de compra.");
        }
    });
}
