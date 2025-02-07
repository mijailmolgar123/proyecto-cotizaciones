$(document).ready(function() {
    cargarProductos();

    $('#buscar-producto').on('input', function() {
        const termino = $(this).val().toLowerCase();
        if (termino === "") {
            cargarProductos(); // Si no hay término, carga todos los productos activos
        } else {
            $.ajax({
                url: `/productos/buscar?termino=${termino}`,
                method: 'GET',
                success: function (response) {
                    console.log("Respuesta de búsqueda:", response);
                    let productosActivos = response.filter(producto => producto.activo === true); // Filtrar solo los activos
                    let tbody = $('#productos-lista');
                    tbody.empty();
                    if (productosActivos.length > 0) {
                        productosActivos.forEach(function(producto) {
                            let row = `
                                <tr>
                                    <td>${producto.id}</td>
                                    <td>${producto.nombre}</td>
                                    <td>${producto.descripcion}</td>
                                    <td>${producto.precio}</td>
                                    <td>${producto.stock}</td>
                                    <td>${producto.proveedor}</td>
                                    <td>${producto.sucursal}</td>
                                    <td>${producto.almacen}</td>
                                    <td>${producto.codigo_item}</td>
                                    <td>${producto.codigo_barra}</td>
                                    <td>${producto.unidad}</td>
                                    <td>
                                        <button class="btn btn-warning" onclick="mostrarFormularioEditar(${producto.id})">Editar</button>
                                        <button class="btn btn-danger" onclick="eliminarProducto(${producto.id})">Eliminar</button>
                                    </td>
                                </tr>
                            `;
                            tbody.append(row);
                        });
                    } else {
                        tbody.append(`<tr><td colspan="12">No se encontraron productos.</td></tr>`);
                    }
                }
            });
        }
    });
});


function navigateTo(role) {
    window.location.href = `/${role}_dashboard`;
}

function filtrarProductos(terminoBusqueda) {
    $.ajax({
        url: '/productos',
        method: 'GET',
        success: function(response) {
            let productosActivos = response.filter(producto => producto.activo === true);
            let productosFiltrados = productosActivos.filter(function(producto) {
                return producto.nombre.toLowerCase().includes(terminoBusqueda) ||
                       producto.codigo_item.toLowerCase().includes(terminoBusqueda);
            });
            mostrarProductos(productosFiltrados);
        }
    });
}


function mostrarProductos(productos) {
    let tbody = $('#productos-lista');
    tbody.empty();
    if (productos.length === 0) {
        $('#mensaje').text('No se encontraron productos que coincidan con el término de búsqueda.');
    } else {
        $('#mensaje').text('');
        productos.forEach(function(producto) {
            let row = `
                <tr>
                    <td>${producto.id}</td>
                    <td>${producto.nombre}</td>
                    <td>${producto.descripcion}</td>
                    <td>${producto.precio}</td>
                    <td>${producto.stock}</td>
                    <td>${producto.proveedor}</td>
                    <td>${producto.sucursal}</td>
                    <td>${producto.almacen}</td>
                    <td>${producto.codigo_item}</td>
                    <td>${producto.codigo_barra}</td>
                    <td>${producto.unidad}</td>
                    <td>${producto.creado_por}</td> <!-- Añadir esta línea -->
                    <td>
                        <button class="btn btn-warning" onclick="mostrarFormularioEditar(${producto.id})">Editar</button>
                        <button class="btn btn-danger" onclick="eliminarProducto(${producto.id})">Eliminar</button>
                    </td>
                </tr>
            `;
            tbody.append(row);
        });
    }
}

function cargarProductos() {
    $.ajax({
        url: '/productos',
        method: 'GET',
        success: function(response) {
            let productosActivos = response.filter(p => p.activo === true);
            mostrarProductos(productosActivos);
        }
    });
}


function mostrarFormularioAgregar() {
    let form = `
        <form id="form-agregar-producto">
            <div class="form-group">
                <label for="nombre">Nombre:</label>
                <input type="text" class="form-control" id="nombre" required>
            </div>
            <div class="form-group">
                <label for="descripcion">Descripción:</label>
                <input type="text" class="form-control" id="descripcion" required>
            </div>
            <div class="form-group">
                <label for="precio">Precio:</label>
                <input type="number" class="form-control" id="precio" required>
            </div>
            <div class="form-group">
                <label for="stock">Stock:</label>
                <input type="number" class="form-control" id="stock" required>
            </div>
            <div class="form-group">
                <label for="proveedor">Proveedor:</label>
                <input type="text" class="form-control" id="proveedor" required>
            </div>
            <div class="form-group">
                <label for="sucursal">Sucursal:</label>
                <input type="text" class="form-control" id="sucursal" required>
            </div>
            <div class="form-group">
                <label for="almacen">Almacén:</label>
                <input type="text" class="form-control" id="almacen" required>
            </div>
            <div class="form-group">
                <label for="codigo_item">Código Item:</label>
                <input type="text" class="form-control" id="codigo_item" required>
            </div>
            <div class="form-group">
                <label for="codigo_barra">Código Barra:</label>
                <input type="text" class="form-control" id="codigo_barra" required>
            </div>
            <div class="form-group">
                <label for="unidad">Unidad:</label>
                <input type="text" class="form-control" id="unidad" required>
            </div>
            <button type="submit" class="btn btn-primary">Agregar</button>
        </form>
    `;
    $('#formulario').html(form);

    $('#form-agregar-producto').on('submit', function(event) {
        event.preventDefault();
        agregarProducto();
    });
}

