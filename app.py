from flask import Flask, request, jsonify, render_template, redirect, url_for, flash, send_file, make_response
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from sqlalchemy.orm import Session
from werkzeug.security import generate_password_hash, check_password_hash
from flask_login import LoginManager, UserMixin, login_user, logout_user, current_user, login_required
import os
from flask import request, jsonify
from datetime import datetime, timedelta
from werkzeug.utils import secure_filename
from dotenv import load_dotenv
import boto3
import json
from sqlalchemy import func
from sqlalchemy.dialects.postgresql import TSVECTOR
from sqlalchemy import text
from math import ceil
from sqlalchemy.orm import joinedload
from flask import Flask, request, jsonify, send_file
from flask_login import login_required, current_user
from generate_excel import generate_excel_file

app = Flask(__name__)

UPLOAD_FOLDER = 'static/uploads/'
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg'}
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def get_secret():
    secret_name = "RDS-segurimax-db"
    region_name = "us-east-1"

    session = boto3.session.Session()
    client = session.client('secretsmanager', region_name=region_name)

    try:
        response = client.get_secret_value(SecretId=secret_name)
    except client.exceptions.ResourceNotFoundException:
        print(f"El secreto {secret_name} no fue encontrado.")
        return None
    except client.exceptions.ClientError as e:
        print(f"Error al obtener el secreto: {e}")
        return None

    # El secreto es un dict con: username, password, engine, host, port, dbname, etc.
    secret_dict = json.loads(response['SecretString'])

    # Construimos la cadena al estilo:
    # postgresql+psycopg2://username:password@host:port/dbname
    user = secret_dict["username"]
    password = secret_dict["password"]
    engine = secret_dict["engine"]   # "postgres" por ejemplo
    host = secret_dict["host"]
    port = secret_dict["port"]
    dbname = secret_dict["dbname"]

    db_uri = f"postgresql+psycopg2://{user}:{password}@{host}:{port}/{dbname}"
    return db_uri

def create_app():

    # Obtener la ruta absoluta del directorio actual
    load_dotenv()
     
    basedir = os.path.abspath(os.path.dirname(__file__))

    # Asegúrate de que la carpeta 'instance' exista
    if not os.path.exists(os.path.join(basedir, 'instance')):
        os.makedirs(os.path.join(basedir, 'instance'))
    
    # Intenta obtener la URI de la base de datos desde AWS Secrets Manager
    # db_uri = get_secret()
    db_uri = "postgresql+psycopg2://postgres:HQX4meI4pYJGGxP2WL7w@proyecto-cotizaciones-db.c09o2u6em92b.us-east-1.rds.amazonaws.com:5432/proyecto_cotizaciones"

    # Si no se pudo obtener el secreto, usa una variable de entorno local como fallback
    if not db_uri:
        db_uri = os.getenv('DATABASE_URI', 'fallback') 

    # Configuración de la base de datos
    app.config['SQLALCHEMY_DATABASE_URI'] = db_uri
    app.config['SQLALCHEMY_ENGINE_OPTIONS'] = {}

    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    app.config['SECRET_KEY'] = 'clave-secreta-aqui'  # Es necesario para usar Flask-Login

    # Inicializa SQLAlchemy con la aplicación
    db.init_app(app)

    return app

db = SQLAlchemy()
app = create_app()
migrate = Migrate(app, db)

login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'login'

@login_manager.user_loader
def load_user(user_id):
    return db.session.get(Usuario, int(user_id)) 

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
     # Campos nuevos:
    estado = db.Column(db.String(50), default='disponible') 
    comentario = db.Column(db.Text, nullable=True)
    tipo_producto = db.Column(db.String(20), default='NORMAL')
    search_vector = db.Column(TSVECTOR)

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
    # Nuevas columnas
    plazo_entrega = db.Column(db.Integer, nullable=False)  # Plazo de entrega en días
    pago_credito = db.Column(db.String(255), nullable=False)  # Plazo de pago en crédito
    tipo_cambio = db.Column(db.String(10), nullable=False)  # Moneda: soles, dólares o euros
    lugar_entrega = db.Column(db.String(255))  # Campo opcional para el lugar de entrega
    detalle_adicional = db.Column(db.Text)  # Campo opcional para detalles adicionales
    valor_cambio = db.Column(db.Float, nullable=False, default=1.0)

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
     # **Nuevos campos**
    numero_orden_compra = db.Column(db.String(50), nullable=False)  # Número de OC del cliente
    fecha_orden_compra = db.Column(db.String(10), nullable=False)   # Fecha de OC
    cotizacion = db.relationship('Cotizacion', backref='ordenes_venta', lazy=True)
    creador = db.relationship('Usuario', backref='ordenes_creadas', lazy=True)

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
    orden_venta_id = db.Column(db.Integer, db.ForeignKey('orden_venta.id'), nullable=False)
    fecha_emision = db.Column(db.String(10), nullable=False)
    estado = db.Column(db.String(50), nullable=False, default='Pendiente')
    productos = db.relationship('ProductoGuiaRemision', backref='guia_remision', lazy=True)
    activo = db.Column(db.Boolean, default=True)
    comentario = db.Column(db.Text, nullable=True)  # Comentario opcional
    imagen_url = db.Column(db.String(255), nullable=True)  # Ruta de la imagen opcional

