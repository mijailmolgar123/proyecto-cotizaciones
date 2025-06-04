$(document).ready(function () {
    const columnasVisibles = ['id', 'nombre', 'precio', 'stock', 'proveedor', 'codigo_item', 'unidad'];
    let paginaActual = 1;
    const productosPorPagina = 20;
    let terminoBusqueda = '';
    let totalPaginas = 1;
    let xhrEnCurso = null; 


    // Cargar página
    window.cargarPagina = function(page){
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
                if (page === 1) {            // si estamos “reiniciando” la lista
                    tbody.empty();           // limpiamos solo una vez
                }
            
                response.productos.forEach(producto => {
                    let row = '<tr>';
                    columnasVisibles.forEach(columna => {
                        let valor = producto[columna];

                        // Si estamos en la columna “precio”, forzamos dos decimales:
                        if (columna === 'precio') {
                            // Asegurar que sea número; si viene como string, convertirlo
                            let num = parseFloat(producto.precio);
                            // Si no es un número válido, dejamos “0.00”
                            if (isNaN(num)) {
                                valor = '0.00';
                            } else {
                                valor = num.toFixed(2);
                            }
                        }

                        row += `<td>${valor}</td>`;
                    });
                    row += `
                        <td>
                            <button class="btn btn-warning" onclick="mostrarFormularioEditar(${producto.id})">
                                Editar
                            </button>
                            <button class="btn btn-danger" onclick="eliminarProducto(${producto.id})">
                                Eliminar
                            </button>
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
        window.cargarPagina(paginaActual + 1);
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
        window.cargarPagina(1);
    }, 300));

    // Carga inicial
    window.cargarPagina(1);
});

const tbody = $('#productos-lista');

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
            alert(response.mensaje);  // primero mostramos alerta
            setTimeout(() => {
                cerrarFormularioAgregar();     // luego limpiamos el formulario
                resetearYCargarPrimeraPagina(); // y recargamos la lista
            }, 100);  // 100 ms para dar margen a la animación si fuera necesario
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

    // Función para mostrar el formulario de edición
function mostrarFormularioEditar(id) {
  $.ajax({
    url: `/productos/${id}`,
    method: 'GET',
    success: function(producto) {
      // 1) Formatear el precio con dos decimales
      let numPrecio = parseFloat(producto.precio);
      if (isNaN(numPrecio)) {
        numPrecio = 0;
      }
      let precioFormateado = numPrecio.toFixed(2);

      // 2) Construir el HTML del formulario con todos los campos
      //    Importante: el <form> debe tener id="form-editar-producto"
      let formHtml = `
        <form id="form-editar-producto">
          <!-- Nombre -->
          <div class="form-group">
            <label for="nombre">Nombre:</label>
            <input
              type="text"
              class="form-control"
              id="nombre"
              name="nombre"
              value="${producto.nombre}"
              required
            >
          </div>

          <!-- Descripción -->
          <div class="form-group">
            <label for="descripcion">Descripción:</label>
            <input
              type="text"
              class="form-control"
              id="descripcion"
              name="descripcion"
              value="${producto.descripcion || ''}"
            >
          </div>

          <!-- Precio -->
          <div class="form-group">
            <label for="precio">Precio:</label>
            <input
              type="number"
              class="form-control"
              id="precio"
              name="precio"
              value="${precioFormateado}"
              step="0.01"
              required
            >
          </div>

          <!-- Stock -->
          <div class="form-group">
            <label for="stock">Stock:</label>
            <input
              type="number"
              class="form-control"
              id="stock"
              name="stock"
              value="${producto.stock}"
              min="0"
              required
            >
          </div>

          <!-- Proveedor -->
          <div class="form-group">
            <label for="proveedor">Proveedor:</label>
            <input
              type="text"
              class="form-control"
              id="proveedor"
              name="proveedor"
              value="${producto.proveedor || ''}"
            >
          </div>

          <!-- Sucursal -->
          <div class="form-group">
            <label for="sucursal">Sucursal:</label>
            <input
              type="text"
              class="form-control"
              id="sucursal"
              name="sucursal"
              value="${producto.sucursal || ''}"
            >
          </div>

          <!-- Almacén -->
          <div class="form-group">
            <label for="almacen">Almacén:</label>
            <input
              type="text"
              class="form-control"
              id="almacen"
              name="almacen"
              value="${producto.almacen || ''}"
            >
          </div>

          <!-- Código Item -->
          <div class="form-group">
            <label for="codigo_item">Código Item:</label>
            <input
              type="text"
              class="form-control"
              id="codigo_item"
              name="codigo_item"
              value="${producto.codigo_item || ''}"
            >
          </div>

          <!-- Código Barra -->
          <div class="form-group">
            <label for="codigo_barra">Código Barra:</label>
            <input
              type="text"
              class="form-control"
              id="codigo_barra"
              name="codigo_barra"
              value="${producto.codigo_barra || ''}"
            >
          </div>

          <!-- Unidad -->
          <div class="form-group">
            <label for="unidad">Unidad:</label>
            <input
              type="text"
              class="form-control"
              id="unidad"
              name="unidad"
              value="${producto.unidad || ''}"
              required
            >
          </div>

          <!-- Agrega aquí más campos si tu modelo los tiene -->
        </form>`;

      // 3) Inyectar el formulario dentro del contenedor del modal
      $('#modal-editar-form-container').html(formHtml);

      // 4) Asociar el listener al evento submit del formulario
      $('#form-editar-producto').on('submit', function(event) {
        event.preventDefault();
        editarProducto(id);
      });

      // 5) Mostrar el modal de Bootstrap
      $('#editarProductoModal').modal('show');
    },
    error: function() {
      alert('Error al obtener los datos del producto.');
    }
  });
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
            $('#editarProductoModal').modal('hide');
            setTimeout(() => {
                resetearYCargarPrimeraPagina();
            }, 100);
        },        
        error: function(jqXHR, textStatus, errorThrown) {
            console.error('Error al actualizar el producto:', textStatus, errorThrown);
            alert('Hubo un error al actualizar el producto. Por favor, intenta nuevamente.');
        }
    });
}