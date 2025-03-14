let itemsDeseos = []; 
// Estructura: [{tempId: 1, productId: 3, nombre: "xxx", stockDisponible: 37, stockNecesario: 1, precio: 0, precioTotal: 0}, ...]

document.addEventListener("DOMContentLoaded", function () {
    console.log("lista_deseos.js cargado.");
    // Buscar producto al tipear
    $('#buscar-producto').on('input', function(){
        let termino = $(this).val().trim();
        if (termino.length > 0){
            buscarProductos(termino);
        } else {
            $('#productos-busqueda-lista').empty();
        }
    });
});

// 1. Buscar productos
function buscarProductos(termino) {
    $.ajax({
        url: `/productos/buscar?termino=${termino}`,
        method: 'GET',
        success: function(response){
            let tbody = $('#productos-busqueda-lista');
            tbody.empty();
            response.forEach((producto)=>{
                let row = `
                <tr>
                    <td>${producto.id}</td>
                    <td>${producto.nombre}</td>
                    <td>${producto.stock}</td>
                    <td><button class="btn btn-primary" onclick="agregarALista(${producto.id}, '${producto.nombre}', ${producto.stock}, ${producto.precio})">Agregar</button></td>
                </tr>
                `;
                tbody.append(row);
            });
        },
        error: function(err){
            console.error("Error al buscar productos", err);
        }
    });
}

// 2. Agregar un producto existente a la Lista de Deseos
function agregarALista(productId, nombre, stockDisponible, precioBase, stockNecesario=1) {
    // Verifica si ya está
    let existe = itemsDeseos.find(item => item.productId === productId);
    if (existe) {
        alert("Ya está en la lista.");
        return;
    }

    let tempId = Date.now();
    itemsDeseos.push({
        tempId: tempId,
        productId: productId,
        nombre: nombre,
        stockDisponible: stockDisponible,
        stockNecesario: stockNecesario,
        precio: precioBase,
        precioTotal: precioBase * stockNecesario
    });
    renderListaDeseos();
}


// 3. Renderizar la tabla de la derecha
function renderListaDeseos(){
    let tbody = $('#lista-deseos-items');
    tbody.empty();
    let total = 0;
    itemsDeseos.forEach(item => {
        total += item.precioTotal;
        let row = `
        <tr id="item-${item.tempId}">
            <td>${item.productId ? item.productId : '-'}</td>
            <td>${item.nombre}</td>
            <td>${item.stockDisponible}</td>
            <td>
                <input type="number" class="form-control" min="1" value="${item.stockNecesario}" 
                       onchange="cambiarStockNecesario(${item.tempId}, this.value)">
            </td>
            <td>${item.precio}</td> 
            <!-- en vez de input, un simple texto -->
            <td>
                <button class="btn btn-danger" onclick="eliminarItem(${item.tempId})">Eliminar</button>
            </td>
        </tr>
        `;
        tbody.append(row);
    });
    $('#total-precio').text(total.toFixed(2));
}


// 4. Cambiar la cantidad necesitada
function cambiarStockNecesario(tempId, nuevaCant){
    let item = itemsDeseos.find(it => it.tempId === tempId);
    let cant = parseInt(nuevaCant) || 1;
    item.stockNecesario = cant;
    item.precioTotal = item.precio * cant;
    renderListaDeseos();
}

// 5. Cambiar el precio
function cambiarPrecio(tempId, nuevoPrecio){
    let item = itemsDeseos.find(it => it.tempId === tempId);
    let p = parseFloat(nuevoPrecio) || 0;
    item.precio = p;
    item.precioTotal = p * item.stockNecesario;
    renderListaDeseos();
}

// 6. Eliminar un item
function eliminarItem(tempId){
    itemsDeseos = itemsDeseos.filter(i => i.tempId !== tempId);
    renderListaDeseos();
}

// 7. Crear un Pre-Producto y agregarlo
function crearItemPreProducto() {
    let nombre = $('#nombre-preproducto').val().trim();
    if(!nombre){
        alert("El nombre del pre-producto es obligatorio.");
        return;
    }
    let precio = parseFloat($('#precio-preproducto').val()) || 0;
    let cantNecesaria = parseInt($('#stock-preproducto').val()) || 1;

    // Llamamos a /productos para crearlo en la DB
    $.ajax({
        url: '/productos',
        method: 'POST',
        contentType: 'application/json',
        data: JSON.stringify({
            nombre: nombre,
            precio: precio,
            stock: 0,            // asume sin stock real
            tipo_producto: 'PRE' // para diferenciarlo en la DB
        }),
        success: function(resp) {
            // resp.id = nuevo ID en la base
            $('#modalPreProducto').modal('hide');  // Cierra modal

            // Limpia el modal
            $('#nombre-preproducto').val('');
            $('#precio-preproducto').val('0');
            $('#stock-preproducto').val('1');

            // Ahora lo agregamos a la lista local (con ID real)
            agregarALista(resp.id, nombre, 0, precio, cantNecesaria);
        },
        error: function(err){
            console.error("Error al crear pre-producto en DB", err);
            alert("No se pudo crear el pre-producto en DB.");
        }
    });
}


// 8. Al final, “Crear Lista de Deseos”
function crearListaDeseosFinal(){
    let cliente = $('#cliente').val().trim();
    if(!cliente){
        alert("Debes ingresar el nombre del cliente/empresa.");
        return;
    }
    let ruc = $('#ruc').val().trim();
    let prioridad = $('#prioridad').val();

    if(itemsDeseos.length === 0){
        alert("No hay ningún producto en la lista de deseos.");
        return;
    }

    let dataLista = {
        cliente: cliente,
        ruc: ruc,
        prioridad: prioridad,
        items: []
    };

    itemsDeseos.forEach(it => {
        dataLista.items.push({
            producto_id: it.productId, 
            nombre_preproducto: (it.productId ? null : it.nombre),
            cantidad_necesaria: it.stockNecesario,
            precio_referencia: it.precio
        });
    });

    $.ajax({
        url: '/lista_deseos/crear_con_items',
        method: 'POST',
        contentType: 'application/json',
        data: JSON.stringify(dataLista),
        success: function(resp){
            alert(resp.mensaje);
            // Limpia
            $('#form-datos-lista')[0].reset();
            itemsDeseos = [];
            renderListaDeseos();
        },
        error: function(err){
            console.error("Error al crear la lista de deseos", err);
            alert("Ocurrió un error al crear la lista de deseos.");
        }
    });
}