class ProductoGuiaRemision(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    guia_remision_id = db.Column(db.Integer, db.ForeignKey('guia_remision.id', ondelete='CASCADE'), nullable=False)
    producto_orden_id = db.Column(db.Integer, db.ForeignKey('producto_orden.id'), nullable=False)  # Nueva relación
    cantidad = db.Column(db.Integer, nullable=False)
    estado = db.Column(db.String(20), nullable=False, default='Pendiente')
    activo = db.Column(db.Boolean, default=True)
    producto_orden = db.relationship('ProductoOrden', backref='productos_guias')

class ListaDeseos(db.Model):
    __tablename__ = 'lista_deseos'

    id = db.Column(db.Integer, primary_key=True)
    cliente = db.Column(db.String(100), nullable=False)   # Empresa o nombre del cliente
    ruc = db.Column(db.String(11), nullable=True)
    fecha_creacion = db.Column(db.DateTime, default=datetime.utcnow)
    creado_por = db.Column(db.Integer, db.ForeignKey('usuario.id'), nullable=False)
    prioridad = db.Column(db.String(20), default='Normal')
    comentario = db.Column(db.Text, nullable=True)
    estado = db.Column(db.String(20), default='Abierto')  
    # 'Abierto', 'Procesando', 'Cerrado', etc.

    # Relación 1 a N con ItemDeseo
    items = db.relationship('ItemDeseo', backref='lista_deseos', lazy=True)

class ItemDeseo(db.Model):
    __tablename__ = 'item_deseo'

    id = db.Column(db.Integer, primary_key=True)
    lista_deseos_id = db.Column(db.Integer, db.ForeignKey('lista_deseos.id'), nullable=False)

    # Si existe 'producto_id', usaremos su nombre real. 
    producto_id = db.Column(db.Integer, db.ForeignKey('producto.id'), nullable=True)
    
    # En caso de pre-producto
    nombre_preproducto = db.Column(db.String(150), nullable=True)

    cantidad_necesaria = db.Column(db.Integer, default=1)
    precio_referencia = db.Column(db.Float, default=0.0)
    
    estado_item = db.Column(db.String(20), default='Pendiente') 
    # Podrías usar: 'Pendiente', 'Cotizado', 'Descartado', etc.

    # Relación opcional para el producto
    producto = db.relationship('Producto', lazy=True)

class CotizacionCompra(db.Model):
    __tablename__ = 'cotizacion_compra'

    id = db.Column(db.Integer, primary_key=True)
    proveedor = db.Column(db.String(100), nullable=False)
    ruc_proveedor = db.Column(db.String(15), nullable=True)
    forma_pago = db.Column(db.String(100), nullable=True)
    fecha_oferta = db.Column(db.Date, nullable=True)
    validez_dias = db.Column(db.Integer, nullable=True)
    plazo_entrega_dias = db.Column(db.Integer, nullable=True)
    creado_por = db.Column(db.Integer, db.ForeignKey('usuario.id'), nullable=False)
    estado = db.Column(db.String(20), default='Abierto')

    # Relación corregida:
    productos_cotizados = db.relationship('ProductoCotizacionCompra', back_populates='cotizacion', lazy=True)

class ProductoCotizacionCompra(db.Model):
    __tablename__ = 'producto_cotizacion_compra'

    id = db.Column(db.Integer, primary_key=True)
    cotizacion_compra_id = db.Column(db.Integer, db.ForeignKey('cotizacion_compra.id'), nullable=False)
    item_deseo_id = db.Column(db.Integer, db.ForeignKey('item_deseo.id'), nullable=False)
    precio_ofrecido = db.Column(db.Float, nullable=False)
    cantidad = db.Column(db.Integer, nullable=False)

    # NUEVO:
    estado = db.Column(db.String(20), default='Pendiente')  
    # 'Pendiente', 'Comprado', 'Descartado', etc.

    cotizacion = db.relationship('CotizacionCompra', back_populates='productos_cotizados')
    item_deseo = db.relationship('ItemDeseo', backref='productos_cotizados')

class OrdenCompra(db.Model):
    __tablename__ = 'orden_compra'
    
    id = db.Column(db.Integer, primary_key=True)
    cotizacion_compra_id = db.Column(db.Integer, db.ForeignKey('cotizacion_compra.id'), nullable=True)

    numero_orden = db.Column(db.String(50), nullable=False)
    fecha_orden = db.Column(db.Date, nullable=False)
    observaciones = db.Column(db.Text, nullable=True)

    proveedor = db.Column(db.String(100), nullable=False)
    estado = db.Column(db.String(20), default='Pendiente')
    # p.ej: 'Pendiente', 'Recibido Parcial', 'Cerrado'
    
    creado_por = db.Column(db.Integer, db.ForeignKey('usuario.id'), nullable=False)

    # Relación 1 a N con ProductoOrdenCompra (detalle)
    productos = db.relationship('ProductoOrdenCompra', backref='orden_compra', lazy=True)

    # Relación 1 a 1 con la cotización de compra
    cotizacion_compra = db.relationship('CotizacionCompra', backref='orden_compra', lazy=True)

class ProductoOrdenCompra(db.Model):
    __tablename__ = 'producto_orden_compra'

    id = db.Column(db.Integer, primary_key=True)
    orden_compra_id = db.Column(db.Integer, db.ForeignKey('orden_compra.id'), nullable=False)

    cotizacion_compra_item_id = db.Column(db.Integer, db.ForeignKey('producto_cotizacion_compra.id'), nullable=True)
    # si deseas saber exactamente a cuál item de la cotización apunta

    item_deseo_id = db.Column(db.Integer, db.ForeignKey('item_deseo.id'), nullable=True)
    precio_unitario = db.Column(db.Float, nullable=False, default=0)
    cantidad = db.Column(db.Integer, nullable=False, default=1)
    estado = db.Column(db.String(20), default='Pendiente')
    # etc.

class GuiaRemisionCompra(db.Model):
    __tablename__ = 'guia_remision_compra'
    
    id = db.Column(db.Integer, primary_key=True)
    orden_compra_id = db.Column(db.Integer, db.ForeignKey('orden_compra.id'), nullable=False)
    
    numero_guia = db.Column(db.String(100), nullable=False, unique=True)
    fecha_emision = db.Column(db.DateTime, default=datetime.utcnow)
    
    estado = db.Column(db.String(20), default='Pendiente')  
    # 'Pendiente', 'Recibido Parcial', 'Recibido Total'
    
    comentario = db.Column(db.Text, nullable=True)
    activo = db.Column(db.Boolean, default=True)
    
    productos = db.relationship('ProductoGuiaRemisionCompra', backref='guia_remision_compra', lazy=True)
    
    # Relación con la OrdenCompra si quieres:
    orden_compra = db.relationship('OrdenCompra', lazy=True)

class ProductoGuiaRemisionCompra(db.Model):
    __tablename__ = 'producto_guia_remision_compra'
    
    id = db.Column(db.Integer, primary_key=True)
    guia_remision_compra_id = db.Column(db.Integer, db.ForeignKey('guia_remision_compra.id'), nullable=False)
    producto_orden_compra_id = db.Column(db.Integer, db.ForeignKey('producto_orden_compra.id'), nullable=False)
    cantidad_recibida = db.Column(db.Integer, nullable=False, default=0)
    
    estado = db.Column(db.String(20), default='Pendiente')
    activo = db.Column(db.Boolean, default=True)
    
    # Relación con el detalle de la orden (para saber cuál producto/cantidad se está recibiendo)
    producto_orden_compra = db.relationship('ProductoOrdenCompra', lazy=True)

# Método para registrar una actividad
@app.route('/')
def home():
    return render_template('login.html')

@app.route('/gerente_dashboard')
@login_required
def gerente_dashboard():
    return render_template('gerente_dashboard.html')

@app.route('/edicion_productos')
@login_required
def edicion_productos():
    return render_template('edicion_productos.html')

@app.route('/orden_venta')
@login_required
def orden_venta():
    return render_template('orden_venta.html')

@app.route('/trabajador_dashboard')
@login_required
def trabajador_dashboard():
    return render_template('trabajador_dashboard.html')

@app.route('/cliente_dashboard')
@login_required
def cliente_dashboard():
    return render_template('cliente_dashboard.html')

@app.route('/cotizaciones_dashboard')
@login_required
def cotizaciones_dashboard():
    return render_template('cotizaciones_dashboard.html')

@app.route('/verificacion_cotizacion')
@login_required
def verificacion_cotizacion():
    return render_template('verificacion_cotizacion.html')

@app.route('/guias_remision')
@login_required
def guias_remision():

    guias = GuiaRemision.query.all()

    return render_template('guias_remision.html', guias=guias)

@app.route('/lista_deseos_dashboard')
@login_required
def lista_deseos_dashboard():
    return render_template('lista_deseos_dashboard.html')

@app.route('/cotizaciones_compra_dashboard')
@login_required
def cotizaciones_compra_dashboard():
    return render_template('cotizaciones_compra_dashboard.html')

@app.route('/orden_compra_dashboard')
@login_required
def orden_compra_dashboard():
    return render_template('orden_compra_dashboard.html')

@app.route('/productos', methods=['POST'])
def crear_producto():
    data = request.get_json()
    
    nuevo_producto = Producto(
        nombre=data['nombre'],
        descripcion=data.get('descripcion', 'Pre-producto generado en cotización'),
        precio=data['precio'],
        stock=data.get('stock', 0),
        proveedor=data.get('proveedor', ''),
        sucursal=data.get('sucursal', ''),
        almacen=data.get('almacen', ''),
        codigo_item=data.get('codigo_item', ''),
        codigo_barra=data.get('codigo_barra', ''),
        unidad=data.get('unidad', 'UND'),
        creado_por=current_user.id,
        # Campos para pre-producto
        tipo_producto=data.get('tipo_producto', 'NORMAL'),
        estado=data.get('estado', 'Disponible'),
        comentario=data.get('comentario', '')
    )
    db.session.add(nuevo_producto)
    db.session.commit()
    
    # Devolver también el ID para poder agregarlo al carrito
    return jsonify({
        'mensaje': 'Producto añadido con éxito',
        'id': nuevo_producto.id
    }), 201

@app.route('/productos', methods=['GET'])
def obtener_productos():
    """
    Endpoint con paginación y Full-Text Search (FTS) en PostgreSQL.
    - Parámetros: page, per_page, termino
    - Devuelve: { productos, total, paginas, pagina_actual }
    """
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 20, type=int)
    termino = request.args.get('termino', '', type=str).strip()

    # Base query: solo productos activos
    query = Producto.query.filter(Producto.activo == True)

    # Si hay término, aplicar FTS:
    if termino:
        # Construye un string para to_tsquery con :*
        # Ej: termino = "cas aca" => "cas:* & aca:*"
        tokens = termino.split()
        if tokens:
            tsquery_string = ' & '.join([f"{t.strip()}:*" for t in tokens])
            # Aplica FTS con prefijos
            query = query.filter(
                Producto.search_vector.op('@@')(
                    func.to_tsquery('spanish', tsquery_string)
                )
            )

    # Paginamos la query
    productos_paginados = query.order_by(Producto.id.asc()).paginate(
        page=page, 
        per_page=per_page, 
        error_out=False
    )

    # Armamos la respuesta JSON
    productos_json = []
    for p in productos_paginados.items:
        productos_json.append({
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
        })

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
    """
    Endpoint con paginación + Full-Text Search (columna 'search_vector').
    Admite coincidencia parcial usando :* (prefijos).
    Parámetros:
      - page (int)
      - per_page (int)
      - termino (str)
    Devuelve:
      {
        "productos": [...],
        "total": int,
        "paginas": int,
        "pagina_actual": int
      }
    """
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 20, type=int)
    termino = request.args.get('termino', '', type=str).strip()

    offset = (page - 1) * per_page

    if not termino:
        # CASO 1: sin término => traer productos activos sin filtro, paginados
        sql_count = text("""
            SELECT COUNT(*) AS total
            FROM producto
            WHERE activo = TRUE
        """)
        total_rows = db.session.execute(sql_count).scalar()

        sql_data = text("""
            SELECT *
            FROM producto
            WHERE activo = TRUE
            ORDER BY id
            LIMIT :limit
            OFFSET :offset
        """)
        rows = db.session.execute(sql_data, {
            'limit': per_page,
            'offset': offset
        }).mappings().all()

    else:
        # CASO 2: con término => construimos un to_tsquery con :*
        # p.ej. "cas aca" => "cas:* & aca:*"
        tokens = termino.split()
        if tokens:
            tsquery_string = ' & '.join([f"{t.strip()}:*" for t in tokens])
        else:
            # si hubiera un caso raro de término vacío
            tsquery_string = ''  # no coincidirá nada

        # Contar total
        sql_count = text("""
            SELECT COUNT(*) AS total
            FROM producto
            WHERE activo = TRUE
              AND search_vector @@ to_tsquery('spanish', :tsquery)
        """)
        total_rows = db.session.execute(sql_count, {'tsquery': tsquery_string}).scalar()

        # Obtener datos
        sql_data = text("""
            SELECT *
            FROM producto
            WHERE activo = TRUE
              AND search_vector @@ to_tsquery('spanish', :tsquery)
            ORDER BY id
            LIMIT :limit
            OFFSET :offset
        """)
        rows = db.session.execute(sql_data, {
            'tsquery': tsquery_string,
            'limit': per_page,
            'offset': offset
        }).mappings().all()

    # Mapeo a JSON
    productos = []
    for row in rows:
        productos.append({
            'id': row['id'],
            'nombre': row['nombre'],
            'descripcion': row['descripcion'],
            'precio': row['precio'],
            'stock': row['stock'],
            'proveedor': row['proveedor'],
            'sucursal': row['sucursal'],
            'almacen': row['almacen'],
            'codigo_item': row['codigo_item'],
            'codigo_barra': row['codigo_barra'],
            'unidad': row['unidad'],
            'activo': row['activo']
        })

    # Calcular total de páginas
    paginas = ceil(total_rows / per_page) if per_page else 1

    return jsonify({
        'productos': productos,
        'total': total_rows,
        'paginas': paginas,
        'pagina_actual': page
    })

