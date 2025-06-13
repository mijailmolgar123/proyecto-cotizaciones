let itemsDeseos = []; 
// Estructura: [{tempId: 1, productId: 3, nombre: "xxx", stockDisponible: 37, stockNecesario: 1, precio: 0, precioTotal: 0}, ...]
let currentPage   = 0;
const pageSize    = 20;
let currentTerm   = '';

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
function buscarProductos(termino, page = 0) {
  currentTerm = termino;
  $.ajax({
    url: '/productos',          // usa tu endpoint real
    method: 'GET',
    data: {
      termino: termino,
      page:    page,
      per_page: pageSize
    },
    success: function(res) {
      // si tu API devuelve { productos: [...] } ajústalo aquí:
      const productos = res.productos || res;

      // al buscador de la primera página limpiamos antes
      if (page === 0) {
        $('#productos-busqueda-lista').empty();
      }

      productos.forEach(prod => {
        $('#productos-busqueda-lista').append(`
          <tr>
            <td>${prod.id}</td>
            <td>${prod.nombre}</td>
            <td>${prod.stock}</td>
            <td>${parseFloat(prod.precio).toFixed(2)}</td>
            <td>
              <button class="btn btn-primary btn-sm"
                      onclick="agregarALista(
                        ${prod.id},
                        '${prod.nombre.replace(/'/g,"\\'")}',
                        ${prod.stock},
                        ${prod.precio}
                      )">
                Agregar
              </button>
            </td>
          </tr>
        `);
      });

      // muestro/oculto “Ver más” según haya suficiente resultado
      if (productos.length === pageSize) {
        $('#btn-ver-mas-productos').show();
      } else {
        $('#btn-ver-mas-productos').hide();
      }
    },
    error: function(err) {
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
        precio: precioBase.toFixed(2),
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

function crearListaDeseosFinal(){
  const clienteId = $('#cliente-id').val().trim();
  if (!clienteId) {
    alert("Debes seleccionar un cliente válido.");
    return;
  }

  const prioridad = $('#prioridad').val();  // <-- capturamos prioridad

  if (itemsDeseos.length === 0) {
    alert("No hay ningún producto en la lista de deseos.");
    return;
  }

  const dataLista = {
    cliente_id: clienteId,
    prioridad:  prioridad,           // <-- enviamos prioridad
    comentario: $('#comentario').val() || "",
    items: itemsDeseos.map(it => ({
      producto_id:        it.productId,
      nombre_preproducto: it.productId ? null : it.nombre,
      cantidad_necesaria: it.stockNecesario,
      precio_referencia:  it.precio
    }))
  };

  $.ajax({
    url: '/lista_deseos/crear_con_items',
    method: 'POST',
    contentType: 'application/json',
    data: JSON.stringify(dataLista),
    success(resp){
      alert(resp.mensaje);
      // resetear todo…
    },
    error(err){
      console.error("Error al crear lista de deseos", err);
      alert("Ocurrió un error al crear la lista de deseos.");
    }
  });
}

$(function(){
  // ── Autocomplete de Cliente ──
  $("#cliente-busqueda").autocomplete({
    minLength: 2,
    delay: 300,
    source(request, response) {
      $.getJSON("/clientes", { term: request.term }, function(data){
        response(data.map(c => ({
          label: `${c.nombre} — ${c.ruc}`,
          value: c.nombre,
          id:    c.id
        })));
      });
    },
    select(event, ui) {
      // Rellenar el input y el hidden, desactivar búsqueda
      $("#cliente-busqueda")
        .val(ui.item.label)
        .prop("disabled", true);
      $("#cliente-id").val(ui.item.id);
      $("#btn-cambiar-cliente").show();
      return false;
    }
  });

  // ── Botón “Cambiar Cliente” ──
  $("#btn-cambiar-cliente").click(function(){
    $("#cliente-busqueda")
      .prop("disabled", false)
      .val("")
      .focus();
    $("#cliente-id").val("");
    $(this).hide();
  });
});

// ── Crear Cliente Nuevo ──
$('#form-crear-cliente').submit(function(e){
  e.preventDefault();
  const nombre = $('#nuevo-cliente-nombre').val().trim();
  const ruc    = $('#nuevo-cliente-ruc').val().trim();
  if(!nombre || !ruc){
    alert('Completa ambos campos.');
    return;
  }
  $.ajax({
    url: '/clientes',        // tu endpoint para crear cliente
    method: 'POST',
    contentType: 'application/json',
    data: JSON.stringify({ nombre, ruc }),
    success: function(c){
      // c.id, c.nombre, c.ruc
      const label = `${c.nombre} — ${c.ruc}`;
      $('#cliente-busqueda').val(label).prop('disabled', true);
      $('#cliente-id').val(c.id);
      $('#btn-cambiar-cliente').show();
      $('#modalCrearCliente').modal('hide');
      // limpia el modal
      $('#nuevo-cliente-nombre, #nuevo-cliente-ruc').val('');
    },
    error: function(err){
      console.error('No se pudo crear cliente', err);
      alert('Error al crear cliente.');
    }
  });
});

// Al tipear en el input
$('#buscar-producto').on('input', function(){
  const termino = $(this).val().trim();
  currentPage = 0;
  if (termino) {
    buscarProductos(termino, 0);
  } else {
    $('#productos-busqueda-lista').empty();
    $('#btn-ver-mas-productos').hide();
  }
});

// Al pulsar “Ver más…”
$('#btn-ver-mas-productos').on('click', function(){
  currentPage++;
  buscarProductos(currentTerm, currentPage);
});

// Carga inicial: muestro los primeros 20 sin filtro
$(function(){
  buscarProductos('', 0);
});
