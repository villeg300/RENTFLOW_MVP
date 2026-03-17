docker exec -it rentflow_db dropdb -U rentflow rentflow_db
docker exec -it rentflow_db createdb -U rentflow rentflow_db
python manage.py migrate
