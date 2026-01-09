
import asyncio
import json
import subprocess
from fastapi import FastAPI, UploadFile, File, Response, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi import WebSocket
from pathlib import Path

from utils.internal_file_communication import ifc

import sqlite3

DATABASE = Path.cwd() / 'trace.db'

def create_tables():
    with sqlite3.connect(DATABASE) as db_connection:
        db_connection.executescript('''
            CREATE TABLE IF NOT EXISTS files (
                file TEXT NOT NULL,
                
                timeline_id INTEGER,    -- timeline pointer
                line_number INTEGER,    -- node pointer
                
                PRIMARY KEY (file)
            );
            
            CREATE TABLE IF NOT EXISTS state (
                id INTEGER CHECK (id = 1),
                
                file TEXT,    -- file pointer

                PRIMARY KEY (id)
                
                FOREIGN KEY (file)
                    REFERENCES files(file)
                    ON DELETE SET NULL
            );

            CREATE TABLE IF NOT EXISTS timeline (
                file TEXT NOT NULL,
                id INTEGER NOT NULL,
                
                event TEXT,
                target TEXT,
                return_value TEXT,
                frame_id INTEGER,
                function TEXT,
                line_number INTEGER,
                source_segment TEXT,
                global_diff TEXT,   -- JSON
                local_diff TEXT,    -- JSON
                traceback TEXT,
                error TEXT,
                
                -- +? time_taken REAL

                -- +? sha256 TEXT UNIQUE
                -- +? last_sha256 TEXT
                
                PRIMARY KEY (file, id),
                
                FOREIGN KEY (file)
                    REFERENCES files(file)
                    ON DELETE CASCADE
            )
        ''')

create_tables()

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

watcher_process = None
needs_to_sync = False

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/sync")
async def app_sync() -> dict:
    with sqlite3.connect(DATABASE) as db_connection:
        cursor = db_connection.cursor()
        
        cursor.execute("PRAGMA foreign_keys = ON;")
        
        cursor.execute(
            """
            SELECT file
            FROM state
            WHERE id = 1
            """
        )
        
        if row := cursor.fetchone():
            file, = row
        else:
            raise HTTPException(status_code=404, detail="no pointer to a file")
        
        cursor.execute(
            """
            SELECT timeline_id, line_number
            FROM files
            WHERE file = :file
            """,
            {
                "file": file
            }
        )
        
        if row := cursor.fetchone():
            timeline_id, node_id = row
        else:
            raise HTTPException(status_code=404, detail="no last IDs for this file")

        timeline = []
        
        if timeline_id is not None:
            cursor.execute(
                """
                SELECT  id, event, target, return_value, file,
                        frame_id, function, line_number, source_segment,
                        global_diff, local_diff, traceback, error
                FROM timeline
                WHERE id <= :id
                  AND file == :file
                ORDER BY id ASC
                """,
                {
                    "id": timeline_id,
                    "file": file
                }
            )
            
            if rows := cursor.fetchall():
                timeline = [
                    {
                        "id": row[0],
                        "event": row[1],
                        "target":   row[2],
                        "return_value": row[3],
                        "file": row[4],
                        "frame_id": row[5],
                        "function": row[6],
                        "line_number": row[7],
                        "source_segment": row[8],
                        "global_diff": row[9],
                        "local_diff": row[10],
                        "traceback": row[11],
                        "error": row[12]
                    }
                    for row in rows
                ]
            else:
                raise HTTPException(status_code=400, detail='no timeline for this timeline_id')
    
        return {
            "nodes": nodes_from_file(timeline_id=timeline_id),
            "node_id": node_id,
            "timeline": timeline,
            "timeline_id": timeline_id
        }

def ensure_watcher_running():
    global watcher_process, needs_to_sync
    
    restart_needed = watcher_process is None or watcher_process.poll() is not None

    if restart_needed:
        timeline_id, node_id = None, None
        
        with sqlite3.connect(DATABASE) as db_connection:
            cursor = db_connection.cursor()
            
            cursor.execute("PRAGMA foreign_keys = ON;")
            
            cursor.execute(
                """
                SELECT file
                FROM state
                WHERE id = 1
                """
            )
            
            if row := cursor.fetchone():
                file, = row
            
                cursor.execute(
                    """
                    SELECT timeline_id, line_number
                    FROM files
                    WHERE file = :file
                    """,
                    {
                        "file": file
                    }
                )
                
                if row := cursor.fetchone():
                    timeline_id, node_id = row
                    
                try:
                    if not type(timeline_id) is int:
                        raise ValueError("There's no timeline_id or it isn't an int")
                    ifc.replace(_watcher, [str(timeline_id)])
                    print(f"[REC {timeline_id} line {node_id}]", flush=True)
                except Exception as error:
                    pass#print(f"[bbb] {error}", flush=True)
        
        watcher_process = subprocess.Popen(
            ["sudo", "-E", "/home/user/trace/api/env/bin/python", "settrace.py"]
        )
        
        needs_to_sync = True
        
        print("[SSS]", flush=True)