function agregarProducto() {
    let producto = {
        nombre: $('#nombre').val(),
        descripcion: $('#descripcion').val(),
        precio: $('#precio').val(),
        stock: $('#stock').val(),
        proveedor: $('#proveedor').val(),
        sucursal: $('#sucursal').val(),
        almacen: $('#almacen').val(),
        codigo_item: $('#codigo_item').val(),
        codigo_barra: $('#codigo_barra').val(),
        unidad: $('#unidad').val()
    };

    $.ajax({
        url: '/productos',
        method: 'POST',
        contentType: 'application/json',
        data: JSON.stringify(producto),
        success: function(response) {
            alert(response.mensaje);
            cargarProductos();
            $('#formulario').html('');
        }
    });
}

function eliminarProducto(id) {
    if (confirm('¿Estás seguro de que deseas eliminar este producto?')) {
        $.ajax({
            url: `/productos/${id}`,
            method: 'DELETE',
            success: function(response) {
                alert(response.mensaje);
                cargarProductos();
            }
        });
    }
}

function mostrarFormularioAgregar() {
    let form = `
        <div class="card p-3">
            <form id="form-agregar-producto">
                <div class="form-group">
                    <label for="nombre">Nombre:</label>
                    <input type="text" class="form-control" id="nombre" required>
                </div>
                <div class="form-group">
                    <label for="descripcion">Descripción:</label>
                    <input type="text" class="form-control" id="descripcion" required>
                </div>
                <div class="form-group">
                    <label for="precio">Precio:</label>
                    <input type="number" class="form-control" id="precio" required>
                </div>
                <div class="form-group">
                    <label for="stock">Stock:</label>
                    <input type="number" class="form-control" id="stock" required>
                </div>
                <div class="form-group">
                    <label for="proveedor">Proveedor:</label>
                    <input type="text" class="form-control" id="proveedor" required>
                </div>
                <div class="form-group">
                    <label for="sucursal">Sucursal:</label>
                    <input type="text" class="form-control" id="sucursal" required>
                </div>
                <div class="form-group">
                    <label for="almacen">Almacén:</label>
                    <input type="text" class="form-control" id="almacen" required>
                </div>
                <div class="form-group">
                    <label for="codigo_item">Código Item:</label>
                    <input type="text" class="form-control" id="codigo_item" required>
                </div>
                <div class="form-group">
                    <label for="codigo_barra">Código Barra:</label>
                    <input type="text" class="form-control" id="codigo_barra" required>
                </div>
                <div class="form-group">
                    <label for="unidad">Unidad:</label>
                    <input type="text" class="form-control" id="unidad" required>
                </div>
                <div class="d-flex justify-content-between mt-3">
                    <button type="submit" class="btn btn-primary">Agregar</button>
                    <button type="button" class="btn btn-secondary" onclick="cerrarFormularioAgregar()">Cancelar</button>
                </div>
            </form>
        </div>
    `;
    $('#formulario').html(form);

    $('#form-agregar-producto').on('submit', function(event) {
        event.preventDefault();
        agregarProducto();
    });
}

function cerrarFormularioAgregar() {
    $('#formulario').html(""); // Limpia el formulario y lo oculta
}


function editarProducto(id) {
    let producto = {
        nombre: $('#nombre').val(),
        descripcion: $('#descripcion').val(),
        precio: $('#precio').val(),
        stock: $('#stock').val(),
        proveedor: $('#proveedor').val(),
        sucursal: $('#sucursal').val(),
        almacen: $('#almacen').val(),
        codigo_item: $('#codigo_item').val(),
        codigo_barra: $('#codigo_barra').val(),
        unidad: $('#unidad').val()
    };

    $.ajax({
        url: `/productos/${id}`,
        method: 'PUT',
        contentType: 'application/json',
        data: JSON.stringify(producto),
        success: function(response) {
            alert('Producto actualizado con éxito'); // Notificación opcional
            cerrarFormularioEdicion(); // Cierra el formulario de edición
            cargarProductos(); // Recarga la lista de productos
        },
        error: function(error) {
            alert('Error al actualizar el producto');
            console.error('Error:', error);
        }
    });
}

function eliminarProducto(id) {
    if (confirm('¿Estás seguro de que deseas eliminar este producto?')) {
        $.ajax({
            url: `/productos/${id}`,
            method: 'DELETE',
            success: function(response) {
                alert(response.mensaje);
                cargarProductos();
            }
        });
    }
}
