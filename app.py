from flask import Flask, request, jsonify, render_template, redirect, url_for, flash, send_file
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from sqlalchemy.orm import Session
from werkzeug.security import generate_password_hash, check_password_hash
from flask_login import LoginManager, UserMixin, login_user, logout_user, current_user, login_required
import os
from datetime import datetime, timedelta, date
from werkzeug.utils import secure_filename
from dotenv import load_dotenv
import boto3
import json
from sqlalchemy import func, text, or_
from sqlalchemy.dialects.postgresql import TSVECTOR
from math import ceil
from sqlalchemy.orm import joinedload
from flask_login import login_required, current_user
from generate_excel import generate_excel_file
from datetime import datetime, timezone
import uuid

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
    #real
    #db_uri = "postgresql+psycopg2://postgres:HQX4meI4pYJGGxP2WL7w@proyecto-cotizaciones-db.c09o2u6em92b.us-east-1.rds.amazonaws.com:5432/proyecto_cotizaciones"
    #
    db_uri = "postgresql+psycopg2://postgres:Mijail28++@proyecto-cotizaciones-staging.c09o2u6em92b.us-east-1.rds.amazonaws.com:5432/proyecto_cotizaciones"

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
    fecha_de_registro = db.Column(db.DateTime, default=datetime.now(timezone.utc))
    activo = db.Column(db.Boolean, default=True)

    def set_password(self, contraseña):
        self.contraseña_hash = generate_password_hash(contraseña)

    def check_password(self, contraseña):

        return check_password_hash(self.contraseña_hash, contraseña)

class Cliente(db.Model):
    __tablename__ = 'cliente'
    id      = db.Column(db.Integer, primary_key=True)
    nombre  = db.Column(db.String(100), nullable=False, unique=True)
    ruc     = db.Column(db.String(11),   nullable=False, unique=True)
    # (otros campos opcionales que quieras guardar: dirección, ciudad, etc.)
    activo  = db.Column(db.Boolean, default=True)

    # Para relación “1 cliente → varios contactos” (opcional)
    contactos = db.relationship('Contacto', backref='cliente', lazy=True)

class Contacto(db.Model):
    __tablename__ = 'contacto'
    id           = db.Column(db.Integer, primary_key=True)
    cliente_id   = db.Column(db.Integer, db.ForeignKey('cliente.id'), nullable=False)
    solicitante  = db.Column(db.String(100), nullable=False)
    email        = db.Column(db.String(100), nullable=False)
    referencia   = db.Column(db.String(100), nullable=True)
    celular      = db.Column(db.String(15),  nullable=True)
    activo       = db.Column(db.Boolean, default=True)

class Proveedor(db.Model):
    __tablename__ = 'proveedor'
    id      = db.Column(db.Integer, primary_key=True)
    nombre  = db.Column(db.String(100), nullable=False, unique=True)
    ruc     = db.Column(db.String(11),   nullable=False, unique=True)
    activo  = db.Column(db.Boolean, default=True)

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
    __tablename__ = 'cotizacion'
    id = db.Column(db.Integer, primary_key=True)
    cliente_id = db.Column(db.Integer, db.ForeignKey('cliente.id'), nullable=False)
    cliente = db.relationship('Cliente', backref='cotizaciones')
    contacto_id = db.Column(db.Integer, db.ForeignKey('contacto.id'), nullable=True)
    contacto = db.relationship('Contacto', backref='cotizaciones')
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
    __tablename__ = 'producto_cotizacion'
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
    __tablename__ = 'orden_venta'
    id = db.Column(db.Integer, primary_key=True)
    cliente_id = db.Column(db.Integer, db.ForeignKey('cliente.id'), nullable=False)
    cliente = db.relationship('Cliente', backref='ordenes_venta')
    contacto_id = db.Column(db.Integer, db.ForeignKey('contacto.id'), nullable=True)
    contacto = db.relationship('Contacto', backref='ordenes_venta')
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
    __tablename__ = 'producto_orden'
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
    __tablename__ = 'seguimiento_orden'
    id = db.Column(db.Integer, primary_key=True)
    orden_id = db.Column(db.Integer, db.ForeignKey('orden_venta.id'), nullable=False)
    fecha = db.Column(db.String(10), nullable=False)
    estado = db.Column(db.String(20), nullable=False)  # Ejemplo: Pendiente, Empaquetado, Recibido
    comentario = db.Column(db.String(200), nullable=True)

class SeguimientoProducto(db.Model):
    __tablename__ = 'seguimiento_producto'
    id = db.Column(db.Integer, primary_key=True)
    producto_orden_id = db.Column(db.Integer, db.ForeignKey('producto_orden.id'), nullable=False)
    fecha = db.Column(db.String(10), nullable=False)
    estado = db.Column(db.String(20), nullable=False)  # Ejemplo: En Compra, En Tránsito, Recibido
    comentario = db.Column(db.String(200), nullable=True)

class Actividad(db.Model):
    __tablename__ = 'actividad'
    id = db.Column(db.Integer, primary_key=True)
    usuario_id = db.Column(db.Integer, db.ForeignKey('usuario.id'), nullable=False)
    accion = db.Column(db.String(200), nullable=False)
    fecha = db.Column(db.DateTime, default=datetime.now(timezone.utc))

class GuiaRemision(db.Model):
    __tablename__ = 'guia_remision'
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
    __tablename__ = 'producto_guia_remision'
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
    cliente_id = db.Column(db.Integer, db.ForeignKey('cliente.id'), nullable=False)
    cliente = db.relationship('Cliente', backref='listas_deseos')  
    fecha_creacion = db.Column(db.DateTime, default=datetime.now(timezone.utc))
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
    producto_id = db.Column(db.Integer, db.ForeignKey('producto.id'), nullable=True)
    nombre_preproducto = db.Column(db.String(150), nullable=True)
    cantidad_necesaria = db.Column(db.Integer, default=1)
    precio_referencia = db.Column(db.Float, default=0.0)
    estado_item = db.Column(db.String(20), default='Pendiente') 
    producto = db.relationship('Producto', lazy=True)

class CotizacionCompra(db.Model):
    __tablename__ = 'cotizacion_compra'

    id = db.Column(db.Integer, primary_key=True)
    proveedor_id = db.Column(db.Integer, db.ForeignKey('proveedor.id'), nullable=False)
    proveedor = db.relationship('Proveedor', backref='cotizaciones_compra')
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
    proveedor_id       = db.Column(db.Integer, db.ForeignKey('proveedor.id'), nullable=False)
    proveedor          = db.relationship('Proveedor', backref='ordenes_compra')
    estado = db.Column(db.String(20), default='Pendiente')
    creado_por = db.Column(db.Integer, db.ForeignKey('usuario.id'), nullable=False)
    productos = db.relationship('ProductoOrdenCompra', backref='orden_compra', lazy=True)
    cotizacion_compra = db.relationship('CotizacionCompra', backref='orden_compra', lazy=True)

