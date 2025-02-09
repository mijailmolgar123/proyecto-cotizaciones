from flask import Flask, request, jsonify, render_template, redirect, url_for, flash
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
from flask_migrate import Migrate
from sqlalchemy.orm import Session
from werkzeug.security import generate_password_hash, check_password_hash
from flask_login import LoginManager, UserMixin, login_user, logout_user, current_user, login_required
import os
from flask import request, jsonify

app = Flask(__name__)

def create_app():

    # Obtener la ruta absoluta del directorio actual

    basedir = os.path.abspath(os.path.dirname(__file__))


    # Asegúrate de que la carpeta 'instance' exista
    if not os.path.exists(os.path.join(basedir, 'instance')):
        os.makedirs(os.path.join(basedir, 'instance'))

    # Configuración de la base de datos
    app.config['SQLALCHEMY_DATABASE_URI'] = 'postgresql+psycopg2://postgres:mijail28@localhost/proyecto_cotizaciones'
    app.config['SQLALCHEMY_ENGINE_OPTIONS'] = {}

    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    app.config['SECRET_KEY'] = 'clave-secreta-aqui'  # Es necesario para usar Flask-Login

    # Inicializa SQLAlchemy con la aplicación
    db.init_app(app)

    return app

db = SQLAlchemy()
migrate = Migrate(app, db)

login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'login'

app = create_app()

