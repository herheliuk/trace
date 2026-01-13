#!/usr/bin/env python3

from sys import path, gettrace, settrace
from os import chdir
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