@app.route('/guardar_cotizacion', methods=['POST'])
@login_required
def guardar_cotizacion():
    datos = request.json

    # 1) Crear y guardar la cotización en BD
    nueva_cotizacion = Cotizacion(
        cliente=datos['cliente'],
        solicitante=datos['solicitante'],
        email=datos['email'],
        referencia=datos['referencia'],
        ruc=datos['ruc'],
        celular=datos.get('celular', ''),
        fecha=datos['fecha'],
        total=datos['total'],
        plazo_entrega=int(datos['plazo_entrega']),
        pago_credito=datos['pago_credito'],
        tipo_cambio=datos['tipo_cambio'],
        valor_cambio=datos.get('valor_cambio', 1.0),
        lugar_entrega=datos.get('lugar_entrega', ''),
        detalle_adicional=datos.get('detalle_adicional', ''),
        creado_por=current_user.id
    )
    db.session.add(nueva_cotizacion)
    db.session.commit()  # Para obtener el ID

    # 2) Guardar los productos en la BD
    for producto in datos['productos']:
        nuevo_prod_cot = ProductoCotizacion(
            cotizacion_id=nueva_cotizacion.id,
            producto_id=producto['id'],
            cantidad=producto['cantidad'],
            precio_unitario=producto['precio_unitario'],
            porcentaje_ganancia=producto['ganancia'],
            precio_total=producto['precio_total'],
            tipo_compra=producto['tipo_compra']
        )
        db.session.add(nuevo_prod_cot)

    db.session.commit()

    # 3) Retornar JSON indicando que todo fue OK y con el id
    return jsonify({
        "id": nueva_cotizacion.id,
        "mensaje": "Cotización guardada con éxito"
    }), 201