class ProductoOrdenCompra(db.Model):
    __tablename__ = 'producto_orden_compra'

    id = db.Column(db.Integer, primary_key=True)
    orden_compra_id = db.Column(db.Integer, db.ForeignKey('orden_compra.id'), nullable=False)
    cotizacion_compra_item_id = db.Column(db.Integer, db.ForeignKey('producto_cotizacion_compra.id'), nullable=True)
    item_deseo_id = db.Column(db.Integer, db.ForeignKey('item_deseo.id'), nullable=True)
    precio_unitario = db.Column(db.Float, nullable=False, default=0)
    cantidad = db.Column(db.Integer, nullable=False, default=1)
    estado = db.Column(db.String(20), default='Pendiente')
    item_deseo = db.relationship('ItemDeseo', backref='productos_ordenados', lazy=True)

class GuiaRemisionCompra(db.Model):
    __tablename__ = 'guia_remision_compra'
    
    id = db.Column(db.Integer, primary_key=True)
    orden_compra_id = db.Column(db.Integer, db.ForeignKey('orden_compra.id'), nullable=False)
    
    numero_guia = db.Column(db.String(100), nullable=False, unique=True)
    fecha_emision = db.Column(db.DateTime, default=datetime.now(timezone.utc))
    
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

@app.route('/control_orden_compra')
@login_required
def control_orden_compra():
    return render_template('control_orden_compra.html')

