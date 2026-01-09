#!/usr/bin/env python3

import fcntl
import json
import os
from contextlib import contextmanager
from typing import Any, List


@contextmanager
def file_lock(file):
    fcntl.flock(file, fcntl.LOCK_EX)
    try:
        yield
    finally:
        fcntl.flock(file, fcntl.LOCK_UN)

def _parse_lines(lines: List[str], keep_json: bool) -> List[Any]:
    messages: List[Any] = []
    for line in lines:
        line = line.strip()
        if not line:
            continue
        try:
            messages.append(line if keep_json else json.loads(line))
        except json.JSONDecodeError:
            pass
    return messages

class _IFC:
    def read(self, filepath: str, keep_json: bool = False) -> List[Any]:
        open(filepath, "a").close()

        with open(filepath, "r") as file:
            with file_lock(file):
                file.seek(0)
                lines = file.readlines()

        return _parse_lines(lines, keep_json)
    
    def replace(self, filepath: str, data: List[Any], is_json: bool = False) -> None:
        os.makedirs(os.path.dirname(filepath), exist_ok=True)

        with open(filepath, "w", buffering=1) as file:
            with file_lock(file):
                for item in data:
                    file.write(item if is_json else json.dumps(item))
                    file.write("\n")
                file.flush()
                os.fsync(file.fileno())
        
    def append(self, filepath: str, data: Any, is_json: bool = False) -> None:
        os.makedirs(os.path.dirname(filepath), exist_ok=True)

        with open(filepath, "a", buffering=1) as file:
            with file_lock(file):
                file.write(data if is_json else json.dumps(data))
                file.write("\n")
                file.flush()
                os.fsync(file.fileno())
    
    def pop(self, filepath: str, keep_json: bool = False) -> List[Any]:
        open(filepath, "a").close()

        with open(filepath, "r+") as file:
            with file_lock(file):
                file.seek(0)
                lines = file.readlines()
                file.seek(0)
                file.truncate()
                file.flush()
                os.fsync(file.fileno())

        return _parse_lines(lines, keep_json)

ifc = _IFC()
