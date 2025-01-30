import pandas as pd
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.exc import SQLAlchemyError
from app import Producto
from sqlalchemy import func

# Configurar la conexión a PostgreSQL
engine = create_engine('postgresql+psycopg2://postgres:mijail28@localhost/proyecto_cotizaciones')
Session = sessionmaker(bind=engine)
session = Session()

# Obtener el último ID en la base de datos
ultimo_id = session.query(func.max(Producto.id)).scalar()
if ultimo_id is None:
    ultimo_id = 0  # Si no hay registros en la base de datos, empezar desde 1

# Ruta al archivo Excel
file_path = 'Inventario.xlsx'

# Leer el archivo Excel
df = pd.read_excel(file_path)

# Truncar valores que excedan la longitud permitida en la base de datos
df['nombre'] = df['DESCRIPCIONITEM'].astype(str).str[:80]  # Máximo 80 caracteres
df['sucursal'] = df['SUCURSAL'].astype(str).str[:80] if 'SUCURSAL' in df.columns else None
df['almacen'] = df['ALMACEN'].astype(str).str[:80] if 'ALMACEN' in df.columns else None
df['codigo_item'] = df['CODIGOITEM'].astype(str).str[:80] if 'CODIGOITEM' in df.columns else None
df['codigo_barra'] = df['CODIGOBARRA'].astype(str).str[:80] if 'CODIGOBARRA' in df.columns else None
df['proveedor'] = df['MARCA'].astype(str).str[:80] if 'MARCA' in df.columns else None
df['unidad'] = df['UNIDAD'].astype(str).str[:80] if 'UNIDAD' in df.columns else None

# Asegurar que la descripción en la tabla sea NULL
df['descripcion'] = None
df['activo'] = True
df['creado_por'] = 1  # Suponemos que el usuario "gerente1" tiene ID=1

# Validar que el Excel contenga la columna "DESCRIPCIONITEM"
if 'DESCRIPCIONITEM' not in df.columns or df['DESCRIPCIONITEM'].isnull().all():
    raise ValueError("El archivo Excel no contiene una columna válida llamada 'DESCRIPCIONITEM' o no tiene datos.")

# Manejar la columna "precio" si no existe
if 'precio' not in df.columns:
    df['precio'] = 0.0  # Establecer un valor predeterminado para el precio

# Generar IDs secuenciales únicos a partir del último ID en la base de datos
df['id'] = range(ultimo_id + 1, ultimo_id + 1 + len(df))

try:
    # Iterar por cada fila del DataFrame y añadir a la base de datos
    for _, row in df.iterrows():
        producto = Producto(
            id=int(row['id']),
            nombre=row['nombre'],  # Asignar la descripción del Excel al nombre
            descripcion=None,  # Campo descripción como NULL
            precio=row['precio'],
            stock=row['STOCK'] if 'STOCK' in df.columns else 0,
            proveedor=row['proveedor'],
            sucursal=row['sucursal'],
            almacen=row['almacen'],
            codigo_item=row['codigo_item'],
            codigo_barra=row['codigo_barra'],
            unidad=row['unidad'],
            creado_por=row['creado_por'],
            activo=row['activo']
        )
        session.add(producto)

    # Confirmar cambios en la base de datos
    session.commit()
    print("Datos importados exitosamente a la base de datos.")

except SQLAlchemyError as e:
    session.rollback()
    print(f"Error al importar los datos: {str(e)}")
finally:
    session.close()
