#!/usr/bin/env python3

import criu_api as criu
from os import (
    fork as os_fork,
    waitpid as os_waitpid
)

from utils.ast_functions import find_python_imports, get_source_code_cache
from utils.context_managers import use_dir, use_trace, step_io
from utils.scope_functions import diff_scope, pretty_scope, filter_scope

from sys import argv, exit
from pathlib import Path
from collections import defaultdict
from traceback import format_tb

_mem_file = Path.cwd() / 'mem.txt'

def write_mem(info: str):
    with open(_mem_file, 'w') as file:
        file.write(info)
        
def pop_mem() -> str:
    with open(_mem_file, 'r') as file:
        info = file.read()
    write_mem('')
    return info

def main(debug_script_path: Path, output_file: Path, interactive = None):
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
    
    with step_io(write_mem, criu, output_file, interactive) as (print_step, input_step):
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

            if event in ('line', 'return'):
                old_globals, old_locals = last_functions[frame_pointer]

                global_changes = diff_scope(old_globals, current_globals)
                local_changes = diff_scope(old_locals, current_locals) if is_not_module else {}

                if global_changes or local_changes:
                    payload = {'filename': filename, 'frame_pointer': frame_pointer}
                    if function_name:
                        payload['function'] = function_name
                    if global_changes:
                        payload['globals'] = global_changes
                    if local_changes:
                        payload['locals'] = local_changes
                    print_step(pretty_scope(payload))

            print_step(f"{f' {event} ':-^50}")

            if event == 'line':
                input_step(pretty_scope({
                    'filename': filename,
                    'frame_pointer': frame_pointer,
                    **({'function': function_name} if function_name else {}),
                    'lineno': frame.f_lineno,
                    **(source_code_cache[str_code_filepath][frame.f_lineno])
                }))
                last_functions[frame_pointer] = current_globals, current_locals
                return

            elif event == 'call':
                input_step(f"calling {target}")
                if current_locals: print_step(pretty_scope(current_locals))
                last_functions.setdefault(frame_pointer, (current_globals, current_locals))
                return trace_function

            elif event == 'return':
                print_step(f"{target} returned {arg}")
                del last_functions[frame_pointer]
                return

            elif event == 'exception':
                exc_type, exc_value, exc_traceback = arg
                print_step(''.join(format_tb(exc_traceback)))
                print_step(f"{exc_type.__name__}: {exc_value}")
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
    criu.wipe()
    
    child_pid = os_fork()
    if child_pid > 0:
        os_waitpid(child_pid, 0)
        while True:

            info = pop_mem()

            try:
                int(info)
            except:
                exit()

            try:
                criu.restore(int(info))
            except KeyboardInterrupt:
                print("\nKeyboardInterrupt")
                exit()
            except Exception as e:
                print(e)
                exit()
    
    debug_script_path = Path('./shared/main.py').resolve()
    
    output_file = Path.cwd() / (debug_script_path.stem + '.trace.txt')
        
    main(debug_script_path, output_file, interactive=True)
