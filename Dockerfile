# Usar una imagen base más liviana
FROM python:3.9-slim

# Configurar el directorio de trabajo dentro del contenedor
WORKDIR /app

# Instalar dependencias del sistema necesarias para compilar psycopg2
#RUN apt-get update && apt-get install -y libpq-dev gcc

# Copiar y instalar las dependencias de Python
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copiar el resto de la aplicación
COPY . .

# Exponer el puerto en el que correrá Flask
EXPOSE 5000

# Comando de inicio de la aplicación
CMD ["python", "app.py"]
