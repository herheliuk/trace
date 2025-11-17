#!/usr/bin/env python3

from sys import path, gettrace, settrace, exit as sys_exit
from os import chdir, _exit
from contextlib import contextmanager
from pathlib import Path

@contextmanager
def use_dir(target_dir: Path):
    original_dir = Path.cwd()
    target_dir = str(target_dir)
    if target_dir not in path:
        path.insert(0, target_dir)
        chdir(target_dir)
    try:
        yield
    finally:
        if target_dir in path:
            path.remove(target_dir)
            chdir(original_dir)
    
@contextmanager
def use_trace(trace_function):
    old_trace = gettrace()
    settrace(trace_function)
    try:
        yield
    finally:
        settrace(old_trace)
        
import sys
from websocket import WebSocket
from time import sleep

class WSWriter:
    def __init__(self, ws):
        self.ws = ws

    def write(self, message):
        # WebSocket may expect text only, filter empty flush calls
        if message and message.strip() != "":
            try:
                self.ws.send(message)
            except Exception as e:
                # Optional: print errors to original stderr
                sys.__stderr__.write(f"[WS send error] {e}\n")

    def flush(self):
        pass  # required for Python's IO interface


# ---- Connect loop ----
ws = WebSocket()
print('connecting to ws://')

connected = False
while not connected:
    try:
        ws.connect("ws://127.0.0.1:8000/app_ws")
        connected = True
    except:
        print('failed to connect, retrying in 1s...')
        sleep(1)

ws_writer = WSWriter(ws)
sys.stdout = ws_writer
sys.stderr = ws_writer

print('connected to ws://')


@contextmanager
def step_io(write_mem, criu, output_file: Path, interactive = None):
    def print_step(text):
        ws.send(text)
            
    def input_step(text):
        criu.dump(allow_overwrite=True)
        ws.send(text)
        while True:
            match ws.recv():
                case 'continue':
                    break
                case resp:
                    try:
                        int(resp)
                        write_mem(resp)
                        _exit(0)
                    except Exception as error:
                        ws.send(error)

    yield (print_step, input_step)
