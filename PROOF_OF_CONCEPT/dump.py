#!/usr/bin/env python3

from utils.ast_functions import find_python_imports
from utils.context_managers import use_dir, use_trace

from sys import argv, exit
from pathlib import Path

from dill import (
    dump as dill_dump
)

from types import FrameType

def get_stack(frame: FrameType) -> list[FrameType]:
    stack = []
    stack_append = stack.append
    
    while frame is not None:
        stack_append(frame)
        frame = frame.f_back

    stack.reverse()
    return stack

def main(debug_script_path: Path, dump_line: int):
    paths_to_trace = find_python_imports(debug_script_path)
    
    str_paths_to_trace = {
        str(path)
        for path in paths_to_trace
    }
    
    if True:
        def trace_function(frame, event, arg):
            str_code_filepath = frame.f_code.co_filename
            if str_code_filepath not in str_paths_to_trace: return

            lineno = frame.f_lineno

            print(f"{f' {event} {lineno} ':-^50}")

            if event == 'line':
                
                if lineno == dump_line:
                    
                    snapshot = []
                    
                    for frame in get_stack(frame):
                        snapshot.append({
                            "lineno": frame.f_lineno,
                            "locals": dict(frame.f_locals)
                        })
                    
                    with open('snapshot', 'wb') as file:
                        dill_dump(snapshot[2:], file)
                    
                    exit()

            elif event == 'call':
                return trace_function
        
        source_code = debug_script_path.read_text()
        
        if dump_line not in range(len(source_code.splitlines())):
            raise Exception(f'dump_line is out of the range')
        
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
            try:
                exec(
                    compiled,
                    exec_globals,
                    None
                )
            except KeyboardInterrupt:
                print()
                exit(1)

if True:
    debug_script_path = Path(argv[1]).resolve()
    
    try:
        dump_line = int(argv[2])
    except:
        raise Exception('dump_line should be an int')
    
    main(debug_script_path, dump_line)
    
    raise Exception("dump_line was never hit.")