MAIN_FILE_PATH = Path.cwd() / "shared" / "main.py"

def nodes_from_file(raw_bytes = None, timeline_id = None) -> str:
    if raw_bytes:
        text = raw_bytes.decode('utf-8')
    else:
        with open(str(MAIN_FILE_PATH), "r") as file:
            text = file.read()

    lines_with_numbers = [(lineno, source_segment) for lineno, source_segment in enumerate(text.splitlines(), start=1) if source_segment.strip() and source_segment.lstrip()[0] != '#']

    line_number_frame_id = None

    if timeline_id:
        with sqlite3.connect(DATABASE) as db_connection:
            cursor = db_connection.cursor()
            
            cursor.execute("PRAGMA foreign_keys = ON;")
            
            cursor.execute(
                """
                SELECT file
                FROM state
                WHERE id = 1
                """
            )
            
            if row := cursor.fetchone():
                file, = row
                
                cursor.execute(
                    """
                    SELECT line_number, frame_id
                    FROM timeline
                    WHERE id <= :id
                    AND file == :file
                    ORDER BY id ASC
                    """,
                    {
                        "id": timeline_id,
                        "file": file
                    }
                )

                if rows := cursor.fetchall():
                    line_number_frame_id = {
                        row[0]: row[1]
                        for row in rows
                    }

    gap_between_nodes = 50

    return [
        {
            "id": str(lineno),
            "type": "code",
            "position": {"x": (len(source_segment) - len(source_segment.lstrip())) / 4 * 25, "y": idx * gap_between_nodes},
            "data": {
                "source_segment": source_segment.lstrip(),
                "framePointer": line_number_frame_id[lineno] if line_number_frame_id and lineno in line_number_frame_id else None
            },
        }
        for idx, (lineno, source_segment) in enumerate(lines_with_numbers)
    ]

@app.post("/api/upload")
async def import_graph(file: UploadFile = File(...)):
    global needs_to_sync
    
    if watcher_process: # use a pointer in the db instead!
        watcher_process.kill()
    
    raw_bytes = await file.read()
    
    with open(str(MAIN_FILE_PATH), "wb") as file:
        file.write(raw_bytes)
    
    send_back = {
        "file": "main.py" # ! REPLACE WITH THE ACTUAL UPLOADED FILENAME
    }
        
    with sqlite3.connect(DATABASE) as db_connection:
        cursor = db_connection.cursor()
        
        cursor.execute("PRAGMA foreign_keys = ON;")
        
        cursor.execute(
            """
            INSERT OR REPLACE INTO files (file)
            VALUES (:file)
            """,
            send_back
        )
        
        cursor.execute(
            """
            INSERT OR REPLACE INTO state (
                id, file
            )
            VALUES (
                1, :file
            )
            """,
            send_back
        )
    
    needs_to_sync = True
    
    return Response(status_code=201)

queue = []

@app.websocket("/api/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    
    async def ws_to_app():
        while True:
            try:
                data = await websocket.receive_text()
                ifc.append(_server_to_app, data, is_json=True)
                ensure_watcher_running()
            except Exception as error:
                print(f"[ccc] {error}", flush=True)
                raise

    async def app_to_ws():
        global needs_to_sync
        while True:
            while queue:
                await asyncio.sleep(.1)
            
            messages = ifc.pop(_app_to_server, keep_json=True)
            
            if needs_to_sync:
                needs_to_sync = False
                while True:
                    try:
                        sync_event = json.dumps({
                            "type": "sync",
                            "data": await app_sync()
                        })
                        break
                    except:
                        await asyncio.sleep(.1)
                messages.insert(0, sync_event)
            
            for i, message in enumerate(messages):
                try:
                    await websocket.send_text(message)
                except Exception as error:
                    queue.extend(messages[i:])
                    print(f"[ddd] {error}", flush=True)
                    raise
            
            await asyncio.sleep(.1)
            
    async def resend():
        while True:
            while queue:
                message = queue.pop(0)
                try:
                    await websocket.send_text(message)
                except:
                    print("[b4]", flush=True)
                    queue.insert(0, message)
                    raise
            await asyncio.sleep(.1)
    try:
        await asyncio.gather(
            ws_to_app(),
            app_to_ws(),
            resend()
        )
    except Exception as error:
        print(error)
