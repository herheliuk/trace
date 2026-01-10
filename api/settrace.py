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

from utils.internal_file_communication import ifc

import sqlite3

DATABASE = Path.cwd() / 'trace.db'

def serialize(obj):
    if isinstance(obj, (int, float, str, bool, type(None))):
        return obj
    elif isinstance(obj, (tuple, list)):
        return [serialize(item) for item in obj]
    elif isinstance(obj, dict):
        return {str(k): serialize(v) for k, v in obj.items()}
    else:
        return str(obj)

def db_save(send_back) -> None:
    with sqlite3.connect(DATABASE) as db_connection:
        cursor = db_connection.cursor()
        
        cursor.execute("PRAGMA foreign_keys = ON;")
        
        cursor.execute(
            """
            UPDATE files
            SET timeline_id = :id,
                line_number = :line_number
            WHERE file = :file;
            """,
            send_back
        )

        send_back['global_diff'] = json.dumps(serialize(send_back['global_diff']))
        send_back['local_diff'] = json.dumps(serialize(send_back['local_diff']))
        
        if isinstance(return_value := serialize(send_back['return_value']), (dict, list, tuple)):
            send_back['return_value'] = json.dumps(return_value)
        else:
            send_back['return_value'] = return_value

        cursor.execute(
            """
            INSERT OR REPLACE INTO timeline (
                id, event, target, return_value, file,
                frame_id, function, line_number, source_segment,
                global_diff, local_diff, traceback, error
            )
            VALUES (
                :id, :event, :target, :return_value, :file,
                :frame_id, :function, :line_number, :source_segment,
                :global_diff, :local_diff, :traceback, :error
            )
            """,
            send_back
        )

for name in (
    '_app_to_server',
    '_server_to_app',
    '_watcher',
):
    file_txt = Path.cwd() / f'{name}.txt'
    globals()[name] = str(file_txt)

class StdOutRedirector:
    def flush(self):
        ifc.append(_app_to_server, {
            "type": "flush",
            "data": "stdout"
        })
    
    def write(self, text):
        ifc.append(_app_to_server, {
            "type": "stdout",
            "data": text
        })

class StdErrRedirector:
    def flush(self):
        ifc.append(_app_to_server, {
            "type": "flush",
            "data": "stderr"
        })
    
    def write(self, text):
        ifc.append(_app_to_server, {
            "type": "stderr",
            "data": text
        })

sys.stdout = StdOutRedirector()
sys.stderr = StdErrRedirector()

def send_data(send_back, f):
    criu.dump(allow_overwrite=True)
    
    send_back['id'] = criu._last_dump_number
    
    db_save(send_back)
    
    ifc.append(_app_to_server, {
        "type": "event",
        "data": send_back
    })
    running = True
    while running:
        for message in ifc.pop(_server_to_app):
            match message['type']:
                case 'continue':
                    running = False
                case 'new_timeline_id':
                    try:
                        new_timeline_id = message['new_timeline_id']
                        int(new_timeline_id)
                        ifc.append(_watcher, new_timeline_id)
                        _exit(0)
                    except Exception as error:
                        print(error)
                case 'update_node_code': # TODO
                    ifc.append(_app_to_server, {
                        "type": "stderr",
                        "data": f"TODO: EDIT NODE {message['lineno']} TO {repr(message['code_segment'])}\n"
                    })
                case "stdin": # TODO, CURRENTLY USED FOR DEBUG ^
                    clean_input = int(message['data'])
                    exec(f'try:\n    f.f_lineno = {clean_input}\nexcept Exception as e:\n    print(e)')
            
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

        last_scope = last_files[str_code_filepath]
        
        frame_id = id(frame)
        
        global_diff, local_diff = {}, {}
        
        if event in ("line", "return"):
            old_globals, old_locals = last_scope[frame_id]
        elif (last_frame_id := id(frame.f_back)) in last_scope:
            old_globals, old_locals = last_scope[last_frame_id]
        else:
            old_globals, old_locals = {}, {}
                
        global_diff = diff_scope(old_globals, current_globals)
        local_diff = diff_scope(old_locals, current_locals)
        
        source_segment = source_code_cache[str_code_filepath].get(frame.f_lineno, {}).get('segment', '')
        
        data = {
            'event': event,
            'target': target,
            'file': filename,
            'frame_id': frame_id,
            'function': function_name,
            'line_number': frame.f_lineno,
            'source_segment': source_segment,
            "global_diff": global_diff,
            "local_diff": local_diff,
            "return_value": arg,
            "traceback": None,
            "error": None
        }
            
        if event == 'line':
            send_data(data, frame)
            last_scope[frame_id] = current_globals, current_locals
            return

        elif event == 'call':
            send_data(data, frame)
            #if current_locals: print(pretty_scope(current_locals))
            last_scope.setdefault(frame_id, (current_globals, current_locals))
            return trace_function

        elif event == 'return':
            send_data(data, frame)
            del last_scope[frame_id]
            return

        elif event == 'exception':
            exc_type, exc_value, exc_traceback = arg
            data.update({
                "traceback": ''.join(format_tb(exc_traceback)),
                "error": f"{exc_type.__name__}: {exc_value}"
            })
            send_data(data, frame)
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
    
    info = ifc.read(_watcher)
    info = info[len(info) - 1] if info else None
    
    starting = not info or not info.isdigit()
    
    child_pid = os_fork()
    if child_pid > 0:
        os_waitpid(child_pid, 0)
        while True:

            info = ifc.pop(_watcher)
            info = info[len(info) - 1] if info else None

            try:
                int(info)
            except:
                # done executing a script.
                
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
                            UPDATE files
                            SET timeline_id = :id,
                                line_number = :line_number
                            WHERE file = :file;
                            """,
                            {
                                "id": None,
                                "line_number": None,
                                "file": file
                            }
                        )
                    else:
                        raise Exception("no pointer to a file")

                exit()

            try:
                criu.restore(int(info)) # == restore and os_waitpid(child_pid, 0)
            except KeyboardInterrupt:
                print("\nKeyboardInterrupt")
                exit()
            except Exception as e:
                print(e)
                exit()
    
    if starting:
        criu.wipe()

        debug_script_path = Path('./shared/main.py').resolve()

        main(debug_script_path)
