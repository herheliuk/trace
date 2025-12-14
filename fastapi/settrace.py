#!/usr/bin/env python3

import json
from time import sleep
import criu_api as criu
from os import (
    _exit,
    fork as os_fork,
    waitpid as os_waitpid
)

from utils.ast_functions import find_python_imports, get_source_code_cache
from utils.context_managers import use_dir, use_trace
from utils.scope_functions import diff_scope, pretty_scope, filter_scope
import sys
from sys import argv, exit
from pathlib import Path
from collections import defaultdict
from traceback import format_tb

from utils.internal_file_communication import ifc_read, ifc_write

import sqlite3

DATABASE = Path.cwd() / 'trace.db'

def db_save(send_back) -> int:
    with sqlite3.connect(DATABASE) as db:
        cursor = db.execute(
            """
            INSERT INTO timeline (event, target, return_value, filename, frame_pointer, function, lineno, segment, global_changes, local_changes)
            VALUES (:event, :target, :return_value, :filename, :frame_pointer, :function, :lineno, :segment, :global_changes, :local_changes)
            """,
            {**send_back}
        )
        
        lastrowid = cursor.lastrowid
    
        db.execute(
            """
            INSERT OR REPLACE INTO state (id, current_timeline_id)
            VALUES (1, :current_timeline_id)
            """,
            {"current_timeline_id": lastrowid}
        )
        
        return lastrowid

for name in (
    '_app_to_server',
    '_server_to_app',
    '_watcher',
):
    file_txt = Path.cwd() / f'{name}.txt'
    globals()[name] = str(file_txt)



sys.stdout = 

def print_step(text):
    ifc_write(_app_to_server, text)
            
def send_update(send_back, traceback, error):
    if traceback:
        ifc_write(_app_to_server, json.dumps({'traceback': traceback, 'error': error}))
    else:
        criu.dump(allow_overwrite=True)
        
        for key, value in send_back.items():
            try:
                send_back[key] = json.dumps(value)
            except:
                send_back[key] = json.dumps(str(value))
            
        current_timeline_id = db_save(send_back)
        ifc_write(_app_to_server, json.dumps({**send_back, "current_timeline_id": current_timeline_id}))
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
    
def main(debug_script_path: Path):
    paths_to_trace = find_python_imports(debug_script_path)
    
    source_code_cache = {
        str(path): get_source_code_cache(path)
        for path in paths_to_trace
    }
    
    last_files = defaultdict(dict)
    
    str_paths_to_trace = {
        str(path)
        for path in paths_to_trace
    }
    
    if True:
        def trace_function(frame, event, arg):
            str_code_filepath = frame.f_code.co_filename
            if str_code_filepath not in str_paths_to_trace: return

            code_name = frame.f_code.co_name
            filename = Path(str_code_filepath).name

            is_not_module = code_name != '<module>'

            if is_not_module:
                target = code_name
                function_name = None if code_name.startswith('<') else code_name
                current_locals = dict(frame.f_locals)
            else:
                target = filename
                function_name = None
                current_locals = {}

            current_globals = dict(frame.f_globals)

            last_functions = last_files[str_code_filepath]
            
            frame_pointer = id(frame)
            
            event_info, traceback, error = None, None, None
            
            global_changes, local_changes = {}, {}

            if event in ('line', 'return'):
                old_globals, old_locals = last_functions[frame_pointer]

                global_changes = diff_scope(old_globals, current_globals)
                local_changes = diff_scope(old_locals, current_locals) if is_not_module else {}

            segment = source_code_cache[str_code_filepath].get(frame.f_lineno, {}).get('segment', '')

            event_info = {
                'event': event,
                'target': target,
                'return_value': arg,
                'filename': filename,
                'frame_pointer': frame_pointer,
                'function': function_name,
                'lineno': frame.f_lineno,
                'segment': segment,
                'global_changes': global_changes,
                'local_changes': local_changes
            }

            if event == 'line':
                send_update(event_info, traceback, error)
                last_functions[frame_pointer] = current_globals, current_locals
                return

            elif event == 'call':
                send_update(event_info, traceback, error)
                #if current_locals: print_step(pretty_scope(current_locals))
                last_functions.setdefault(frame_pointer, (current_globals, current_locals))
                return trace_function

            elif event == 'return':
                send_update(event_info, traceback, error)
                del last_functions[frame_pointer]
                return

            elif event == 'exception':
                exc_type, exc_value, exc_traceback = arg
                traceback = ''.join(format_tb(exc_traceback))
                error = f"{exc_type.__name__}: {exc_value}"
                send_update(event_info, traceback, error)
                return
        
        source_code = debug_script_path.read_text()
        
        compiled = compile(
            source_code,
            filename=debug_script_path,
            mode='exec',
            dont_inherit=True
        )
        
        exec_globals = {
            '__name__': '__main__',
            '__file__': str(debug_script_path)
        }
        
        with use_dir(debug_script_path.parent), use_trace(trace_function):
            exec(
                compiled,
                exec_globals,
                None
            )

if __name__ == '__main__':
    
    info = ifc_read(_watcher)
    info = info[len(info) - 1] if info else None
    
    starting = not info
    
    child_pid = os_fork()
    if child_pid > 0:
        os_waitpid(child_pid, 0)
        while True:

            info = info or ifc_read(_watcher)
            info = info[len(info) - 1] if info else None

            try:
                int(info)
            except:
                exit()

            try:
                criu.restore(int(info)) # == restore and os_waitpid(child_pid, 0)
            except KeyboardInterrupt:
                print("\nKeyboardInterrupt")
                exit()
            except Exception as e:
                print(e)
                exit()
            
            info = None
    
    if starting:
        criu.wipe()

        debug_script_path = Path('./shared/main.py').resolve()

        main(debug_script_path)