@app.route('/descargar_excel/<int:cot_id>', methods=['GET'])
@login_required
def descargar_excel(cot_id):
    cotizacion = db.session.get(Cotizacion, cot_id)
    if not cotizacion:
        return "No existe la cotización", 404

    productos_cot = ProductoCotizacion.query.filter_by(cotizacion_id=cot_id).all()

    productos_excel = []
    for pc in productos_cot:
        producto = db.session.get(Producto, pc.producto_id)
        nombre_real = producto.nombre if producto else f"Prod ID {pc.producto_id}"

        precio_unitario = pc.precio_unitario
        precio_total = pc.precio_total

        productos_excel.append({
            "nombre_producto": nombre_real,
            "unidad": "UND",
            "cantidad": pc.cantidad,
            "precio_unitario": round(precio_unitario, 2),
            "precio_total": round(precio_total, 2),
            "marca_modelo": "",  # Mejora futura
        })

    info_excel = {
        "cliente": cotizacion.cliente,
        "solicitante": cotizacion.solicitante,
        "email": cotizacion.email,
        "referencia": cotizacion.referencia,
        "ruc": cotizacion.ruc,
        "celular": cotizacion.celular,
        "fecha": cotizacion.fecha,
        "tipo_cambio": cotizacion.tipo_cambio,
        "valor_cambio": cotizacion.valor_cambio,
        "plazo_entrega": cotizacion.plazo_entrega,
        "pago_credito": cotizacion.pago_credito,
        "lugar_entrega": cotizacion.lugar_entrega
    }

    excel_bytes = generate_excel_file(
        productos_excel,
        template_path="template.xlsx",
        info=info_excel
    )

    return send_file(
        excel_bytes,
        mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        as_attachment=True,
        download_name=f"Cotizacion_{cot_id}.xlsx"
    )