class Usuario(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    nombre_usuario = db.Column(db.String(50), unique=True, nullable=False)
    contraseña_hash = db.Column(db.String(256), nullable=False)
    rol = db.Column(db.String(20), nullable=False)
    fecha_de_registro = db.Column(db.DateTime, default=datetime.utcnow)
    activo = db.Column(db.Boolean, default=True)

    def set_password(self, contraseña):

        self.contraseña_hash = generate_password_hash(contraseña)


    def check_password(self, contraseña):

        return check_password_hash(self.contraseña_hash, contraseña)



class Producto(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    nombre = db.Column(db.String(80), nullable=False)
    descripcion = db.Column(db.String(200), nullable=True)
    precio = db.Column(db.Float, nullable=False)
    stock = db.Column(db.Integer, nullable=False)
    proveedor = db.Column(db.String(80), nullable=True)
    sucursal = db.Column(db.String(80), nullable=True)
    almacen = db.Column(db.String(80), nullable=True)
    codigo_item = db.Column(db.String(80), nullable=True)
    codigo_barra = db.Column(db.String(80), nullable=True)
    unidad = db.Column(db.String(80), nullable=True)
    creado_por = db.Column(db.Integer, db.ForeignKey('usuario.id'), nullable=False)
    activo = db.Column(db.Boolean, default=True)

class Cotizacion(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    cliente = db.Column(db.String(100), nullable=False)
    solicitante = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(100), nullable=False)
    referencia = db.Column(db.String(100), nullable=False)
    ruc = db.Column(db.String(11), nullable=False)
    celular = db.Column(db.String(15))
    fecha = db.Column(db.String(10), nullable=False)
    total = db.Column(db.Float, nullable=False)
    estado = db.Column(db.String(20), nullable=False, default='Pendiente')
    creado_por = db.Column(db.Integer, db.ForeignKey('usuario.id'), nullable=False)
    productos = db.relationship('ProductoCotizacion', backref='cotizacion', lazy=True)
    activo = db.Column(db.Boolean, default=True)

class ProductoCotizacion(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    cotizacion_id = db.Column(db.Integer, db.ForeignKey('cotizacion.id'), nullable=False)
    producto_id = db.Column(db.Integer, db.ForeignKey('producto.id'), nullable=False)
    cantidad = db.Column(db.Integer, nullable=False)
    precio_unitario = db.Column(db.Float, nullable=False)
    porcentaje_ganancia = db.Column(db.Float, nullable=False)
    precio_total = db.Column(db.Float, nullable=False)
    tipo_compra = db.Column(db.String(20), nullable=False)
    activo = db.Column(db.Boolean, default=True)

class OrdenVenta(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    cliente = db.Column(db.String(100), nullable=False)
    solicitante = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(100), nullable=False)
    referencia = db.Column(db.String(100), nullable=False)
    ruc = db.Column(db.String(11), nullable=False)
    celular = db.Column(db.String(15))
    fecha = db.Column(db.String(10), nullable=False)
    total = db.Column(db.Float, nullable=False)
    estado = db.Column(db.String(20), nullable=False, default='Pendiente')
    cotizacion_id = db.Column(db.Integer, db.ForeignKey('cotizacion.id'), nullable=False)
    creado_por = db.Column(db.Integer, db.ForeignKey('usuario.id'), nullable=False)
    productos = db.relationship('ProductoOrden', backref='orden_venta', lazy=True)
    seguimiento = db.relationship('SeguimientoOrden', backref='orden_venta', lazy=True)
    guias_remision = db.relationship('GuiaRemision', backref='orden_venta', lazy=True)
    activo = db.Column(db.Boolean, default=True)

class ProductoOrden(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    orden_id = db.Column(db.Integer, db.ForeignKey('orden_venta.id'), nullable=False)
    producto_id = db.Column(db.Integer, db.ForeignKey('producto.id'), nullable=False)
    cantidad = db.Column(db.Integer, nullable=False)
    precio_unitario = db.Column(db.Float, nullable=False)
    precio_total = db.Column(db.Float, nullable=False)
    tipo_compra = db.Column(db.String(20), nullable=False)  
    estado = db.Column(db.String(20), nullable=False, default='Pendiente')  # Estado de cada producto
    seguimiento = db.relationship('SeguimientoProducto', backref='producto_orden', lazy=True)
    activo = db.Column(db.Boolean, default=True)

class SeguimientoOrden(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    orden_id = db.Column(db.Integer, db.ForeignKey('orden_venta.id'), nullable=False)
    fecha = db.Column(db.String(10), nullable=False)
    estado = db.Column(db.String(20), nullable=False)  # Ejemplo: Pendiente, Empaquetado, Recibido
    comentario = db.Column(db.String(200), nullable=True)

class SeguimientoProducto(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    producto_orden_id = db.Column(db.Integer, db.ForeignKey('producto_orden.id'), nullable=False)
    fecha = db.Column(db.String(10), nullable=False)
    estado = db.Column(db.String(20), nullable=False)  # Ejemplo: En Compra, En Tránsito, Recibido
    comentario = db.Column(db.String(200), nullable=True)

class Actividad(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    usuario_id = db.Column(db.Integer, db.ForeignKey('usuario.id'), nullable=False)
    accion = db.Column(db.String(200), nullable=False)
    fecha = db.Column(db.DateTime, default=datetime.utcnow)

class GuiaRemision(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    numero_guia = db.Column(db.String(100), nullable=False, unique=True)
    orden_venta_id = db.Column(db.Integer, db.ForeignKey('orden_venta.id'), nullable=False)  # Asociada a una orden de venta
    fecha_emision = db.Column(db.String(10), nullable=False)
    estado = db.Column(db.String(20), nullable=False, default='Pendiente')  # 
    productos = db.relationship('ProductoGuiaRemision', backref='guia_remision', lazy=True)
    activo = db.Column(db.Boolean, default=True)

class ProductoGuiaRemision(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    guia_remision_id = db.Column(db.Integer, db.ForeignKey('guia_remision.id', ondelete='CASCADE'), nullable=False)
    producto_orden_id = db.Column(db.Integer, db.ForeignKey('producto_orden.id'), nullable=False)  # Nueva relación
    cantidad = db.Column(db.Integer, nullable=False)
    estado = db.Column(db.String(20), nullable=False, default='Pendiente')
    activo = db.Column(db.Boolean, default=True)
    producto_orden = db.relationship('ProductoOrden', backref='productos_guias')


# Método para registrar una actividad
@app.route('/')
def home():
    return render_template('login.html')

@app.route('/gerente_dashboard')
def gerente_dashboard():
    return render_template('gerente_dashboard.html')

def gerente_dashboard():
    return render_template('gerente_dashboard.html')


@app.route('/edicion_productos')
def edicion_productos():
    return render_template('edicion_productos.html')

@app.route('/orden_venta')
def orden_venta():
    return render_template('orden_venta.html')

@app.route('/trabajador_dashboard')
def trabajador_dashboard():
    return render_template('trabajador_dashboard.html')

@app.route('/cliente_dashboard')
def cliente_dashboard():
    return render_template('cliente_dashboard.html')

@app.route('/cotizaciones_dashboard')
def cotizaciones_dashboard():
    return render_template('cotizaciones_dashboard.html')

@app.route('/verificacion_cotizacion')
def verificacion_cotizacion():
    return render_template('verificacion_cotizacion.html')

@app.route('/guias_remision')
def guias_remision():

    guias = GuiaRemision.query.all()

    return render_template('guias_remision.html', guias=guias)

@app.route('/productos', methods=['POST'])
def crear_producto():
    data = request.get_json()
    print(data) 
    nuevo_producto = Producto(
        nombre=data['nombre'],
        descripcion=data['descripcion'],
        precio=data['precio'],
        stock=data['stock'],
        proveedor=data['proveedor'],
        sucursal=data['sucursal'],
        almacen=data['almacen'],
        codigo_item=data['codigo_item'],
        codigo_barra=data['codigo_barra'],
        unidad=data['unidad'],
        creado_por=current_user.id
    )
    db.session.add(nuevo_producto)
    db.session.commit()
    return jsonify({'mensaje': 'Producto añadido con éxito'}), 201

@app.route('/productos', methods=['GET'])
def obtener_productos():
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 20, type=int)
    termino = request.args.get('termino', '', type=str).strip()

    query = Producto.query.filter(Producto.activo == True)

    if termino:
        query = query.filter(
            db.or_(
                Producto.nombre.ilike(f"%{termino}%"),
                Producto.codigo_item.ilike(f"%{termino}%")
            )
        )

    productos_paginados = query.order_by(Producto.id.asc()).paginate(page=page, per_page=per_page, error_out=False)

    productos_json = [
        {
            'id': p.id,
            'nombre': p.nombre,
            'descripcion': p.descripcion,
            'precio': p.precio,
            'stock': p.stock,
            'proveedor': p.proveedor,
            'sucursal': p.sucursal,
            'almacen': p.almacen,
            'codigo_item': p.codigo_item,
            'codigo_barra': p.codigo_barra,
            'unidad': p.unidad,
            'activo': p.activo
        }
        for p in productos_paginados.items
    ]

    return jsonify({
        'productos': productos_json,
        'total': productos_paginados.total,
        'paginas': productos_paginados.pages,
        'pagina_actual': productos_paginados.page
    })


@app.route('/productos/<int:id>', methods=['GET'])
def obtener_producto(id):
    producto = Producto.query.filter_by(id=id, activo=True).first()
    if producto is None:
        return jsonify({'mensaje': 'Producto no encontrado'}), 404

    return jsonify({
        'id': producto.id,
        'nombre': producto.nombre,
        'descripcion': producto.descripcion,
        'precio': producto.precio,
        'stock': producto.stock,
        'proveedor': producto.proveedor,
        'sucursal': producto.sucursal,
        'almacen': producto.almacen,
        'codigo_item': producto.codigo_item,
        'codigo_barra': producto.codigo_barra,
        'unidad': producto.unidad,
        'creado_por': producto.creado_por,
        'activo': producto.activo
    })

@app.route('/productos/<int:id>', methods=['PUT'])
def editar_producto(id):
    data = request.get_json()
    producto = db.session.get(Producto, id)
    if producto is None:
        return jsonify({'mensaje': 'Producto no encontrado'}), 404

    producto.nombre = data.get('nombre', producto.nombre)
    producto.descripcion = data.get('descripcion', producto.descripcion)
    producto.precio = data.get('precio', producto.precio)
    producto.stock = data.get('stock', producto.stock)
    producto.proveedor = data.get('proveedor', producto.proveedor)
    producto.sucursal = data.get('sucursal', producto.sucursal)
    producto.almacen = data.get('almacen', producto.almacen)
    producto.codigo_item = data.get('codigo_item', producto.codigo_item)
    producto.codigo_barra = data.get('codigo_barra', producto.codigo_barra)
    producto.unidad = data.get('unidad', producto.unidad)

    try:
        db.session.commit()
        return jsonify({'mensaje': 'Producto actualizado con éxito'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'mensaje': f'Error al guardar los cambios: {str(e)}'}), 500

@app.route('/productos/<int:id>', methods=['DELETE'])
def desactivar_producto(id):
    producto = db.session.get(Producto, id)
    if producto is None:
        return jsonify({'mensaje': 'Producto no encontrado'}), 404

    producto.activo = False
    db.session.commit()
    return jsonify({'mensaje': 'Producto desactivado con éxito'}), 200

@app.route('/productos/buscar', methods=['GET'])
def buscar_productos():
    termino = request.args.get('termino', '').strip()
    if not termino:  # Si no hay búsqueda, mostrar los primeros 20 productos ordenados por ID
        productos = Producto.query.filter(Producto.activo == True).order_by(Producto.id.asc()).limit(20).all()
    else:  # Si hay búsqueda, filtrar y limitar a 20 coincidencias
        productos = Producto.query.filter(
            Producto.activo == True,
            db.or_(
                Producto.nombre.ilike(f"%{termino}%"),
                Producto.codigo_item.ilike(f"%{termino}%")
            )
        ).order_by(Producto.id.asc()).limit(20).all()  # Filtra y ordena por ID ascendente

    productos_json = [
        {
            'id': p.id,
            'nombre': p.nombre,
            'descripcion': p.descripcion,
            'precio': p.precio,
            'stock': p.stock,
            'proveedor': p.proveedor,
            'sucursal': p.sucursal,
            'almacen': p.almacen,
            'codigo_item': p.codigo_item,
            'codigo_barra': p.codigo_barra,
            'unidad': p.unidad,
            'activo': p.activo
        }
        for p in productos
    ]
    return jsonify(productos_json)

@app.route('/guardar_cotizacion', methods=['POST'])
def guardar_cotizacion():
    datos = request.json
    # Crear una nueva cotización
    nueva_cotizacion = Cotizacion(
        cliente=datos['cliente'],
        solicitante=datos['solicitante'],
        email=datos['email'],
        referencia=datos['referencia'],
        ruc=datos['ruc'],
        celular=datos.get('celular', ''),  # Campo opcional
        fecha=datos['fecha'],
        total=datos['total'],
        creado_por=current_user.id  # Añadir quién creó la cotización
    )
    db.session.add(nueva_cotizacion)
    db.session.commit()  # Guarda la cotización para obtener su ID

    # Agregar los productos a la cotización
    for producto in datos['productos']:
        nuevo_producto_cotizacion = ProductoCotizacion(
            cotizacion_id=nueva_cotizacion.id,
            producto_id=producto['id'],
            cantidad=producto['cantidad'],
            precio_unitario=producto['precio_unitario'],
            porcentaje_ganancia=producto['ganancia'],
            precio_total=producto['precio_total'],
            tipo_compra=producto['tipo_compra']
        )
        db.session.add(nuevo_producto_cotizacion)

    db.session.commit()

    return jsonify({'mensaje': 'Cotización guardada exitosamente'}), 201

@app.route('/cotizacion/<int:id>', methods=['GET'])
def obtener_cotizacion(id):
    # Verificar si la cotización ya fue convertida a una orden de compra
    orden_venta_existente = db.session.query(OrdenVenta).filter_by(cotizacion_id=id).first()
    if orden_venta_existente:
        return jsonify({'mensaje': 'Cotización ya convertida', 'orden_venta_id': orden_venta_existente.id}), 200

    # Obtener la cotización
    cotizacion = db.session.query(Cotizacion).filter_by(id=id).first()
    if not cotizacion:
        return jsonify({'mensaje': 'Cotización no encontrada'}), 404

    # Obtener los productos de la cotización
    productos = [
        {
            'id': producto.producto_id,
            'nombre': db.session.get(Producto, producto.producto_id).nombre if db.session.get(Producto, producto.producto_id) else "Producto no encontrado",
            'precio_unitario': producto.precio_unitario,
            'cantidad': producto.cantidad,
            'precio_total': producto.precio_total
        }
        for producto in cotizacion.productos
    ]

    # Obtener el creador de la cotización
    creador = db.session.get(Usuario, cotizacion.creado_por)
    
    # Construir la respuesta
    cotizacion_data = {
        'id': cotizacion.id,
        'cliente': cotizacion.cliente,
        'ruc': cotizacion.ruc,
        'fecha': cotizacion.fecha,
        'email': cotizacion.email,
        'estado': cotizacion.estado,
        'creado_por': creador.nombre_usuario if creador else 'Desconocido',
        'productos': productos
    }

    return jsonify(cotizacion_data)

@app.route('/cotizaciones', methods=['GET'])
def obtener_todas_las_cotizaciones():
    cotizaciones = Cotizacion.query.all()
    cotizaciones_data = [
        {
            'id': cotizacion.id,
            'cliente': cotizacion.cliente,
            'ruc': cotizacion.ruc,
            'fecha': cotizacion.fecha,
            'email': cotizacion.email,
            'estado': cotizacion.estado,
            'creado_por': db.session.get(Usuario, cotizacion.creado_por).nombre_usuario if db.session.get(Usuario, cotizacion.creado_por) else 'Desconocido'
        }
        for cotizacion in cotizaciones
    ]
    return jsonify(cotizaciones_data)

@app.route('/transformar_orden_venta/<int:cotizacion_id>', methods=['POST'])
def transformar_orden_venta(cotizacion_id):
    cotizacion = db.session.get(Cotizacion, cotizacion_id)
    if not cotizacion:
        return jsonify({'mensaje': 'Cotización no encontrada'}), 404

    # Obtener datos del request
    datos = request.get_json()
    if not datos or 'productos' not in datos:
        return jsonify({'mensaje': 'Datos inválidos'}), 400

    # Crear nueva orden de Venta con los datos de la cotización
    nueva_orden = OrdenVenta(
        cotizacion_id=cotizacion.id,
        cliente=cotizacion.cliente,
        solicitante=cotizacion.solicitante,
        email=cotizacion.email,
        referencia=cotizacion.referencia,
        ruc=cotizacion.ruc,
        celular=cotizacion.celular,
        fecha=datetime.today().strftime('%d/%m/%Y'),
        total=sum([float(prod['precio_total']) for prod in datos['productos']]),
        estado='En Proceso',
        creado_por=current_user.id  # Añadir quién creó la orden de compra
    )
    db.session.add(nueva_orden)
    db.session.commit()  # Commit para obtener el ID de la orden de compra

    # Añadir productos seleccionados a la orden de compra
    for producto in datos['productos']:
        producto_orden = ProductoOrden(
            orden_id=nueva_orden.id,
            producto_id=producto['id'],
            cantidad=producto['cantidad'],
            precio_unitario=producto['precio_unitario'],
            precio_total=producto['precio_total'],
            tipo_compra='stock',  # Por defecto, o podría ser modificado según la lógica
            estado='Pendiente'
        )
        db.session.add(producto_orden)

    # Cambiar el estado de la cotización a 'Finalizado'
    cotizacion.estado = 'Finalizado'
    db.session.commit()

    return jsonify({'mensaje': 'Orden de Venta generada correctamente.'}), 200

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        nombre_usuario = request.form['nombre_usuario']
        contraseña = request.form['contraseña']

        usuario = Usuario.query.filter_by(nombre_usuario=nombre_usuario).first()

        if usuario and usuario.check_password(contraseña):
            login_user(usuario)  # Iniciar sesión con Flask-Login
            flash('Inicio de sesión exitoso', 'success')
            return redirect(url_for('gerente_dashboard'))  # Redirigir al dashboard o donde desees

        flash('Usuario o contraseña incorrectos', 'danger')

    return render_template('login.html')

@app.route('/logout')
@login_required
@login_manager.user_loader
def load_user(user_id):
    return db.session.get(Usuario, int(user_id))

@app.route('/ordenes_venta', methods=['GET'])
def obtener_ordenes_venta():
    ordenes = OrdenVenta.query.all()
    output = []

    for orden in ordenes:
        creador = db.session.get(Usuario, orden.creado_por)  # Corrección aquí
        orden_data = {
            'id': orden.id,
            'cliente': orden.cliente,
            'solicitante': orden.solicitante,
            'fecha': orden.fecha,
            'email': orden.email,
            'estado': orden.estado,
            'creado_por': creador.nombre_usuario if creador else 'Desconocido',
            'productos': [producto.producto_id for producto in orden.productos],
            'tiene_guias_remision': len(orden.guias_remision) > 0
        }
        output.append(orden_data)

    return jsonify(output)

@app.route('/orden_venta/<int:orden_id>', methods=['GET'])
def obtener_orden(orden_id):
    orden = db.session.get(OrdenVenta, orden_id)
    if not orden:
        return jsonify({'mensaje': 'Orden no encontrada'}), 404

    productos = []
    for producto in orden.productos:
        producto_obj = db.session.get(Producto, producto.producto_id)
        nombre_producto = producto_obj.nombre if producto_obj else "Producto no encontrado"
        stock_producto = producto_obj.stock if producto_obj else "No disponible"

        productos.append({
            'id': producto.id,
            'nombre': nombre_producto,
            'stock': stock_producto,
            'cantidad': producto.cantidad,
            'precio_unitario': producto.precio_unitario,
            'precio_total': producto.precio_total,
            'tipo_compra': producto.tipo_compra,
        })

    orden_data = {
        'id': orden.id,
        'cliente': orden.cliente,
        'solicitante': orden.solicitante,
        'email': orden.email,
        'referencia': orden.referencia,
        'ruc': orden.ruc,
        'celular': orden.celular,
        'fecha': orden.fecha,
        'estado': orden.estado,
        'productos': productos
    }

    return jsonify(orden_data)

@app.route('/actualizar_estado_producto/<int:producto_id>', methods=['PUT'])
def actualizar_estado_producto(producto_id):
    producto = Producto.query.get(producto_id)
    if not producto:
        return jsonify({'mensaje': 'Producto no encontrado'}), 404

    data = request.json  # Obtener datos del JSON de la solicitud
    producto.activo = data.get('activo', producto.activo)  # Si "activo" no está en data, conserva su valor actual

    try:
        db.session.commit()
        return jsonify({'mensaje': 'Estado del producto actualizado con éxito'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'mensaje': f'Error al actualizar el estado: {str(e)}'}), 500

@app.route('/actualizar_estado_orden/<int:orden_id>', methods=['PUT'])
def actualizar_estado_orden(orden_id):
    orden = OrdenVenta.query.get(orden_id)
    if not orden:
        return jsonify({'mensaje': 'Orden no encontrada'}), 404

    data = request.json  # Obtener datos del JSON de la solicitud
    orden.estado = data.get('estado', orden.estado)  # Si "estado" no está en data, conserva su valor actual

    try:
        db.session.commit()  # Confirmamos los cambios
        return jsonify({'mensaje': 'Estado de la orden actualizado con éxito'}), 200
    except Exception as e:
        db.session.rollback()  # Revertimos los cambios si hay un error
        return jsonify({'mensaje': f'Error al actualizar el estado: {str(e)}'}), 500

@app.route('/orden_venta/<int:orden_id>/guias_remision', methods=['POST'])
def crear_guia_remision(orden_id):
    data = request.get_json()

    # Crear la guía de remisión con el número proporcionado por el usuario
    nueva_guia = GuiaRemision(
        numero_guia=data['numero_guia'],  # Este es solo el identificador visible
        orden_venta_id=orden_id,
        fecha_emision=datetime.today().strftime('%d/%m/%Y'),
        estado='Pendiente',
        activo=True
    )
    db.session.add(nueva_guia)
    db.session.commit()  # Hacemos commit para obtener el ID real

    # Ahora usamos el ID real de la guía recién creada
    guia_id_real = nueva_guia.id  

    # Agregar los productos a la tabla `producto_guia_remision`
    for producto in data['productos']:
        nuevo_producto_guia = ProductoGuiaRemision(
            guia_remision_id=guia_id_real,  # Usamos el ID real de la guía, NO el numero_guia
            producto_orden_id=producto['id'],
            cantidad=producto['cantidad'],
            estado='Pendiente',
            activo=True
        )
        db.session.add(nuevo_producto_guia)

    db.session.commit()  # Guardamos en la BD

    return jsonify({'mensaje': 'Guía de remisión creada con éxito'}), 201

@app.route('/productos/<int:producto_id>/stock', methods=['GET'])
def obtener_stock_producto(producto_id):
    # Obtener el producto de la base de datos
    producto = Producto.query.get(producto_id)
    if not producto:
        return jsonify({'mensaje': 'Producto no encontrado'}), 404
    # Lógica para obtener el stock y calcular los productos disponibles para envío y los que se necesitan pedir
    stock_disponible = producto.stock  # Ejemplo de stock en la base de datos
    cantidad_a_pedir = max(0, producto.stock - producto.cantidad_a_pedir)  # Ejemplo

    return jsonify({
        'stock_total': producto.stock,
        'stock_disponible': stock_disponible,
        'cantidad_a_pedir': cantidad_a_pedir
    })

@app.route('/orden_venta/<int:orden_id>/guias_remision', methods=['GET'])
def obtener_guias_remision(orden_id):
    guias = GuiaRemision.query.filter_by(orden_venta_id=orden_id).all()

    return jsonify([
        {
            "id": guia.id,  # Asegurar que se envía el ID correcto
            "numero_guia": guia.numero_guia,
            "fecha_emision": guia.fecha_emision,
            "estado": guia.estado
        }
        for guia in guias
    ])

@app.route('/orden_venta/<int:orden_id>/productos_remision', methods=['GET'])
def obtener_productos_remision(orden_id):
    print(f"📡 Recibida solicitud para obtener productos remitidos de la orden {orden_id}")

    productos_orden = ProductoOrden.query.filter_by(orden_id=orden_id).all()
    productos_suma = {}

    for producto in productos_orden:
        total_remitido = (
            db.session.query(db.func.sum(ProductoGuiaRemision.cantidad))
            .filter(ProductoGuiaRemision.producto_orden_id == producto.id)
            .scalar()
            or 0
        )

        producto_info = Producto.query.get(producto.producto_id)

        productos_suma[producto.id] = {
            "nombre": producto_info.nombre if producto_info else "Producto no encontrado",
            "cantidad_total": producto.cantidad,
            "cantidad_pendiente": max(0, producto.cantidad - total_remitido),
            "cantidad_remitida": total_remitido,
        }

        print(
            f"Producto_Orden_ID {producto.id} -> Cantidad Orden: {producto.cantidad}, "
            f"Cantidad Remitida: {total_remitido}, Pendiente: {productos_suma[producto.id]['cantidad_pendiente']}"
        )

    return jsonify(productos_suma), 200

@app.route('/ordenes_venta_guias', methods=['GET'])
def obtener_ordenes_venta_guias():
    numero_guia = request.args.get('numero_guia')

    if numero_guia:
        guia = GuiaRemision.query.filter_by(numero_guia=numero_guia).first()
        if not guia:
            return jsonify({'error': 'Guía no encontrada'}), 404

        productos = [
            {
                'id': producto.id,
                'nombre': producto.producto.nombre,
                'cantidad': producto.cantidad,
                'estado': producto.estado
            }
            for producto in guia.productos
        ]

        return jsonify({
            'numero_guia': guia.numero_guia,
            'estado': guia.estado,
            'productos': productos
        })

    # Si no se proporciona número de guía, devolver todas las órdenes con guías
    ordenes = OrdenVenta.query.all()
    resultado = []
    
    for orden in ordenes:
        guias = GuiaRemision.query.filter_by(orden_venta_id=orden.id).all()
        resultado.append({
            'id': orden.id,
            'cliente': orden.cliente,
            'fecha': orden.fecha,
            'total': sum([producto.cantidad for producto in orden.productos]), 
            'guias': [
                {
                    'numero_guia': guia.numero_guia,
                    'fecha_emision': guia.fecha_emision,
                    'estado': guia.estado
                }
                for guia in guias
            ]
        })

    return jsonify(resultado)

@app.route('/guia_remision/<int:guia_id>/productos', methods=['GET'])
def obtener_productos_guia(guia_id):
    productos_remisionados = ProductoGuiaRemision.query.filter_by(guia_remision_id=guia_id).all()

    if not productos_remisionados:
        print(f"No se encontraron productos para la guía {guia_id}")

    productos_lista = []
    for prod in productos_remisionados:
        producto_orden = db.session.get(ProductoOrden, prod.producto_orden_id)

        if producto_orden:
            producto_info = db.session.get(Producto, producto_orden.producto_id) if producto_orden else None
        else:
            producto_info = None

        nombre_producto = producto_info.nombre if producto_info else "Producto no disponible"

        productos_lista.append({
            "nombre": nombre_producto,
            "cantidad": prod.cantidad,
            "estado": prod.estado
        })

    print(f"Productos obtenidos en el backend: {productos_lista}")  # Debugging
    return jsonify(productos_lista), 200
  
@app.route('/obtener_detalle_guia/<numero_guia>', methods=['GET'])
def obtener_productos_de_guia(numero_guia):
    if not numero_guia:
        return jsonify({'error': 'Número de guía inválido'}), 400

    guia = db.session.get(GuiaRemision, numero_guia)
    if not guia:
        return jsonify({'error': 'Guía no encontrada'}), 404

    productos = [
        {
            'id': producto.id,
            'nombre': producto.producto.nombre,  # Aquí accedemos a 'producto.nombre' a través de la relación
            'cantidad': producto.cantidad,
            'estado': producto.estado  # Usamos 'estado' en lugar de 'entregado'
        }
        for producto in guia.productos  # Iteramos sobre los productos de la guía
    ]

    return jsonify({
        'numero_guia': guia.numero_guia,
        'estado': guia.estado,
        'productos': productos
    })

@app.route('/eliminar_guia/<int:guia_id>', methods=['DELETE', 'POST'])
def eliminar_guia(guia_id):

    # Verificamos si se envió el método DELETE en los datos del formulario

    if request.form.get('_method') == 'DELETE' or request.method == 'DELETE':

        try:

            print(f"Intentando eliminar la guía con ID: {guia_id}")  # Agrega esto para depuración

            guia = GuiaRemision.query.get_or_404(guia_id)

            
            # Eliminar productos asociados
            productos = ProductoGuiaRemision.query.filter_by(guia_remision_id=guia_id).all()
            for producto in productos:
                db.session.delete(producto)
            
            # Eliminar la guía
            db.session.delete(guia)
            db.session.commit()

            return jsonify({'mensaje': 'Guía de remisión eliminada con éxito.'}), 200
        except Exception as e:
            db.session.rollback()
            print(f"Error al eliminar la guía de remisión: {e}")
            return jsonify({'mensaje': f'Error al eliminar la guía de remisión: {str(e)}'}), 500
    else:
        return jsonify({'mensaje': 'Método no permitido.'}), 405

# Crear la tabla si no existe
with app.app_context():
    db.create_all()

    # Crear gerentes predefinidos
    if not Usuario.query.filter_by(nombre_usuario='gerente1').first():
        gerente1 = Usuario(nombre_usuario='gerente1', rol='Gerente')
        gerente1.set_password('password123')
        db.session.add(gerente1)

    if not Usuario.query.filter_by(nombre_usuario='gerente2').first():
        gerente2 = Usuario(nombre_usuario='gerente2', rol='Gerente')
        gerente2.set_password('password456')
        db.session.add(gerente2)

    db.session.commit()


if __name__ == '__main__':
    app.run(debug=True)
