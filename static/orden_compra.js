let cotizacionesPendientes = [];
let productosSeleccionados = [];  // items de la cotización actual
let currentCotizacionId = null;
let cotizacionesOriginales = [];

document.addEventListener('DOMContentLoaded', function () {
    cargarCotizacionesPendientes();

    // Manejar el submit del form modal
    document.getElementById('form-orden-compra').addEventListener('submit', function (e) {
        e.preventDefault();
        crearOrdenCompra();
    });
    document.getElementById('buscar-producto').addEventListener('input', function () {
        let termino = this.value.trim();
        buscarCotizacionesPorProducto(termino);
    });

});

function cargarCotizacionesPendientes() {
    $.ajax({
        url: '/cotizaciones_compra_pendientes',
        method: 'GET',
        success: function (response) {
            cotizacionesOriginales = response;  // backup sin filtro
            cotizacionesPendientes = [...response]; // copia filtrable
            renderCotizacionesPendientes();
        },
        error: function (err) {
            console.error("Error al cargar cotizaciones pendientes", err);
        }
    });
}

function renderCotizacionesPendientes() {
    let tbody = $('#cotizaciones-lista');
    tbody.empty();

    cotizacionesPendientes.forEach(ct => {
        // Sub-lista (ya la tienes) ...
        let productsHTML = '';
        if (ct.productos && ct.productos.length > 0) {
            ct.productos.forEach(prod => {
                productsHTML += `
                    <li>
                        <strong>${prod.nombre_producto}</strong> — 
                        Precio: ${prod.precio_ofrecido}, Cant: ${prod.cantidad}
                    </li>
                `;
            });
        } else {
            productsHTML = `<li>No hay productos que coincidan en esta cotización.</li>`;
        }

        // Fila principal
        let rowPrincipal = `
        <tr>
            <td>${ct.cotizacion_id}</td>
            <td>
                ${ct.proveedor}<br>
                <small><strong>Pago:</strong> ${ct.forma_pago || '-'}</small><br>
                <small><strong>Entrega:</strong> ${ct.plazo_entrega_dias || '-'} días</small>
            </td>
            <td>${ct.estado}</td>
            <td>
                <button class="btn btn-info" onclick="verDetalleCotizacion(${ct.cotizacion_id})">Ver Detalle</button>
                <button class="btn btn-danger ml-2" onclick="rechazarCotizacionCompra(${ct.cotizacion_id})">Rechazar</button>
            </td>
        </tr>
        `;

        let rowProductos = `
        <tr style="background-color: #f9f9f9;">
            <td colspan="4">
                <ul style="list-style-type: disc; margin-left: 25px;">
                    ${productsHTML}
                </ul>
            </td>
        </tr>
        `;

        tbody.append(rowPrincipal);
        tbody.append(rowProductos);
    });
}


// A simple toggler:
function toggleDetalle(btn) {
    let tr = $(btn).closest('tr');
    let detailRow = tr.next('.detalle');
    detailRow.toggleClass('hidden');
}


function verDetalleCotizacion(cotId) {
    // Buscar la cotizacion
    let coti = cotizacionesOriginales.find(x => x.cotizacion_id === cotId);
    if (!coti) {
        alert("Cotización no encontrada.");
        return;
    }
    currentCotizacionId = coti.cotizacion_id;

    let tbody = $('#productos-cotizacion-lista');
    tbody.empty();
    coti.productos.forEach(prod => {
        // Mantén un "checkbox" o un "Agregar" si quieres permitir parcial
        // o para simplificar, siempre tomamos su precio/cantidad
        let row = `
        <tr>
            <td>${prod.nombre_producto || 'Producto sin nombre'}</td>
            <td>${prod.precio_ofrecido}</td>
            <td>${prod.cantidad}</td>
            <td>
                <input type="checkbox" class="sel-prod" data-id="${prod.id_detalle}" checked>
            </td>
        </tr>
        `;
        tbody.append(row);
    });
}

function mostrarModalOrdenCompra() {
    if (!currentCotizacionId) {
        alert("Primero seleccione una cotización de compra.");
        return;
    }
    $('#cotizacion_compra_id').val(currentCotizacionId);
    $('#numero_orden').val("");
    $('#fecha_orden').val("");
    $('#observaciones').val("");
    $('#modalOrdenCompra').modal('show');
}

function crearOrdenCompra() {
    const cotId = $('#cotizacion_compra_id').val();
    const numeroOrden = $('#numero_orden').val().trim();
    const fechaOrden = $('#fecha_orden').val();
    const obs = $('#observaciones').val().trim();

    if (!numeroOrden) {
        return alert("Debe ingresar el número de orden.");
    }
    if (!fechaOrden) {
        return alert("Debe ingresar la fecha de orden.");
    }

    // Recoger productos seleccionados
    const seleccion = [];
    $('#productos-cotizacion-lista tr').each(function () {
        const chk = $(this).find('.sel-prod');
        if (chk.length && chk.is(':checked')) {
            seleccion.push({ id_detalle: chk.data('id') });
        }
    });

    if (seleccion.length === 0) {
        return alert("No se seleccionó ningún producto para la orden.");
    }

    const dataOrden = {
        cotizacion_compra_id: parseInt(cotId, 10),
        numero_orden: numeroOrden,
        fecha_orden: fechaOrden,
        observaciones: obs,
        productos: seleccion
    };

    $.ajax({
        url: '/orden_compra/crear_desde_cotizacion',
        method: 'POST',
        contentType: 'application/json',
        data: JSON.stringify(dataOrden),
        success: function (resp) {
            alert(resp.mensaje);
            // 1) cerramos modal
            $('#modalOrdenCompra').modal('hide');
            // 2) quitamos la cotización de la lista pendiente y recargamos
            cotizacionesPendientes = cotizacionesPendientes
                .filter(x => x.cotizacion_id != cotId);
            cargarCotizacionesPendientes();
            // 3) limpiamos el área derecha
            $('#productos-cotizacion-lista').empty();
            currentCotizacionId = null;
        },
        error: function (err) {
            console.error("Error al crear la Orden de Compra", err);
            alert(err.responseJSON?.error || "Error al crear la Orden de Compra.");
        }
    });
}


function buscarCotizacionesPorProducto(termino) {
    if (!termino) {
        // Si está vacío, muestra todo desde el backup
        cotizacionesPendientes = [...cotizacionesOriginales];
        renderCotizacionesPendientes();
        return;
    }

    // Filtro en frontend
    let resultado = [];

    cotizacionesOriginales.forEach(cot => {
        let productosFiltrados = cot.productos.filter(prod =>
            prod.nombre_producto.toLowerCase().includes(termino.toLowerCase())
        );

        if (productosFiltrados.length > 0) {
            resultado.push({
                ...cot,
                productos: productosFiltrados
            });
        }
    });

    cotizacionesPendientes = resultado;
    renderCotizacionesPendientes();
}

function rechazarCotizacionCompra(cotId) {
    if (!confirm("¿Estás seguro de rechazar esta cotización de compra?")) {
        return;
    }
    $.ajax({
        url: `/cotizacion_compra/rechazar/${cotId}`,
        method: 'POST',
        success: function (resp) {
            alert(resp.mensaje);
            // Remover la cotización rechazada de cotizacionesPendientes:
            cotizacionesPendientes = cotizacionesPendientes.filter(x => x.cotizacion_id != cotId);
            renderCotizacionesPendientes();
        },
        error: function (err) {
            console.error("Error al rechazar la cotización de compra:", err);
            alert("Hubo un error al rechazar la cotización.");
        }
    });
}
