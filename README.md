install

```
# pwd ./trace/
cd ./fastapi/
source env.sh
git clone https://github.com/herheliuk/criu-python-api ./criu-python-api/ --depth 1
source ./criu-python-api/install.sh
```

run

```
# pwd ./trace/
docker compose -f docker-compose.development.yml up frontend -d
cd ./fastapi/
source env.sh
sudo -E $(which uvicorn) main:app
```

<img src="scr1.png" alt="App screenshot"/>
