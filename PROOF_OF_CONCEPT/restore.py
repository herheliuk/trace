#!/usr/bin/env python3

from utils.ast_functions import find_python_imports
from utils.context_managers import use_dir, use_trace

from sys import argv, exit
from pathlib import Path

from dill import (
    load as dill_load
)

with open('snapshot', 'rb') as file:
    snapshot = dill_load(file)

def main(debug_script_path: Path):
    paths_to_trace = find_python_imports(debug_script_path)
    
    str_paths_to_trace = {
        str(path)
        for path in paths_to_trace
    }
    
    if True:
        def trace_function(frame, event, arg):
            str_code_filepath = frame.f_code.co_filename
            if str_code_filepath not in str_paths_to_trace: return
            
            if not snapshot:
                return

            print(f"{f' {event} {frame.f_lineno} ':-^50}")
            
            if event == 'line':
                frame.f_lineno = snapshot[0]['lineno']
                    
                for key, value in snapshot[0]['locals'].items():
                    frame.f_locals[key] = value

                del snapshot[0]

            elif event == 'call':
                return trace_function
        
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
            try:
                exec(
                    compiled,
                    exec_globals,
                    None
                )
            except KeyboardInterrupt:
                print()
                exit(1)

if __name__ == "__main__":
    debug_script_path = Path(argv[1]).resolve()

    main(debug_script_path)
