import subprocess
from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi import WebSocket

app = FastAPI(
    openapi_url=None
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/app_start")
async def app_start():
    subprocess.Popen(
        ["sudo", "-E", "/home/user/trace/fastapi/env/bin/python", "settrace.py"]
    )
    return {"status": "tracing started"}

@app.post("/api/import")
async def import_graph(file: UploadFile = File(...)):
    global app_ws
    await web_ws.send_text('x')
    app_ws = None
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
        ],
        #"edges": [
        #    {
        #        "id": f"{lines_with_numbers[i][0]}-{lines_with_numbers[i+1][0]}",
        #        "source": str(lines_with_numbers[i][0]),
        #        "target": str(lines_with_numbers[i+1][0]),
        #    }
        #    for i in range(len(lines_with_numbers) - 1)
        #],
    }

web_ws = None
app_ws = None

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    global web_ws, app_ws
    web_ws = websocket
    await websocket.accept()
    try:
        while True:
            data = await websocket.receive_text()
            if app_ws:
                await app_ws.send_text(data)
    except Exception as e:
        print(f"WebSocket error: {e}")
    finally:
        web_ws = None

@app.websocket("/app_ws")
async def app_websocket_endpoint(websocket: WebSocket):
    global web_ws, app_ws
    app_ws = websocket
    await websocket.accept()
    try:
        while True:
            data = await websocket.receive_text()
            if web_ws:
                await web_ws.send_text(data)
            else:
                print(f'missed message to web client: {data}')
    except Exception as e:
        print(f"App WebSocket error: {e}")
    finally:
        await web_ws.send_text('x')
        app_ws = None
