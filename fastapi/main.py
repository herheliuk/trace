
import asyncio
import subprocess
from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi import WebSocket
from pathlib import Path

from utils.internal_file_communication import ifc_read, ifc_write

for name in (
    '_app_to_server',
    '_server_to_app',
    '_watcher',
):
    file_txt = Path.cwd() / f'{name}.txt'
    globals()[name] = str(file_txt)
    open(str(file_txt), "w").close()

app = FastAPI(
    openapi_url=None
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/api/app_start")
async def app_start():
    subprocess.Popen(
        ["sudo", "-E", "/home/user/trace/fastapi/env/bin/python", "settrace.py"]
    )
    return {"status": "tracing started"}

@app.post("/api/import")
async def import_graph(file: UploadFile = File(...)):
    ifc_write(_watcher, 'x')
    # BAD CODE ^
    
    raw_bytes = await file.read()
    
    with open("./shared/main.py", "wb") as file:
        file.write(raw_bytes)
    
    text = raw_bytes.decode("utf-8")

    lines_with_numbers = [(i, line) for i, line in enumerate(text.splitlines(), start=1) if line.strip() and line.lstrip()[0] != '#']

    return {
        "nodes": [
            {
                "id": str(i),
                "type": "code",
                "position": {"x": (len(line) - len(line.lstrip())) / 4 * 25, "y": idx * 40},
                "data": {"label": line.lstrip()},
            }
            for idx, (i, line) in enumerate(lines_with_numbers)
        ]
    }

@app.websocket("/api/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    async def adviasd():
        while True:
            data = await websocket.receive_text()
            ifc_write(_server_to_app, data)
    async def dfg913fg1():
        while True:
            for info in ifc_read(_app_to_server):
                await websocket.send_text(info)
            await asyncio.sleep(.1)
    await asyncio.gather(
        adviasd(),
        dfg913fg1()
    )
