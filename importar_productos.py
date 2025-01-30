import pandas as pd
from app import db, Producto, app
import os

# Obtener la ruta absoluta del archivo Excel
basedir = os.path.abspath(os.path.dirname(__file__))
excel_path = os.path.join(basedir, 'Inventario.xlsx')

# Leer el archivo Excel
df = pd.read_excel(excel_path)

# Función para limpiar los datos y convertirlos a tipos apropiados
def limpiar_datos(row):
    row['STOCK'] = int(row['STOCK'])
    return row

# Limpiar los datos
df = df.apply(limpiar_datos, axis=1)

with app.app_context():
    # Agregar cada fila a la base de datos
    for index, row in df.iterrows():
        producto = Producto(
            nombre=row['DESCRIPCIONITEM'],
            descripcion=row['CODIGOITEM'],
            precio=0,  # Ajusta esto según sea necesario
            stock=row['STOCK'],
            proveedor=row['MARCA'],
            sucursal=row['SUCURSAL'],
            almacen=row['ALMACEN'],
            codigo_item=row['CODIGOITEM'],
            codigo_barra=row['CODIGOBARRASITEM'],
            unidad=row['UNIDAD']
        )
        db.session.add(producto)

    db.session.commit()
    print("Productos importados con éxito.")