@app.route('/productos', methods=['POST'])
@login_required
def crear_producto():
    data = request.get_json()
    codigo = data.get('codigo_item') or f"PRE-{uuid.uuid4().hex[:8]}"
    
    nuevo_producto = Producto(
        nombre=data['nombre'],
        descripcion=data.get('descripcion', 'Pre-producto generado en cotización'),
        precio=data['precio'],
        stock=data.get('stock', 0),
        proveedor=data.get('proveedor', ''),
        sucursal=data.get('sucursal', ''),
        almacen=data.get('almacen', ''),
        codigo_item=codigo,
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
@login_required
def obtener_productos():
    page        = request.args.get('page', 1, type=int)
    per_page    = request.args.get('per_page', 20, type=int)
    termino_raw = request.args.get('termino', '', type=str).strip()

    # 1) Base de la consulta: sólo productos activos
    query = Producto.query.filter(Producto.activo.is_(True))

    # 2) Si hay término de búsqueda, intentamos Full‐Text Search sobre nombre
    if termino_raw:
        # Separamos en tokens de al menos 3 caracteres
        tokens = [t.strip() for t in termino_raw.split() if len(t.strip()) > 2]

        if tokens:
            # Armar tsquery tipo: 'token1:* & token2:* & ...'
            tsquery = ' & '.join([f"{t}:*" for t in tokens])
            # Intento con search_vector sobre nombre
            query_fts = query.filter(
                Producto.search_vector.op('@@')(func.to_tsquery('spanish', tsquery))
            )

            # Si FTS NO devolvió nada, caemos a ILIKE sobre nombre, código o código de barras
            if query_fts.count() == 0:
                patron = f"%{termino_raw.lower()}%"
                query = query.filter(
                    or_(
                        func.lower(Producto.nombre).ilike(patron),
                        func.lower(Producto.codigo_item).ilike(patron),
                        func.lower(Producto.codigo_barra).ilike(patron)
                    )
                )
            else:
                # Si sí devolvió resultados FTS, seguimos con ellos
                query = query_fts

        else:
            # Si no hay tokens “largo” (p.ej. usuario tipea 1 o 2 letras), hacer ILIKE directo
            patron = f"%{termino_raw.lower()}%"
            query = query.filter(
                or_(
                    func.lower(Producto.nombre).ilike(patron),
                    func.lower(Producto.codigo_item).ilike(patron),
                    func.lower(Producto.codigo_barra).ilike(patron)
                )
            )

    # 3) Ordenar por ID ascendente (o cambia el campo si prefieres otro orden)
    query = query.order_by(Producto.id.asc())

    # 4) Aplicar paginación
    productos_paginados = query.paginate(page=page, per_page=per_page, error_out=False)

    # 5) Serializar al formato JSON que tu front‐end espera
    productos_json = [{
        'id'           : p.id,
        'nombre'       : p.nombre,
        'descripcion'  : p.descripcion,
        'precio'       : p.precio,
        'stock'        : p.stock,
        'proveedor'    : p.proveedor,
        'sucursal'     : p.sucursal,
        'almacen'      : p.almacen,
        'codigo_item'  : p.codigo_item,
        'codigo_barra' : p.codigo_barra,
        'unidad'       : p.unidad,
        'activo'       : p.activo
    } for p in productos_paginados.items]

    # 6) Devolver JSON con productos + info de paginación
    return jsonify({
        'productos'     : productos_json,
        'total'         : productos_paginados.total,
        'paginas'       : productos_paginados.pages,
        'pagina_actual' : productos_paginados.page
    })

@app.route('/productos/<int:id>', methods=['GET'])
@login_required
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
@login_required
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
@login_required
def desactivar_producto(id):
    producto = db.session.get(Producto, id)
    if producto is None:
        return jsonify({'mensaje': 'Producto no encontrado'}), 404

    producto.activo = False
    db.session.commit()
    return jsonify({'mensaje': 'Producto desactivado con éxito'}), 200

@app.route('/productos/buscar', methods=['GET'])
@login_required
def buscar_productos():
    """
    Búsqueda con:
        • Full-Text Search (columna search_vector, diccionario 'spanish')
        • Fallback a ILIKE cuando no hay hits FTS
        • Paginación estilo Flask-SQLAlchemy
    Parámetros GET:
        page, per_page, termino
    """
    page        = request.args.get('page', 1,  type=int)
    per_page    = request.args.get('per_page', 20, type=int)
    termino_raw = request.args.get('termino', '', type=str).strip()

    base_query = Producto.query.filter(Producto.activo.is_(True))

    # ───────────── BÚSQUEDA ─────────────
    if termino_raw:
        # separamos tokens de >2 caracteres
        tokens = [t.strip() for t in termino_raw.split() if len(t.strip()) > 2]

        if tokens:
            # cas:* & aca:* …
            tsquery = ' & '.join([f"{t}:*" for t in tokens])

            # intento FTS
            query_fts = base_query.filter(
                Producto.search_vector.op('@@')(func.to_tsquery('spanish', tsquery))
            )

            # ¿hubo resultados FTS?
            if query_fts.count():
                final_query = query_fts
            else:  # fallback a ILIKE
                patron = f"%{termino_raw.lower()}%"
                final_query = base_query.filter(
                    func.lower(Producto.nombre).ilike(patron)
                )
        else:
            # término demasiado corto ➜ directo ILIKE
            patron = f"%{termino_raw.lower()}%"
            final_query = base_query.filter(
                func.lower(Producto.nombre).ilike(patron)
            )
    else:
        final_query = base_query

    # ───────────── PAGINACIÓN ────────────
    productos_paginados = (
        final_query.order_by(Producto.id.asc())
                   .paginate(page=page, per_page=per_page, error_out=False)
    )

    # serializar
    productos_json = [{
        'id'          : p.id,
        'nombre'      : p.nombre,
        'descripcion' : p.descripcion,
        'precio'      : p.precio,
        'stock'       : p.stock,
        'proveedor'   : p.proveedor,
        'sucursal'    : p.sucursal,
        'almacen'     : p.almacen,
        'codigo_item' : p.codigo_item,
        'codigo_barra': p.codigo_barra,
        'unidad'      : p.unidad,
        'activo'      : p.activo
    } for p in productos_paginados.items]

    return jsonify({
        'productos'     : productos_json,
        'total'         : productos_paginados.total,
        'paginas'       : productos_paginados.pages,
        'pagina_actual' : productos_paginados.page
    })

@app.route('/guardar_cotizacion', methods=['POST'])
@login_required
def guardar_cotizacion():
    datos = request.get_json()

    # 1) Crear y guardar la cotización en BD usando los nuevos campos
    nueva_cotizacion = Cotizacion(
        cliente_id       = datos['cliente_id'],
        contacto_id      = datos.get('contacto_id'),
        fecha            = datos['fecha'],
        total            = datos['total'],
        plazo_entrega    = int(datos['plazo_entrega']),
        pago_credito     = datos['pago_credito'],
        tipo_cambio      = datos['tipo_cambio'],
        valor_cambio     = datos.get('valor_cambio', 1.0),
        lugar_entrega    = datos.get('lugar_entrega', ''),
        detalle_adicional= datos.get('detalle_adicional', ''),
        creado_por       = current_user.id
    )
    db.session.add(nueva_cotizacion)
    db.session.commit()  # Para obtener nueva_cotizacion.id

    # 2) Guardar los productos asociados
    for p in datos['productos']:
        prod_cot = ProductoCotizacion(
            cotizacion_id       = nueva_cotizacion.id,
            producto_id         = p.get('producto_id', p.get('id')),
            cantidad            = p['cantidad'],
            precio_unitario     = p['precio_unitario'],
            porcentaje_ganancia = p.get('porcentaje_ganancia', p.get('ganancia')),
            precio_total        = p['precio_total'],
            tipo_compra         = p['tipo_compra']
        )
        db.session.add(prod_cot)


    db.session.commit()

    # 3) Retornar JSON
    return jsonify({
        "id": nueva_cotizacion.id,
        "mensaje": "Cotización guardada con éxito"
    }), 201

@app.route('/productos/<int:id>', methods=['PUT'])
def actualizar_producto(id):
    data = request.get_json()
    prod = db.session.get(Producto, id)
    if 'precio' in data:
        prod.precio = data['precio']
    if 'unidad' in data:
        prod.unidad = data['unidad']
    db.session.commit()
    return jsonify({}), 200

    
@app.route('/descargar_excel/<int:cot_id>', methods=['GET'])
@login_required
def descargar_excel(cot_id):
    cot = db.session.get(Cotizacion, cot_id)
    if not cot:
        return "No existe la cotización", 404

    # 1) Productos asociados
    productos_excel = []
    for pc in cot.productos:  # relationship desde Cotizacion → ProductoCotizacion
        prod = db.session.get(Producto, pc.producto_id)
        nombre = prod.nombre if prod else f"Prod ID {pc.producto_id}"
        unidad = prod.unidad or "UND"

        productos_excel.append({
            "nombre_producto":  nombre,
            "unidad":           unidad,
            "cantidad":         pc.cantidad,
            "precio_unitario":  round(pc.precio_unitario, 2),
            "precio_total":     round(pc.precio_total, 2),
            "marca_modelo":     "",      # mejora futura
        })

    # 2) Info de cabecera, tirando de relaciones
    info_excel = {
        "cliente":          cot.cliente.nombre,
        "ruc":              cot.cliente.ruc,
        "solicitante":      cot.contacto.solicitante if cot.contacto else "",
        "email":            cot.contacto.email       if cot.contacto else "",
        "referencia":       cot.contacto.referencia  if cot.contacto else "",
        "celular":          cot.contacto.celular    if cot.contacto else "",
        "fecha":            cot.fecha,
        "tipo_cambio":      cot.tipo_cambio,
        "valor_cambio":     cot.valor_cambio,
        "plazo_entrega":    cot.plazo_entrega,
        "pago_credito":     cot.pago_credito,
        "lugar_entrega":    cot.lugar_entrega,
        "detalle_adicional":cot.detalle_adicional or "",
    }

    # 3) Generar el Excel con tu función habitual
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

@app.route('/clientes', methods=['GET'])
@login_required
def buscar_clientes():
    term = request.args.get('term','').strip()
    q = Cliente.query.filter(Cliente.activo.is_(True))
    if term:
        like = f"%{term}%"
        q = q.filter(or_(Cliente.nombre.ilike(like),
                         Cliente.ruc.ilike(like)))
    resultados = q.limit(10).all()
    return jsonify([{'id': c.id,'nombre':c.nombre,'ruc':c.ruc} for c in resultados])

@app.route('/clientes', methods=['POST'])
def crear_cliente():
    data = request.get_json()
    # 1) Compruebo si ya existe ese RUC
    existe = Cliente.query.filter_by(ruc=data['ruc']).first()
    if existe:
        return jsonify({
            'error': 'Ya existe un cliente con ese RUC.',
            'cliente_id': existe.id,
            'nombre': existe.nombre
        }), 409

    # 2) Si no existe, lo creo
    nuevo = Cliente(
      nombre = data['nombre'],
      ruc    = data['ruc'],
      activo = True
    )
    db.session.add(nuevo)
    db.session.commit()
    return jsonify({
      'id': nuevo.id,
      'nombre': nuevo.nombre,
      'ruc': nuevo.ruc
    }), 201

@app.route('/clientes/<int:cliente_id>/contactos', methods=['GET'])
@login_required
def listar_contactos(cliente_id):
    contactos = Contacto.query.filter_by(cliente_id=cliente_id,activo=True).all()
    return jsonify([{'id':ct.id,'solicitante':ct.solicitante,'email':ct.email,
                     'referencia':ct.referencia,'celular':ct.celular}
                    for ct in contactos])

@app.route('/clientes/<int:cliente_id>/contactos', methods=['POST'])
@login_required
def crear_contacto(cliente_id):
    data = request.get_json() or request.form
    ct = Contacto(cliente_id=cliente_id,
                  solicitante=data['solicitante'],
                  email=data['email'],
                  referencia=data.get('referencia'),
                  celular=data.get('celular'))
    db.session.add(ct); db.session.commit()
    return jsonify({'id':ct.id,'solicitante':ct.solicitante,'email':ct.email,
                    'referencia':ct.referencia,'celular':ct.celular})

@app.route('/cotizacion/<int:id>', methods=['GET'])
@login_required
def obtener_cotizacion(id):
    # 1) ¿Ya existe orden de venta?
    existe = db.session.execute(
        text("SELECT id FROM orden_venta WHERE cotizacion_id = :cid LIMIT 1"),
        {'cid': id}
    ).fetchone()
    if existe:
        return jsonify({
            'mensaje': 'Cotización ya convertida',
            'orden_venta_id': existe[0]
        }), 400

    # 2) Buscamos la cotización
    cot = db.session.get(Cotizacion, id)
    if not cot:
        return jsonify({'mensaje': 'Cotización no encontrada'}), 200

    # 3) Si está rechazada, devolvemos mensaje
    if cot.estado == 'Rechazada':
        return jsonify({'mensaje': 'Cotización rechazada'}), 200

    # 4) Si llegamos aquí, es Pendiente (o Finalizado, si quieres permitirlo)
    #    armamos los productos y devolvemos todo lo que tu front necesita:

    productos = []
    for pc in cot.productos:
        prod = db.session.get(Producto, pc.producto_id)
        productos.append({
            'id':              pc.producto_id,
            'nombre':          prod.nombre if prod else f"ID {pc.producto_id}",
            'precio_unitario': pc.precio_unitario,
            'cantidad':        pc.cantidad,
            'precio_total':    pc.precio_total
        })

    usuario = db.session.get(Usuario, cot.creado_por)

    return jsonify({
        'id':         cot.id,
        'cliente':    cot.cliente.nombre,
        'ruc':        cot.cliente.ruc,
        'fecha':      cot.fecha,
        'estado':     cot.estado,
        'creado_por': usuario.nombre_usuario if usuario else 'Desconocido',
        'productos':  productos
    }), 200

@app.route('/cotizaciones', methods=['GET'])
@login_required
def obtener_cotizaciones_paginadas():
    page     = request.args.get('page',     1,  type=int)
    per_page = request.args.get('per_page', 20, type=int)

    pagination = Cotizacion.query \
        .order_by(Cotizacion.id.desc()) \
        .paginate(page=page, per_page=per_page, error_out=False)

    cotizaciones_data = []
    for cot in pagination.items:
        # relación SQLAlchemy a Cliente y Usuario
        cliente = cot.cliente
        usuario = db.session.get(Usuario, cot.creado_por)

        cotizaciones_data.append({
            'id':                 cot.id,
            'cliente':            cliente.nombre,
            'ruc':                cliente.ruc,
            'numero_cotizacion':  cot.id,            # aquí usas el id
            'fecha':              cot.fecha,         # ya es String
            'monto':              float(cot.total),  # tu total
            'moneda':             cot.tipo_cambio,   # tu campo de moneda
            'estado':             cot.estado,
            'creado_por':         usuario.nombre_usuario if usuario else 'Desconocido'
        })

    return jsonify({
        'cotizaciones':  cotizaciones_data,
        'pagina_actual': pagination.page,
        'total':         pagination.total,
        'paginas':       pagination.pages
    })

@app.route('/transformar_orden_venta/<int:cotizacion_id>', methods=['POST'])
@login_required
def transformar_orden_venta(cotizacion_id):
    # 1) Cargar la cotización
    cot = db.session.get(Cotizacion, cotizacion_id)
    if not cot:
        return jsonify({'mensaje': 'Cotización no encontrada'}), 404

    # 2) Leer payload
    datos         = request.get_json() or {}
    productos_sel = datos.get('productos')
    if not productos_sel:
        return jsonify({'mensaje': 'No se enviaron productos'}), 400

    # 3) Crear cabecera de la orden
    nueva_orden = OrdenVenta(
        cliente_id          = cot.cliente_id,
        contacto_id         = cot.contacto_id,
        fecha               = datetime.today().strftime('%d/%m/%Y'),
        total               = sum(float(p['precio_total']) for p in productos_sel),
        estado              = 'En Proceso',
        cotizacion_id       = cot.id,
        creado_por          = current_user.id,
        numero_orden_compra = datos.get('numero_orden_compra', ''),
        fecha_orden_compra  = datos.get('fecha_orden_compra', '')
    )
    db.session.add(nueva_orden)
    db.session.commit()  # ya tenemos nueva_orden.id

    # 4) Agregar líneas y ajustar stock
    faltantes = []
    for p in productos_sel:
        prod = db.session.get(Producto, int(p['id']))
        if not prod:
            continue

        requerido = int(p['cantidad'])
        disponible = prod.stock or 0

        servido = min(requerido, disponible)
        faltante = max(0, requerido - disponible)

        linea = ProductoOrden(
            orden_id        = nueva_orden.id,
            producto_id     = prod.id,
            cantidad        = servido,
            precio_unitario = float(p['precio_unitario']),
            precio_total    = float(p['precio_unitario']) * servido,
            tipo_compra     = 'stock',
            estado          = 'Pendiente'
        )
        db.session.add(linea)
        prod.stock = disponible - servido

        if faltante:
            faltantes.append({
                'producto_id': prod.id,
                'cantidad_faltante': faltante
            })

    # 5) Actualizar estado de la cotización
    if len(productos_sel) >= len(cot.productos):
        cot.estado = 'Finalizado Total'
    else:
        cot.estado = 'Finalizado Parcial'

    db.session.commit()

    return jsonify({
        'mensaje': 'Orden de Venta generada correctamente.',
        'estado': cot.estado,
        'productos_faltantes': faltantes
    }), 200

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
    page     = request.args.get('page',     1,  type=int)
    per_page = request.args.get('per_page', 20, type=int)

    pag = OrdenVenta.query.\
        options(
            joinedload(OrdenVenta.cliente),
            joinedload(OrdenVenta.contacto),
            joinedload(OrdenVenta.creador),
            joinedload(OrdenVenta.cotizacion)
        ).\
        order_by(OrdenVenta.id.desc()).\
        paginate(page=page, per_page=per_page, error_out=False)

    hoy = datetime.today().date()
    out = []
    for ordv in pag.items:
        # datos de cliente y contacto
        cliente  = ordv.cliente
        contacto = ordv.contacto
        creador  = ordv.creador
        cot      = ordv.cotizacion

        tipo_cambio   = cot.tipo_cambio   if cot else "Soles"
        plazo_entrega = cot.plazo_entrega if cot else "No definido"
        pago_credito  = cot.pago_credito  if cot else "No definido"
        valor_cambio  = cot.valor_cambio  if cot else 1.0
        total_soles   = ordv.total

        # conversión a USD/EUR
        total_conv = None
        tc_low = tipo_cambio.lower()
        if tc_low == "dólares":
            total_conv = f"${total_soles/valor_cambio:.2f} (USD)"
        elif tc_low == "euros":
            total_conv = f"€{total_soles/valor_cambio:.2f} (EUR)"

        # cálculo de “en tiempo”
        est_tiempo = "Fecha no definida"
        if ordv.fecha_orden_compra and cot and isinstance(cot.plazo_entrega, int):
            try:
                fo = datetime.strptime(ordv.fecha_orden_compra, "%Y-%m-%d").date()
                limite = fo + timedelta(days=cot.plazo_entrega)
                if limite > hoy:       est_tiempo = "A tiempo"
                elif limite == hoy:    est_tiempo = "Tiempo límite"
                else:                  est_tiempo = "A destiempo"
            except:
                est_tiempo = "Error en fecha"

        out.append({
            'id':                ordv.id,
            'cliente':           cliente.nombre if cliente else '',
            'solicitante':       contacto.solicitante if contacto else '',
            'fecha_orden_compra':ordv.fecha_orden_compra or 'No definida',
            'estado':            ordv.estado,
            'estado_tiempo':     est_tiempo,
            'total':             f"S/. {total_soles:.2f}",
            'tipo_cambio':       tipo_cambio,
            'total_convertido':  total_conv,
            'plazo_entrega':     plazo_entrega,
            'pago_credito':      pago_credito,
            'creado_por':        creador.nombre_usuario if creador else 'Desconocido',
            'numero_orden_compra': ordv.numero_orden_compra
        })

    return jsonify({
        'ordenes':        out,
        'pagina_actual':  pag.page,
        'total_paginas':  pag.pages,
        'total_registros':pag.total
    })

@app.route('/orden_venta/<int:orden_id>', methods=['GET'])
@login_required
def obtener_orden(orden_id):
    ordv = db.session.get(OrdenVenta, orden_id)
    if not ordv:
        return jsonify({'mensaje': 'Orden no encontrada'}), 404

    cliente  = ordv.cliente
    contacto = ordv.contacto

    productos = []
    for line in ordv.productos:
        prod = db.session.get(Producto, line.producto_id)
        productos.append({
            'id':             line.id,
            'nombre':         prod.nombre if prod else 'No encontrado',
            'stock':          prod.stock  if prod else None,
            'cantidad':       line.cantidad,
            'precio_unitario':line.precio_unitario,
            'precio_total':   line.precio_total,
            'tipo_compra':    line.tipo_compra
        })

    return jsonify({
        'id':                 ordv.id,
        'cliente':            cliente.nombre if cliente else '',
        'ruc':                cliente.ruc     if cliente else '',
        'solicitante':        contacto.solicitante if contacto else '',
        'email':              contacto.email       if contacto else '',
        'referencia':         contacto.referencia  if contacto else '',
        'celular':            contacto.celular    if contacto else '',
        'fecha':              ordv.fecha,
        'estado':             ordv.estado,
        'numero_orden_compra':ordv.numero_orden_compra,
        'fecha_orden_compra': ordv.fecha_orden_compra,
        'productos':          productos
    })

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
    orden = db.session.get(OrdenVenta, orden_id)
    orden.estado = calcular_estado_orden(orden)
    db.session.commit()

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
    orden = guia.orden_venta           # gracias al backref
    orden.estado = calcular_estado_orden(orden)
    db.session.commit()
    return jsonify({'mensaje': 'Guía actualizada correctamente'}), 200

# ---------- helpers de Órdenes ----------
def calcular_estado_orden(orden: OrdenVenta) -> str:
    """
    Devuelve el estado ‘En Proceso / Parcial / Completada / Observaciones’.
    Se apoya en las guías de remisión existentes.
    """
    if not orden.guias_remision:
        return "En Proceso"

    total_prod  = sum(p.cantidad for p in orden.productos)
    total_enviado = 0
    hay_obs, hay_pend = False, False

    for guia in orden.guias_remision:
        if guia.estado.lower() in ("recibido", "entregado"):
            pass
        elif guia.estado.lower() == "recibido con observaciones":
            hay_obs = True
        else:  # pendiente
            hay_pend = True

        total_enviado += sum(pg.cantidad for pg in guia.productos)

    if total_enviado < total_prod:
        return "Parcial"

    # todo enviado:
    if hay_obs:
        return "Observaciones"
    if hay_pend:
        return "Parcial"           # aún falta cerrar las guías
    return "Completada"

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


# ETAPA DE COMPRA
@app.route('/lista_deseos', methods=['POST'])
@login_required
def crear_lista_deseos():
    data = request.get_json() or {}
    # Debe venir cliente_id, no nombre
    cliente_id = data.get('cliente_id')
    if not cliente_id:
        return jsonify({'mensaje': 'Falta el cliente_id'}), 400

    nueva_lista = ListaDeseos(
        cliente_id = cliente_id,
        creado_por = current_user.id,
        prioridad  = data.get('prioridad', 'Normal'),
        comentario = data.get('comentario', '')
    )
    db.session.add(nueva_lista)
    db.session.commit()

    return jsonify({
      'mensaje': 'Lista de Deseos creada',
      'id':       nueva_lista.id
    }), 201

@app.route('/lista_deseos/<int:lista_id>', methods=['GET'])
@login_required
def obtener_lista_deseos(lista_id):
    lista = db.session.get(ListaDeseos, lista_id)
    if not lista:
        return jsonify({'error': 'No existe esta lista'}), 404

    # Serializar items...
    items_data = []
    for item in lista.items:
        if item.producto:
            nombre = item.producto.nombre
            stock  = item.producto.stock
        else:
            nombre = item.nombre_preproducto
            stock  = None
        items_data.append({
            'id':                item.id,
            'producto_id':       item.producto_id,
            'nombre':            nombre,
            'cantidad_necesaria':item.cantidad_necesaria,
            'precio_referencia': item.precio_referencia,
            'estado_item':       item.estado_item
        })

    return jsonify({
        'id':             lista.id,
        'cliente':        lista.cliente.nombre,         # nombre real
        'fecha_creacion': lista.fecha_creacion.isoformat(),
        'prioridad':      lista.prioridad,
        'comentario':     lista.comentario,
        'estado':         lista.estado,
        'items':          items_data
    }), 200

@app.route('/lista_deseos/crear_con_items', methods=['POST'])
@login_required
def crear_lista_deseos_con_items():
    data = request.get_json() or {}
    cliente_id = data.get('cliente_id')
    if not cliente_id:
        return jsonify({'mensaje':'Falta el cliente_id'}), 400

    lista = ListaDeseos(
        cliente_id  = cliente_id,
        creado_por  = current_user.id,
        prioridad   = data.get('prioridad','Normal'),
        comentario  = data.get('comentario','')
    )
    db.session.add(lista)
    db.session.commit()

    for it in data.get('items', []):
        nuevo = ItemDeseo(
            lista_deseos_id      = lista.id,
            producto_id          = it.get('producto_id'),
            nombre_preproducto   = it.get('nombre_preproducto'),
            cantidad_necesaria   = it.get('cantidad_necesaria',1),
            precio_referencia    = it.get('precio_referencia',0.0)
        )
        db.session.add(nuevo)

    db.session.commit()
    return jsonify({
        'mensaje': 'Lista de deseos creada con éxito',
        'lista_deseos_id': lista.id
    }), 201

@app.route('/items_deseo_pendientes', methods=['GET'])
@login_required
def items_deseo_pendientes():
    pendientes = (
        db.session.query(ItemDeseo)
        .filter(ItemDeseo.estado_item == 'Pendiente')           # <-- aquí
        .join(ListaDeseos, ListaDeseos.id == ItemDeseo.lista_deseos_id)
        .filter(ListaDeseos.estado == 'Abierto')                # opcional: solo listas abiertas
        .all()
    )

    out = []
    for item in pendientes:
        lista  = item.lista_deseos
        cliente_nombre = lista.cliente.nombre
        if item.producto:
            nombre = item.producto.nombre
            stock  = item.producto.stock
        else:
            nombre = item.nombre_preproducto
            stock  = None

        out.append({
            'item_deseo_id':     item.id,
            'lista_id':          lista.id,
            'cliente':           cliente_nombre,
            'nombre_lista':      f"Lista #{lista.id} – {cliente_nombre}",
            'nombre_producto':   nombre,
            'stock_disponible':  stock,
            'cantidad_necesaria':item.cantidad_necesaria,
            'precio_referencia': item.precio_referencia
        })

    return jsonify(out), 200

@app.route('/cotizacion_compra/crear_con_items', methods=['POST'])
@login_required
def crear_cotizacion_compra():
    data = request.get_json() or {}
    prov_id = data.get('proveedor_id')
    if not prov_id:
        return jsonify({'error': 'Falta el proveedor'}), 400

    # 1) Cabecera
    nueva_cot = CotizacionCompra(
        proveedor_id       = prov_id,
        forma_pago         = data.get('forma_pago', ''),
        fecha_oferta       = data.get('fecha_oferta'),    # 'YYYY-MM-DD'
        validez_dias       = data.get('validez_dias'),
        plazo_entrega_dias = data.get('plazo_entrega_dias'),
        creado_por         = current_user.id
    )
    db.session.add(nueva_cot)
    db.session.commit()  # para tener nueva_cot.id

    # 2) Detalles
    for det in data.get('items', []):
        db.session.add(ProductoCotizacionCompra(
            cotizacion_compra_id = nueva_cot.id,
            item_deseo_id        = det['item_deseo_id'],
            precio_ofrecido      = det['precio_ofrecido'],
            cantidad             = det['cantidad']
        ))
    db.session.commit()

    return jsonify({
      'mensaje': 'Cotización de Compra creada',
      'id': nueva_cot.id
    }), 201

@app.route('/proveedores', methods=['GET'])
@login_required
def buscar_proveedores():
    term = request.args.get('term','').strip()
    q = Proveedor.query.filter(Proveedor.activo.is_(True))
    if term:
        like = f"%{term}%"
        q = q.filter(
            or_(
              Proveedor.nombre.ilike(like),
              Proveedor.ruc.ilike(like)
            )
        )
    resultados = q.limit(10).all()
    return jsonify([
        {'id': p.id, 'nombre': p.nombre, 'ruc': p.ruc}
        for p in resultados
    ])

@app.route('/proveedores', methods=['POST'])
@login_required
def crear_proveedor():
    data = request.get_json() or {}
    nombre = data.get('nombre','').strip()
    ruc    = data.get('ruc','').strip()
    if not nombre or not ruc:
        return jsonify({'mensaje':'Faltan nombre o RUC'}), 400
    # opcional: validar unicidad
    p = Proveedor(nombre=nombre, ruc=ruc)
    db.session.add(p)
    db.session.commit()
    return jsonify({'id': p.id, 'nombre': p.nombre, 'ruc': p.ruc}), 201

@app.route('/cotizaciones_compra_pendientes', methods=['GET'])
@login_required
def cotizaciones_compra_pendientes():
    cotizaciones = CotizacionCompra.query.filter(
        CotizacionCompra.estado.notin_(["Procesada","Cerrada","Rechazada","Procesada Parcial"])
    ).all()

    data = []
    for c in cotizaciones:
        pendientes = [p for p in c.productos_cotizados if p.estado=='Pendiente']
        if not pendientes:
            continue

        data.append({
            'cotizacion_id':      c.id,
            'proveedor':          c.proveedor.nombre,
            'ruc_proveedor':      c.proveedor.ruc,           # <- aquí
            'estado':             c.estado,
            'plazo_entrega_dias': c.plazo_entrega_dias,
            'forma_pago':         c.forma_pago,
            'fecha_oferta':       c.fecha_oferta.isoformat() if c.fecha_oferta else None,
            'validez_dias':       c.validez_dias,
            'productos': [
                {
                  'id_detalle':      p.id,
                  'item_deseo_id':   p.item_deseo_id,
                  'nombre_producto': (p.item_deseo.producto.nombre
                                      if p.item_deseo.producto
                                      else p.item_deseo.nombre_preproducto),
                  'precio_ofrecido': p.precio_ofrecido,
                  'cantidad':        p.cantidad
                }
                for p in pendientes
            ]
        })

    return jsonify(data), 200


@app.route('/orden_compra/crear_desde_cotizacion', methods=['POST'])
@login_required
def crear_orden_compra_desde_cotizacion():
    data = request.get_json() or {}
    cot_id    = data.get('cotizacion_compra_id')
    productos = data.get('productos', [])
    nro       = data.get('numero_orden', '').strip()
    fecha_str = data.get('fecha_orden', '').strip()
    obs       = data.get('observaciones', '').strip()

    if not cot_id or not productos or not nro or not fecha_str:
        return jsonify({'error': 'Faltan datos obligatorios'}), 400

    cot = db.session.get(CotizacionCompra, cot_id)
    if not cot:
        return jsonify({'error': 'Cotización de compra no encontrada'}), 404

    # parsear fecha
    try:
        fecha_orden = datetime.strptime(fecha_str, '%Y-%m-%d').date()
    except ValueError:
        return jsonify({'error': 'Formato de fecha inválido'}), 400

    # crear cabecera
    nueva_orden = OrdenCompra(
        cotizacion_compra_id = cot.id,
        numero_orden         = nro,
        fecha_orden          = fecha_orden,
        observaciones        = obs,
        proveedor_id         = cot.proveedor_id,
        estado               = 'Pendiente',
        creado_por           = current_user.id
    )
    db.session.add(nueva_orden)
    db.session.commit()

    # procesar cada detalle
    for det in productos:
        detalle = db.session.get(ProductoCotizacionCompra, det['id_detalle'])
        if not detalle or detalle.estado != 'Pendiente':
            continue

        # marcar detalle de cotización y de lista deseos
        detalle.estado = 'Comprado'
        detalle.item_deseo.estado_item = 'Ordenado'

        # crear línea de orden
        nuevo = ProductoOrdenCompra(
            orden_compra_id           = nueva_orden.id,
            cotizacion_compra_item_id = detalle.id,
            item_deseo_id             = detalle.item_deseo_id,
            precio_unitario           = detalle.precio_ofrecido,
            cantidad                  = detalle.cantidad
        )
        db.session.add(nuevo)

        # descartar otras ofertas del mismo item
        ProductoCotizacionCompra.query.filter(
            ProductoCotizacionCompra.item_deseo_id == detalle.item_deseo_id,
            ProductoCotizacionCompra.id != detalle.id,
            ProductoCotizacionCompra.estado == 'Pendiente'
        ).update({ 'estado': 'Descartado' }, synchronize_session=False)

    db.session.commit()

    # actualizar estado de la cotización de compra
    estados = [p.estado for p in cot.productos_cotizados]
    if all(e in ['Comprado','Descartado'] for e in estados):
        cot.estado = 'Cerrada'
    elif any(e == 'Comprado' for e in estados):
        cot.estado = 'Procesada Parcial'
    else:
        cot.estado = 'Abierto'
    db.session.commit()

    return jsonify({
        'mensaje':  'Orden de Compra creada satisfactoriamente',
        'orden_id': nueva_orden.id
    }), 201

@app.route('/cotizaciones_compra_buscar', methods=['GET'])
@login_required
def cotizaciones_compra_buscar():
    termino = request.args.get('termino','').strip().lower()
    todas = CotizacionCompra.query.filter(
        CotizacionCompra.estado.notin_(["Procesada","Cerrada","Rechazada"])
    ).all()

    # si no hay término, devolvemos todas
    if not termino:
        return jsonify([
          { **c } for c in cotizaciones_compra_pendientes().json
        ]), 200

    # filtrar por producto
    filtradas = []
    for c in todas:
        match = []
        for p in c.productos_cotizados:
            nombre = (
                p.item_deseo.producto.nombre.lower()
                if p.item_deseo.producto else
                (p.item_deseo.nombre_preproducto or '').lower()
            )
            # usa and e in en Python
            if termino and termino in nombre and p.estado == 'Pendiente':
                match.append(p)

        if match:
            filtradas.append({
                'cotizacion_id': c.id,
                'proveedor':     c.proveedor,
                'ruc_proveedor': c.ruc_proveedor,
                'estado':        c.estado,
                'plazo_entrega_dias': c.plazo_entrega_dias,
                'forma_pago':    c.forma_pago,
                'fecha_oferta':  c.fecha_oferta.isoformat() if c.fecha_oferta else None,
                'validez_dias':  c.validez_dias,
                'productos': [
                    {
                        'id_detalle':      p.id,
                        'item_deseo_id':   p.item_deseo_id,
                        'nombre_producto': p.item_deseo.producto.nombre if p.item_deseo.producto else p.item_deseo.nombre_preproducto,
                        'precio_ofrecido': p.precio_ofrecido,
                        'cantidad':        p.cantidad
                    }
                    for p in match
                ]
            })
    return jsonify(filtradas), 200

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

@app.route('/orden_compra', methods=['GET'])
@login_required
def listar_ordenes_compra():
    page      = request.args.get('page', 1, type=int)
    per_page  = request.args.get('per_page', 20, type=int)
    proveedor = request.args.get('proveedor', type=str)
    estado    = request.args.get('estado',   type=str)

    # Base query: unimos con Proveedor para filtrar por nombre
    query = OrdenCompra.query.join(Proveedor)
    if proveedor:
        query = query.filter(Proveedor.nombre.ilike(f'%{proveedor}%'))
    if estado:
        query = query.filter(OrdenCompra.estado == estado)

    pag = query.order_by(OrdenCompra.id.desc()) \
               .paginate(page=page, per_page=per_page, error_out=False)

    ordenes = []
    for oc in pag.items:
        usuario = db.session.get(Usuario, oc.creado_por)

        # Monto total de la orden (suma de líneas)
        monto = sum(l.precio_unitario * l.cantidad for l in oc.productos)
        # Días transcurridos desde la fecha de orden
        dias  = (date.today() - oc.fecha_orden).days

        ordenes.append({
            'id':                  oc.id,
            'cliente':             oc.proveedor.nombre,
            'ruc_proveedor':       oc.proveedor.ruc,
            'numero_orden':        oc.numero_orden,
            'numero_cotizacion':   oc.cotizacion_compra_id,
            'fecha':               oc.fecha_orden.isoformat(),
            'monto':               round(monto, 2),
            'moneda':              'Soles',  # más adelante podrías hacerlo dinámico
            'estado':              oc.estado,
            'solicitante':         usuario.nombre_usuario if usuario else 'Desconocido',
            'tiempo_dias':         dias
        })

    return jsonify({
        'ordenes':       ordenes,
        'pagina_actual': pag.page,
        'paginas':       pag.pages,
        'total':         pag.total
    }), 200

# 2) Detalle de una OC (GET /orden_compra/<id>)
@app.route('/orden_compra/<int:oc_id>', methods=['GET'])
@login_required
def detalle_orden_compra(oc_id):
    oc = db.session.get(OrdenCompra, oc_id)
    if not oc:
        return jsonify({'error': 'Orden de compra no encontrada'}), 404

    productos = []
    for l in oc.productos:
        # calcula cuánto ya se recibió de esta línea
        recibido = db.session.query(
            func.coalesce(func.sum(ProductoGuiaRemisionCompra.cantidad_recibida), 0)
        ).join(GuiaRemisionCompra,
               GuiaRemisionCompra.id == ProductoGuiaRemisionCompra.guia_remision_compra_id
        ).filter(
            GuiaRemisionCompra.orden_compra_id == oc_id,
            ProductoGuiaRemisionCompra.producto_orden_compra_id == l.id
        ).scalar() or 0

        # nombre real del producto
        if hasattr(l, 'item_deseo') and l.item_deseo and l.item_deseo.producto:
            nombre = l.item_deseo.producto.nombre
        else:
            nombre = getattr(l, 'nombre_preproducto', f"P.O.C. ID {l.id}")

        productos.append({
            'producto_orden_compra_id': l.id,
            'nombre_producto':          nombre,
            'cantidad_ordenada':        l.cantidad,
            'cantidad_recibida':        recibido,
            'precio_unitario':          l.precio_unitario
        })

    return jsonify({
        'id':             oc.id,
        'numero_orden':   oc.numero_orden,
        'fecha_orden':    oc.fecha_orden.isoformat(),
        'proveedor':      oc.proveedor.nombre,
        'ruc_proveedor':  oc.proveedor.ruc,
        'estado':         oc.estado,
        'observaciones':  oc.observaciones or '',
        'productos':      productos
    }), 200

# 3) Listar Guías de Compra de una OC (GET /orden_compra/<id>/guias_remision)
@app.route('/orden_compra/<int:oc_id>/guias_remision', methods=['GET'])
@login_required
def listar_guias_compra(oc_id):
    guias = GuiaRemisionCompra.query.filter_by(
        orden_compra_id=oc_id, activo=True
    ).all()
    salida = [{
        'id': g.id,
        'numero_guia': g.numero_guia,
        'fecha_emision': g.fecha_emision.isoformat(),
        'estado': g.estado
    } for g in guias]
    return jsonify(salida)

def actualizar_estado_orden(oc_id):
    """Recalcula y persiste el estado de la OC según sus guías."""
    oc = db.session.get(OrdenCompra, oc_id)
    if not oc:
        return
    guias = GuiaRemisionCompra.query.filter_by(
        orden_compra_id=oc_id, activo=True
    ).all()
    if any(g.estado == 'Emitida' for g in guias):
        oc.estado = 'En Proceso'
    if guias and all(g.estado == 'Cerrada' for g in guias):
        oc.estado = 'Finalizado'
    db.session.commit()


# 4) Crear Guía de Compra (POST /orden_compra/<id>/guias_remision)
@app.route('/orden_compra/<int:oc_id>/guias_remision', methods=['POST'])
@login_required
def crear_guia_compra(oc_id):
    data   = request.get_json() or {}
    numero = data.get('numero_guia')
    lines  = data.get('productos', [])
    if not numero or not lines:
        return jsonify({'error':'Datos incompletos'}),400

    oc = db.session.get(OrdenCompra, oc_id)
    if not oc:
        return jsonify({'error':'OC no encontrada'}),404

    # Validar cantidades
    for l in lines:
        poc_id = l['producto_orden_compra_id']
        nueva  = int(l['cantidad'])
        poc    = db.session.get(ProductoOrdenCompra, poc_id)
        if not poc or poc.orden_compra_id != oc_id:
            return jsonify({'error':f'Producto {poc_id} inválido'}),400

        recibido_prev = db.session.query(
            func.coalesce(func.sum(ProductoGuiaRemisionCompra.cantidad_recibida),0)
        ).filter_by(producto_orden_compra_id=poc_id).scalar() or 0

        if recibido_prev + nueva > poc.cantidad:
            return jsonify({
                'error': f"No puedes recibir {nueva} (ya lleva {recibido_prev}) "
                         f"porque ordenaste {poc.cantidad}"
            }),400

    # Crear cabecera
    guia = GuiaRemisionCompra(
        orden_compra_id=oc_id,
        numero_guia=numero,
        fecha_emision=datetime.now(timezone.utc),
        estado='Pendiente'
    )
    db.session.add(guia)
    db.session.flush()

    # Detalles
    for l in lines:
        db.session.add(ProductoGuiaRemisionCompra(
            guia_remision_compra_id=guia.id,
            producto_orden_compra_id=l['producto_orden_compra_id'],
            cantidad_recibida=l['cantidad']
        ))
    db.session.commit()
    # 3) Recalcular estado de la orden
    actualizar_estado_orden(oc_id)

    return jsonify({'mensaje':'Guía creada','id':guia.id}),201

# 5) Detalle de una Guía de Compra (GET /guia_remision_compra/<id>)
@app.route('/guia_remision_compra/<int:gc_id>', methods=['GET'])
@login_required
def detalle_guia_compra(gc_id):
    gc = db.session.get(GuiaRemisionCompra, gc_id)
    if not gc:
        return jsonify({'error':'Guía no encontrada'}), 404

    productos = []
    for linea in gc.productos:
        # 1) Recupero la línea de orden de compra
        poc = db.session.get(ProductoOrdenCompra, linea.producto_orden_compra_id)
        # 2) Nombre real (sea producto o pre-producto)
        if poc.item_deseo.producto:
            nombre = poc.item_deseo.producto.nombre
        else:
            nombre = poc.item_deseo.nombre_preproducto or '—'
        # 3) Cantidad ordenada y recibida
        cantidad_ordenada = poc.cantidad
        cantidad_recibida = linea.cantidad_recibida

        productos.append({
            'producto_orden_compra_id': linea.producto_orden_compra_id,
            'nombre_producto':          nombre,
            'cantidad_ordenada':        cantidad_ordenada,
            'cantidad_recibida':        cantidad_recibida,
            'estado':                   linea.estado
        })

    return jsonify({
        'id':           gc.id,
        'numero_guia':  gc.numero_guia,
        'fecha_emision':gc.fecha_emision.isoformat(),
        'estado':       gc.estado,
        'comentario':   gc.comentario,
        'productos':    productos
    }), 200

# 6) Actualizar Guía de Compra (PUT /guia_remision_compra/<id>)
@app.route('/guia_remision_compra/<int:gc_id>', methods=['PUT'])
@login_required
def actualizar_guia_compra(gc_id):
    gc   = db.session.get(GuiaRemisionCompra, gc_id)
    data = request.get_json() or {}
    if not gc:
        return jsonify({'error': 'Guía no encontrada'}), 404

    # Actualizo estado y comentario
    gc.estado     = data.get('estado', gc.estado)
    gc.comentario = data.get('comentario', gc.comentario)

    # Actualizo cada línea de la guía
    for d in data.get('detalles', []):
        pod = ProductoGuiaRemisionCompra.query.filter_by(
            guia_remision_compra_id=gc_id,
            producto_orden_compra_id=d['producto_orden_compra_id']
        ).first()
        if pod:
            pod.cantidad_recibida = d['cantidad_recibida']

    # Persisto cambios en la guía
    db.session.commit()

    # **Recalculo y guardo el estado de la OC** asociada
    if gc.orden_compra_id:
        actualizar_estado_orden(gc.orden_compra_id)

    return jsonify({'mensaje': 'Guía actualizada'}), 200

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