@app.route('/cotizacion/<int:id>', methods=['GET'])
@login_required
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
@login_required
def obtener_cotizaciones_paginadas():
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 20, type=int)
    offset = (page - 1) * per_page

    # Total de cotizaciones activas
    total_query = text("SELECT COUNT(*) FROM cotizacion")
    total_rows = db.session.execute(total_query).scalar()

    # Cotizaciones ordenadas por ID DESC (más reciente primero)
    sql = text("""
        SELECT * FROM cotizacion
        ORDER BY id DESC
        LIMIT :limit OFFSET :offset
    """)
    rows = db.session.execute(sql, {
        'limit': per_page,
        'offset': offset
    }).mappings().all()

    # Formatear resultado
    cotizaciones_data = []
    for row in rows:
        usuario = db.session.get(Usuario, row['creado_por'])
        cotizaciones_data.append({
            'id': row['id'],
            'cliente': row['cliente'],
            'ruc': row['ruc'],
            'fecha': row['fecha'],
            'email': row['email'],
            'estado': row['estado'],
            'creado_por': usuario.nombre_usuario if usuario else 'Desconocido'
        })

    return jsonify({
        'cotizaciones': cotizaciones_data,
        'pagina_actual': page,
        'total': total_rows,
        'paginas': ceil(total_rows / per_page) if per_page else 1
    })

@app.route('/transformar_orden_venta/<int:cotizacion_id>', methods=['POST'])
@login_required
def transformar_orden_venta(cotizacion_id):
    cotizacion = db.session.get(Cotizacion, cotizacion_id)
    if not cotizacion:
        return jsonify({'mensaje': 'Cotización no encontrada'}), 404

    # Obtener datos del request
    datos = request.get_json()
    if not datos or 'productos' not in datos:
        return jsonify({'mensaje': 'Datos inválidos'}), 400

    productos_seleccionados = datos['productos']
    total_productos_cotizacion = len(cotizacion.productos)
    total_productos_seleccionados = len(productos_seleccionados)

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
        total=sum([float(prod['precio_total']) for prod in productos_seleccionados]),
        estado='En Proceso',
        creado_por=current_user.id,
        numero_orden_compra=datos['numero_orden_compra'],
        fecha_orden_compra=datos['fecha_orden_compra']
    )
    db.session.add(nueva_orden)
    db.session.commit()  # Commit para obtener el ID de la orden de compra

    # Añadir productos seleccionados a la orden de compra
    for producto in productos_seleccionados:
        producto_orden = ProductoOrden(
            orden_id=nueva_orden.id,
            producto_id=producto['id'],
            cantidad=producto['cantidad'],
            precio_unitario=producto['precio_unitario'],
            precio_total=producto['precio_total'],
            tipo_compra='stock',
            estado='Pendiente'
        )
        db.session.add(producto_orden)

    # Determinar estado final de la cotización
    if total_productos_seleccionados == total_productos_cotizacion:
        cotizacion.estado = 'Finalizado Total'
    else:
        cotizacion.estado = 'Finalizado Parcial'

    db.session.commit()

    return jsonify({'mensaje': 'Orden de Venta generada correctamente.'}), 200

@app.route('/rechazar_cotizacion/<int:cotizacion_id>', methods=['POST'])
@login_required
def rechazar_cotizacion(cotizacion_id):
    cotizacion = db.session.get(Cotizacion, cotizacion_id)
    if not cotizacion:
        return jsonify({'mensaje': 'Cotización no encontrada'}), 404

    cotizacion.estado = 'Rechazada'
    db.session.commit()

    return jsonify({'mensaje': 'Cotización rechazada correctamente.'}), 200

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
def logout():
    logout_user()
    flash('Sesión cerrada exitosamente', 'success')
    return redirect(url_for('login'))

@app.route('/ordenes_venta', methods=['GET'])
@login_required
def obtener_ordenes_venta():
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 20, type=int)

    ordenes_paginadas = OrdenVenta.query.options(
        joinedload(OrdenVenta.cotizacion),
        joinedload(OrdenVenta.productos),
        joinedload(OrdenVenta.guias_remision),
        joinedload(OrdenVenta.creador)
    ).order_by(OrdenVenta.id.desc()).paginate(page=page, per_page=per_page, error_out=False)

    hoy = datetime.today().date()
    output = []

    for orden in ordenes_paginadas.items:
        cotizacion = orden.cotizacion
        creador = orden.creador

        tipo_cambio = cotizacion.tipo_cambio if cotizacion else "Soles"
        plazo_entrega = cotizacion.plazo_entrega if cotizacion else "No definido"
        pago_credito = cotizacion.pago_credito if cotizacion else "No definido"
        total_soles = orden.total

        total_convertido = None
        if tipo_cambio.lower() == "dólares":
            total_convertido = f"${(total_soles / 3.8):.2f} (USD)"
        elif tipo_cambio.lower() == "euros":
            total_convertido = f"€{(total_soles / 4.1):.2f} (EUR)"

        estado_tiempo = "Fecha no definida"
        if orden.fecha_orden_compra:
            try:
                fecha_orden = datetime.strptime(orden.fecha_orden_compra, "%Y-%m-%d").date()
                if cotizacion and isinstance(cotizacion.plazo_entrega, int):
                    fecha_limite = fecha_orden + timedelta(days=cotizacion.plazo_entrega)
                    if fecha_limite > hoy:
                        estado_tiempo = "A tiempo"
                    elif fecha_limite == hoy:
                        estado_tiempo = "Tiempo límite"
                    else:
                        estado_tiempo = "A destiempo"
            except Exception as e:
                estado_tiempo = "Error en fecha"

        orden_data = {
            'id': orden.id,
            'cliente': orden.cliente,
            'solicitante': orden.solicitante,
            'fecha': orden.fecha,
            'fecha_orden_compra': orden.fecha_orden_compra or "No definida",
            'estado_tiempo': estado_tiempo,
            'estado': orden.estado,
            'creado_por': creador.nombre_usuario if creador else "Desconocido",
            'productos': [p.producto_id for p in orden.productos],
            'tiene_guias_remision': bool(orden.guias_remision),
            'total': f"S/. {total_soles:.2f}",
            'tipo_cambio': tipo_cambio,
            'total_convertido': total_convertido,
            'plazo_entrega': plazo_entrega,
            'pago_credito': pago_credito
        }

        output.append(orden_data)

    return jsonify({
        'ordenes': output,
        'pagina_actual': ordenes_paginadas.page,
        'total_paginas': ordenes_paginadas.pages,
        'total_registros': ordenes_paginadas.total
    })

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
    producto = db.session.get(Producto, producto_id)
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
    orden = db.session.get(OrdenVenta, orden_id)
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
    producto = db.session.get(Producto, producto_id)
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
            "id": guia.id, 
            "numero_guia": guia.numero_guia,
            "fecha_emision": guia.fecha_emision,
            "estado": guia.estado
        }
        for guia in guias
    ])

