$(document).ready(function () {
    const columnasVisibles = ['id', 'nombre', 'precio', 'stock', 'proveedor', 'codigo_item', 'unidad'];
    let paginaActual = 1;
    const productosPorPagina = 20;
    let terminoBusqueda = '';
    let totalPaginas = 1;
    const tbody = $('#productos-lista');
    let xhrEnCurso = null; 

    // Cargar página
    function cargarPagina(page) {
        // 1. Si ya hay una petición activa la cancelamos
        if (xhrEnCurso && xhrEnCurso.readyState !== 4) {
            xhrEnCurso.abort();
        }

        $('#btn-ver-mas').prop('disabled', true).text('Cargando…');

        xhrEnCurso = $.ajax({
            url: '/productos',
            method: 'GET',
            data: {
                page: page,
                per_page: productosPorPagina,
                termino: terminoBusqueda
            },
            success: function (response) {
                response.productos.forEach(producto => {
                    let row = '<tr>';
                    columnasVisibles.forEach(columna => {
                        row += `<td>${producto[columna]}</td>`;
                    });
                    row += `
                        <td>
                            <button class="btn btn-warning" onclick="mostrarFormularioEditar(${producto.id})">Editar</button>
                            <button class="btn btn-danger" onclick="eliminarProducto(${producto.id})">Eliminar</button>
                        </td>
                    </tr>`;
                    tbody.append(row);
                });

                paginaActual = response.pagina_actual;
                totalPaginas = response.paginas;

                if (paginaActual >= totalPaginas) {
                    $('#btn-ver-mas').hide();
                    $('#mensaje-fin').show();
                } else {
                    $('#btn-ver-mas').show().prop('disabled', false).text('Ver más');
                    $('#mensaje-fin').hide();
                }
            },
            error: function (xhr, status) {
                if (status !== 'abort') {     // ignorar los aborts controlados
                    alert('Error al cargar productos');
                }
            },
            complete: function () {
                xhrEnCurso = null;            // liberamos la referencia
            }
        });
    }

    // Botón Ver más
    $('#btn-ver-mas').on('click', function () {
        cargarPagina(paginaActual + 1);
    });

    // Función genérica
    function debounce(fn, delay) {
        let t;
        return function(...args) {
            clearTimeout(t);
            t = setTimeout(() => fn.apply(this, args), delay);
        };
    }

    // Input ≈ 300 ms después de dejar de teclear
    $('#buscar-producto').on('input', debounce(function () {
        terminoBusqueda = $(this).val().trim();
        paginaActual = 1;
        totalPaginas = 1;
        tbody.empty();
        $('#mensaje-fin').hide();
        $('#btn-ver-mas').show();
        cargarPagina(1);
    }, 300));

    // Carga inicial
    cargarPagina(1);
});

function navigateTo(role) {
    window.location.href = `/${role}_dashboard`;
}

function mostrarFormularioAgregar() {
    let form = `
        <form id="form-agregar-producto" class="formulario-alineado-izquierda">
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
            cerrarFormularioAgregar();
        },
        error: function(jqXHR, textStatus, errorThrown) {
            console.error('Error al agregar el producto:', textStatus, errorThrown);
            alert('Hubo un error al agregar el producto. Por favor, intenta nuevamente.');
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
                $(`#producto-${id}`).remove();
            },
            error: function(jqXHR, textStatus, errorThrown) {
                console.error('Error al eliminar el producto:', textStatus, errorThrown);
                alert('Hubo un error al eliminar el producto. Por favor, intenta nuevamente.');
            }
        });
    }
}

function cerrarFormularioAgregar() {
    $('#formulario').empty(); // Limpia el formulario y lo oculta
}
// Definir las columnas que se mostrarán
const columnasVisibles = ['id', 'nombre', 'precio', 'stock', 'proveedor', 'codigo_item', 'unidad'];
const productosPorPagina = 20;

    // Función para mostrar el formulario de edición
function mostrarFormularioEditar(id) {
    // Realizar una solicitud AJAX para obtener los datos del producto
    $.ajax({
        url: `/productos/${id}`,
        method: 'GET',
        success: function(producto) {
            // Generar el formulario de edición con los datos del producto
            let form = `
                <div class="card p-3">
                    <form id="form-editar-producto">
                        <div class="form-group">
                            <label for="nombre">Nombre:</label>
                            <input type="text" class="form-control" id="nombre" value="${producto.nombre}" required>
                        </div>
                        <div class="form-group">
                            <label for="descripcion">Descripción:</label>
                            <input type="text" class="form-control" id="descripcion" value="${producto.descripcion}" required>
                        </div>
                        <div class="form-group">
                            <label for="precio">Precio:</label>
                            <input type="number" class="form-control" id="precio" value="${producto.precio}" required>
                        </div>
                        <div class="form-group">
                            <label for="stock">Stock:</label>
                            <input type="number" class="form-control" id="stock" value="${producto.stock}" required>
                        </div>
                        <div class="form-group">
                            <label for="proveedor">Proveedor:</label>
                            <input type="text" class="form-control" id="proveedor" value="${producto.proveedor}" required>
                        </div>
                        <div class="form-group">
                            <label for="sucursal">Sucursal:</label>
                            <input type="text" class="form-control" id="sucursal" value="${producto.sucursal}" required>
                        </div>
                        <div class="form-group">
                            <label for="almacen">Almacén:</label>
                            <input type="text" class="form-control" id="almacen" value="${producto.almacen}" required>
                        </div>
                        <div class="form-group">
                            <label for="codigo_item">Código Item:</label>
                            <input type="text" class="form-control" id="codigo_item" value="${producto.codigo_item}" required>
                        </div>
                        <div class="form-group">
                            <label for="codigo_barra">Código Barra:</label>
                            <input type="text" class="form-control" id="codigo_barra" value="${producto.codigo_barra}" required>
                        </div>
                        <div class="form-group">
                            <label for="unidad">Unidad:</label>
                            <input type="text" class="form-control" id="unidad" value="${producto.unidad}" required>
                        </div>
                        <div class="d-flex justify-content-between mt-3">
                            <button type="submit" class="btn btn-primary">Guardar Cambios</button>
                            <button type="button" class="btn btn-secondary" onclick="cerrarFormularioEdicion()">Cancelar</button>
                        </div>
                    </form>
                </div>
            `;
            // Insertar el formulario en el contenedor correspondiente
            $('#formulario-editar-container').html(form);

            // Manejar el envío del formulario de edición
            $('#form-editar-producto').on('submit', function(event) {
                event.preventDefault();
                editarProducto(id);
            });
        },
        error: function(jqXHR, textStatus, errorThrown) {
            console.error('Error al obtener los datos del producto:', textStatus, errorThrown);
            alert('Hubo un error al obtener los datos del producto. Por favor, intenta nuevamente.');
        }
    });
}

// Función para cerrar el formulario de edición
function cerrarFormularioEdicion() {
    $('#formulario-editar-container').html(""); // Limpia el formulario y lo oculta
}

// Función para enviar los datos actualizados del producto
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
            alert('Producto actualizado con éxito');
            cerrarFormularioEdicion();
            cargarProductos();
        },
        error: function(jqXHR, textStatus, errorThrown) {
            console.error('Error al actualizar el producto:', textStatus, errorThrown);
            alert('Hubo un error al actualizar el producto. Por favor, intenta nuevamente.');
        }
    });
}