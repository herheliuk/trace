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

from time import sleep

from utils.internal_file_communication import ifc_read, ifc_write

for name in (
    '_app_to_server',
    '_server_to_app',
    '_watcher',
):
    file_txt = Path.cwd() / f'{name}.txt'
    globals()[name] = str(file_txt)

@contextmanager
def step_io(criu, output_file: Path, interactive = None):
    def print_step(text):
        ifc_write(_app_to_server, text)
            
    def input_step(text):
        criu.dump(allow_overwrite=True)
        ifc_write(_app_to_server, text)
        running = True
        while running:
            for resp in ifc_read(_server_to_app):
                match resp:
                    case 'continue':
                        running = False
                    case resp:
                        try:
                            int(resp)
                            ifc_write(_watcher, resp)
                            _exit(0)
                        except Exception as error:
                            print(error)
            
            sleep(.1)

    yield (print_step, input_step)