@app.route('/orden_venta/<int:orden_id>/productos_remision', methods=['GET'])
def obtener_productos_remision(orden_id):

    productos_orden = ProductoOrden.query.filter_by(orden_id=orden_id).all()
    productos_suma = {}

    for producto in productos_orden:
        total_remitido = (
            db.session.query(db.func.sum(ProductoGuiaRemision.cantidad))
            .filter(ProductoGuiaRemision.producto_orden_id == producto.id)
            .scalar()
            or 0
        )

        producto_info = db.session.get(Producto, producto.producto_id)

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
            'numero_orden_compra': orden.numero_orden_compra,
            'guias': [
                {
                    'id': guia.id,
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

    productos = []
    for producto in guia.productos:

        producto_obj = db.session.get(Producto, producto.producto_orden.producto_id) if producto.producto_orden else None
        nombre_producto = producto_obj.nombre if producto_obj else "Producto no encontrado"

        productos.append({
            'id': producto.id,
            'nombre': nombre_producto,
            'cantidad': producto.cantidad,
            'estado': producto.estado
        })

    return jsonify({
        'numero_guia': guia.numero_guia,
        'estado': guia.estado,
        'productos': productos
    })

@app.route('/actualizar_guia/<int:id_guia>', methods=['POST'])
def actualizar_guia(id_guia):
    guia = db.session.get(GuiaRemision, id_guia)  # Buscar por ID en lugar de número de guía
    if not guia:
        return jsonify({'error': 'Guía no encontrada'}), 404

    estado = request.form.get('estado')
    comentario = request.form.get('comentario')
    imagen = request.files.get('imagen')

    if estado:
        guia.estado = estado
    if comentario:
        guia.comentario = comentario

    if imagen and allowed_file(imagen.filename):
        filename = secure_filename(imagen.filename)
        imagen_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        imagen.save(imagen_path)
        guia.imagen_url = f'/static/uploads/{filename}'

    db.session.commit()
    return jsonify({'mensaje': 'Guía actualizada correctamente'}), 200

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

@app.route('/obtener_guias_por_orden/<int:orden_id>', methods=['GET'])
def obtener_guias_por_orden(orden_id):
    guias = GuiaRemision.query.filter_by(orden_venta_id=orden_id).all()
    return jsonify([
        {
            'id': guia.id,
            'numero_guia': guia.numero_guia,
            'fecha_emision': guia.fecha_emision,
            'estado': guia.estado
        }
        for guia in guias
    ])

@app.route('/lista_deseos', methods=['POST'])
@login_required
def crear_lista_deseos():
    data = request.get_json()
    nueva_lista = ListaDeseos(
        cliente=data['cliente'],
        ruc=data.get('ruc', ''),
        creado_por=current_user.id,
        prioridad=data.get('prioridad', 'Normal'),
        comentario=data.get('comentario', ''),
        # estado se queda en 'Abierto' por defecto
    )
    db.session.add(nueva_lista)
    db.session.commit()
    return jsonify({'mensaje': 'Lista de Deseos creada', 'id': nueva_lista.id}), 201

@app.route('/lista_deseos/<int:lista_id>', methods=['GET'])
@login_required
def obtener_lista_deseos(lista_id):
    lista = db.session.get(ListaDeseos, lista_id)
    if not lista:
        return jsonify({'error': 'No existe esta lista'}), 404
    
    items_data = []
    for item in lista.items:
        if item.producto:
            # Si hay producto real
            items_data.append({
                'id': item.id,
                'producto_id': item.producto_id,
                'nombre': item.producto.nombre,
                'cantidad_necesaria': item.cantidad_necesaria,
                'precio_referencia': item.precio_referencia,
                'estado_item': item.estado_item
            })
        else:
            # Pre-producto
            items_data.append({
                'id': item.id,
                'producto_id': None,
                'nombre': item.nombre_preproducto,
                'cantidad_necesaria': item.cantidad_necesaria,
                'precio_referencia': item.precio_referencia,
                'estado_item': item.estado_item
            })
    
    lista_data = {
        'id': lista.id,
        'cliente': lista.cliente,
        'ruc': lista.ruc,
        'fecha_creacion': lista.fecha_creacion.isoformat(),
        'prioridad': lista.prioridad,
        'comentario': lista.comentario,
        'estado': lista.estado,
        'items': items_data
    }
    return jsonify(lista_data), 200

@app.route('/lista_deseos/crear_con_items', methods=['POST'])
@login_required
def crear_lista_deseos_con_items():
    data = request.json

    # 1) Crear la lista de deseos
    nueva_lista = ListaDeseos(
        cliente=data['cliente'],
        ruc=data.get('ruc', ''),
        prioridad=data.get('prioridad', 'Normal'),
        creado_por=current_user.id
    )
    db.session.add(nueva_lista)
    db.session.commit()  # Para obtener nueva_lista.id

    # 2) Recorrer los items
    for item in data.get('items', []):
        producto_id = item.get('producto_id')  # puede ser None si no existía
        nombre_pre = item.get('nombre_preproducto')  # si es un pre-producto
        cantidad = item.get('cantidad_necesaria', 1)
        precio_ref = item.get('precio_referencia', 0.0)

        nuevo_item = ItemDeseo(
            lista_deseos_id=nueva_lista.id,
            producto_id=producto_id,  # si es None, quedará null
            nombre_preproducto=nombre_pre,
            cantidad_necesaria=cantidad,
            precio_referencia=precio_ref
        )
        db.session.add(nuevo_item)

    db.session.commit()

    return jsonify({
       'mensaje': 'Lista de deseos creada con éxito',
       'lista_deseos_id': nueva_lista.id
    }), 201

@app.route('/items_deseo_pendientes', methods=['GET'])
@login_required
def items_deseo_pendientes():
    """
    Devuelve un JSON con los items de deseo que estén en estado 'Pendiente' o 'Abierto'.
    Incluye el ID de la lista, el nombre del cliente y la info del item (id, producto, etc.).
    """
    # Ejemplo sencillo: buscar ItemDeseo con estado='Pendiente'
    pendientes = (db.session.query(ItemDeseo)
                  .join(ListaDeseos, ListaDeseos.id == ItemDeseo.lista_deseos_id)
                  .all())
    #.filter(ListaDeseos.estado == 'Pendiente')
    data = []
    for item in pendientes:
        # Podrías agrupar por lista o devolver un array plano
        lista = item.lista_deseos
        # Nombre de producto
        nombre_prod = None
        stock_disp = 0
        if item.producto_id and item.producto:
            nombre_prod = item.producto.nombre
            stock_disp = item.producto.stock
        elif item.nombre_preproducto:
            nombre_prod = item.nombre_preproducto

        data.append({
            'item_deseo_id': item.id,
            'lista_id': lista.id,
            'cliente': lista.cliente,
            'nombre_lista': f"Lista #{lista.id} - {lista.cliente}",
            'nombre_producto': nombre_prod,
            'stock_disponible': stock_disp,
            'cantidad_necesaria': item.cantidad_necesaria,
            'precio_referencia': item.precio_referencia
        })
    return jsonify(data), 200

@app.route('/cotizacion_compra/crear_con_items', methods=['POST'])
@login_required
def crear_cotizacion_compra():
    data = request.get_json()
    nueva_cot = CotizacionCompra(
        proveedor=data['proveedor'],
        ruc_proveedor=data.get('ruc_proveedor', ''),
        forma_pago=data.get('forma_pago', ''),
        fecha_oferta=data.get('fecha_oferta'),  # si es un YYYY-MM-DD string
        validez_dias=data.get('validez_dias'),
        creado_por=current_user.id,
        # nuevo campo
        plazo_entrega_dias=data.get('plazo_entrega_dias')
        # por ej. lo almacenas en la columna "plazo_entrega_dias"
    )
    db.session.add(nueva_cot)
    db.session.commit()

    # Insertar los detalles ...
    for det in data.get('items', []):
        db.session.add(ProductoCotizacionCompra(
            cotizacion_compra_id=nueva_cot.id,
            item_deseo_id=det['item_deseo_id'],
            precio_ofrecido=det['precio_ofrecido'],
            cantidad=det['cantidad']
        ))
    db.session.commit()

    return jsonify({'mensaje': 'Cotización de Compra creada', 'id': nueva_cot.id}), 201

@app.route('/cotizaciones_compra_pendientes', methods=['GET'])
@login_required
def cotizaciones_compra_pendientes():
    """
    Devuelve todas las cotizaciones de compra que no estén 'Cerradas', 'Rechazadas'
    ni 'Procesada' ni 'Procesada Parcial'.
    """
    # Agrega "Procesada Parcial" en la lista
    cotizaciones = CotizacionCompra.query.filter(
        CotizacionCompra.estado.notin_([
            "Procesada", "Cerrada", "Rechazada", "Procesada Parcial"
        ])
    ).all()

    data = []
    for c in cotizaciones:
        # Solo productos en estado Pendiente
        productos_pend = [
            p for p in c.productos_cotizados 
            if p.estado == 'Pendiente'
        ]
        # Si no hay productos pendientes, omite
        if not productos_pend:
            continue

        data.append({
            'cotizacion_id': c.id,
            'proveedor': c.proveedor,
            'ruc_proveedor': c.ruc_proveedor,
            'estado': c.estado,
            'plazo_entrega_dias': c.plazo_entrega_dias,
            'fecha_oferta': str(c.fecha_oferta) if c.fecha_oferta else None,
            'forma_pago': c.forma_pago,
            'productos': [
                {
                    'id_detalle': p.id,
                    'item_deseo_id': p.item_deseo_id,
                    'nombre_producto': p.item_deseo.producto.nombre 
                        if p.item_deseo.producto else p.item_deseo.nombre_preproducto,
                    'precio_ofrecido': p.precio_ofrecido,
                    'cantidad': p.cantidad
                } 
                for p in productos_pend
            ]
        })

    return jsonify(data), 200

@app.route('/orden_compra/crear_desde_cotizacion', methods=['POST'])
@login_required
def crear_orden_compra_desde_cotizacion():
    data = request.json
    cotizacion_id = data.get('cotizacion_compra_id')
    productos = data.get('productos', []) 

    if not cotizacion_id or not productos:
        return jsonify({'error': 'Faltan datos obligatorios'}), 400

    cotizacion_compra = db.session.get(CotizacionCompra, cotizacion_id)
    if not cotizacion_compra:
        return jsonify({'error': 'Cotización de compra no encontrada'}), 404

    nueva_orden = OrdenCompra(
        cotizacion_compra_id=cotizacion_compra.id, 
        numero_orden=data['numero_orden'],
        fecha_orden=data['fecha_orden'],
        observaciones=data.get('observaciones', ''),
        proveedor=cotizacion_compra.proveedor,
        estado='Pendiente',
        creado_por=current_user.id
    )
    db.session.add(nueva_orden)
    db.session.commit()

    ids_seleccionados = [p['id_detalle'] for p in productos]
    detalles_procesados = []

    for id_det in ids_seleccionados:
        detalle = db.session.get(ProductoCotizacionCompra, id_det)
        if not detalle:
            continue

        detalle.estado = 'Comprado'
        detalle.item_deseo.estado = 'Ordenado'
        detalles_procesados.append(detalle)

        nuevo_producto_orden = ProductoOrdenCompra(
            orden_compra_id=nueva_orden.id,
            cotizacion_compra_item_id=detalle.id,
            item_deseo_id=detalle.item_deseo_id,
            precio_unitario=detalle.precio_ofrecido,
            cantidad=detalle.cantidad
        )
        db.session.add(nuevo_producto_orden)

        # Buscar otros detalles con mismo item_deseo_id (excepto el actual) y marcar como DESCARTADO
        otros = ProductoCotizacionCompra.query.filter(
            ProductoCotizacionCompra.item_deseo_id == detalle.item_deseo_id,
            ProductoCotizacionCompra.id != detalle.id,
            ProductoCotizacionCompra.estado == 'Pendiente'
        ).all()

        for otro in otros:
            otro.estado = 'Descartado'

    db.session.commit()

    # Verifica si todas las líneas de esta cotización están 'Comprado' o 'Descartado'
    estados_lineas = [p.estado for p in cotizacion_compra.productos_cotizados]
    if all(e in ['Comprado', 'Descartado'] for e in estados_lineas):
        cotizacion_compra.estado = 'Cerrada'
    elif any(e == 'Comprado' for e in estados_lineas):
        cotizacion_compra.estado = 'Procesada Parcial'
    else:
        cotizacion_compra.estado = 'Abierto'

    db.session.commit()

    return jsonify({'mensaje': 'Orden de Compra creada satisfactoriamente', 'orden_id': nueva_orden.id}), 201

@app.route('/cotizaciones_compra_buscar', methods=['GET'])
@login_required
def cotizaciones_compra_buscar():
    """
    Devuelve las Cotizaciones de Compra y sus productos que coincidan con el término de búsqueda 
    en el nombre del producto (item_deseo.producto.nombre o item_deseo.nombre_preproducto).
    Si no se envía 'termino', devuelve todas las cotizaciones en estado no procesado.
    """
    termino = request.args.get('termino', '').strip().lower()

    # 1. Buscar todas las cotizaciones 'pendientes' o 'abiertas'
    query = CotizacionCompra.query.filter(
        CotizacionCompra.estado.notin_(["Procesada", "Cerrada", "Rechazada"])
    )
    cotizaciones = query.all()

    # 2. Si no hay término, devolvemos directamente TODAS las cotizaciones pendientes
    if not termino:
        # Construimos la respuesta con TODOS sus productos
        data = []
        for c in cotizaciones:
            productos_json = []
            for p in c.productos_cotizados:
                # Obtener nombre
                if p.estado == 'Descartado':
                    continue
                if p.item_deseo.producto:
                    nombre_prod = p.item_deseo.producto.nombre
                else:
                    nombre_prod = p.item_deseo.nombre_preproducto or "Producto sin nombre"

                productos_json.append({
                    'id_detalle': p.id,
                    'nombre_producto': nombre_prod,
                    'precio_ofrecido': p.precio_ofrecido,
                    'cantidad': p.cantidad
                })
            
            data.append({
                'cotizacion_id': c.id,
                'proveedor': c.proveedor,
                'estado': c.estado,
                'plazo_entrega_dias': c.plazo_entrega_dias,
                'productos': productos_json
            })
        
        return jsonify(data), 200
    
    # 3. Si SÍ hay término, filtramos manualmente en cada cotización
    cotizaciones_filtradas = []
    for c in cotizaciones:
        productos_match = []
        for p in c.productos_cotizados:
            # Obtener el nombre
            if p.item_deseo.producto:
                nombre_prod = p.item_deseo.producto.nombre.lower()
            elif p.item_deseo.nombre_preproducto:
                nombre_prod = p.item_deseo.nombre_preproducto.lower()
            else:
                nombre_prod = ""

            # Ver si el término aparece en el nombre
            if nombre_prod and (termino in nombre_prod):
                productos_match.append(p)

        # Si hubo coincidencias, añadimos la cotización y SOLO esos productos al resultado,
        # sin alterar c.productos_cotizados en el objeto real
        if productos_match:
            cotizaciones_filtradas.append((c, productos_match))

    # 4. Construir la respuesta con las coincidencias
    data = []
    for (c, matches) in cotizaciones_filtradas:
        productos_json = []
        for p in matches:
            if p.item_deseo.producto:
                nombre_prod = p.item_deseo.producto.nombre
            else:
                nombre_prod = p.item_deseo.nombre_preproducto or "Producto sin nombre"
            
            productos_json.append({
                'id_detalle': p.id,
                'nombre_producto': nombre_prod,
                'precio_ofrecido': p.precio_ofrecido,
                'cantidad': p.cantidad
            })
        
        data.append({
            'cotizacion_id': c.id,
            'proveedor': c.proveedor,
            'estado': c.estado,
            'plazo_entrega_dias': c.plazo_entrega_dias,
            'productos': productos_json
        })

    return jsonify(data), 200

@app.route('/cotizacion_compra/rechazar/<int:cot_id>', methods=['POST'])
@login_required
def rechazar_cotizacion_compra(cot_id):
    cotizacion = db.session.get(CotizacionCompra, cot_id)
    if not cotizacion:
        return jsonify({'error': 'Cotización no encontrada'}), 404

    # Cambiamos estado a 'Rechazada'
    cotizacion.estado = 'Rechazada'
    db.session.commit()

    return jsonify({'mensaje': 'Cotización rechazada con éxito'}), 200

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
    app.run(host="0.0.0.0", port=5000, debug=True)

