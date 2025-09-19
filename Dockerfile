# Utilise une image officielle de Python
FROM python:3.10-slim

# Définir le répertoire de travail dans le conteneur
WORKDIR /app

# Installer les dépendances système pour psycopg2
RUN apt-get update && apt-get install -y \
    libpq-dev gcc \
    && rm -rf /var/lib/apt/lists/*

# Copier les fichiers de l’application
COPY . .

# Installer les dépendances Python
RUN pip install --upgrade pip
RUN pip install -r requirements.txt

# Collecter les fichiers statiques (à activer si j'utilise collectstatic plus tard)
# RUN python manage.py collectstatic --noinput

# Définir la commande par défaut (Gunicorn pour la prod)
CMD ["gunicorn", "cuisinotheque.wsgi:application", "--bind", "0.0.0.0:8000"]
