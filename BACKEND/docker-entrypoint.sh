#!/bin/sh
set -e

# Apply database migrations and collect static files (best-effort)
echo "Running migrations..."
python manage.py migrate --noinput

echo "Collecting static files (may be no-op in dev)..."
python manage.py collectstatic --noinput || true

# Start Gunicorn (fallback to runserver if gunicorn not available)
if command -v gunicorn >/dev/null 2>&1; then
  echo "Starting gunicorn..."
  exec gunicorn core.wsgi:application --bind 0.0.0.0:8000 --workers 2
else
  echo "gunicorn not found, starting Django development server..."
  exec python manage.py runserver 0.0.0.0:8000
fi
