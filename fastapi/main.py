
import asyncio
import subprocess
from fastapi import FastAPI, UploadFile, File, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi import WebSocket
from pathlib import Path

from utils.internal_file_communication import ifc_read, ifc_write

import sqlite3

DATABASE = Path.cwd() / 'trace.db'

DATABASE.unlink(missing_ok=True)

with sqlite3.connect(DATABASE) as db_connection:
    db_connection.executescript('''
        CREATE TABLE IF NOT EXISTS timeline (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            
            event TEXT,
            target TEXT,
            return_value TEXT,
            filename TEXT,
            frame_pointer TEXT,
            function TEXT,
            lineno TEXT,
            segment TEXT,
            global_changes TEXT,
            local_changes TEXT

--            code TEXT,
--            action TEXT,
--
--            return_value TEXT,
--            scope TEXT,
--
--            frame INTEGER
--            -- time_taken REAL,

            -- sha256 TEXT UNIQUE,
            -- last_sha256 TEXT
        );
        CREATE TABLE IF NOT EXISTS state (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            timeline_index INTEGER,
            node_index INTEGER
        );
    ''')

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

@app.get("/api/sync")
async def app_sync():
    with sqlite3.connect(DATABASE) as db_connection:
        cursor = db_connection.execute(
            """
            SELECT timeline_index, node_index FROM state WHERE id = 1
            """
        )
        
        if row := cursor.fetchone():
            timeline_index, node_index = row
        else:
            timeline_index, node_index = None, None

        timeline_entries = []
        if timeline_index is not None:
            cursor = db_connection.execute(
                """
                SELECT id, event, target, return_value, filename, frame_pointer, function, lineno, segment, global_changes, local_changes
                FROM timeline
                WHERE id <= ?
                ORDER BY id ASC
                """,
                (timeline_index,)
            )
            timeline_entries = [
                {
                    "timeline_index": row[0],
                    "event": row[1],
                    "target":   row[2],
                    "return_value": row[3],
                    "filename": row[4],
                    "frame_pointer": row[5],
                    "function": row[6],
                    "lineno": row[7],
                    "segment": row[8],
                    "global_changes": row[9],
                    "local_changes": row[10]
                }
                for row in cursor.fetchall()
            ]
    
        return {
            "nodes": nodes_from_file(),
            "node_index": node_index,
            "timeline_entries": timeline_entries,
            "timeline_index": timeline_index
        }

watcher_process = None

def ensure_watcher_running():
    global watcher_process

    if watcher_process is None or watcher_process.poll() is not None:
        watcher_process = subprocess.Popen(
            ["sudo", "-E", "/home/user/trace/fastapi/env/bin/python", "settrace.py"]
        )
        print("[SSS]")

MAIN_FILE_PATH = Path.cwd() / "shared" / "main.py"

def nodes_from_file(raw_bytes = None) -> str:
    if raw_bytes:
        text = raw_bytes.decode('utf-8')
    else:
        with open(str(MAIN_FILE_PATH), "r") as file:
            text = file.read()

    lines_with_numbers = [(lineno, line) for lineno, line in enumerate(text.splitlines(), start=1) if line.strip() and line.lstrip()[0] != '#']

    return [
        {
            "id": str(lineno),
            "type": "code",
            "position": {"x": (len(line) - len(line.lstrip())) / 4 * 25, "y": idx * 40},
            "data": {
                "line": line.lstrip(),
                "framePointer": "" # SQL Query...
            },
        }
        for idx, (lineno, line) in enumerate(lines_with_numbers)
    ]

@app.post("/api/upload")
async def import_graph(file: UploadFile = File(...)):
    if watcher_process: # need to create a pointer in the db instead!
        watcher_process.kill()
    
    raw_bytes = await file.read()
    
    with open(str(MAIN_FILE_PATH), "wb") as file:
        file.write(raw_bytes)
    
    return Response(status_code=201)

@app.post("/api/restart_watcher")
async def restart_watcher():
    try:
        watcher_process.kill()
        return Response(status_code=201)
    except:
        return Response(status_code=400)
    
queue = []

@app.websocket("/api/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    
    async def adviasd():
        while True:
            data = await websocket.receive_text()
            ifc_write(_server_to_app, data)
            ensure_watcher_running()
    async def dfg913fg1():
        while True:
            for info in ifc_read(_app_to_server):
                queue.append(info)
            await asyncio.sleep(.1)
    async def t4812():
        while True:
            while queue:
                info = queue.pop(0)
                try:
                    await websocket.send_text(info)
                except:
                    print("[b4]", end="", flush=True)
                    queue.insert(0, info)
                    break
            await asyncio.sleep(.1)
    await asyncio.gather(
        adviasd(),
        dfg913fg1(),
        t4812()
    )
