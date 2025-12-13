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


def ifc_read(filepath: str) -> List[Any]:
    messages: List[Any] = []

    open(filepath, "a").close()

    with open(filepath, "r+") as file:
        with file_lock(file):
            file.seek(0)
            lines = file.readlines()
            file.seek(0)
            file.truncate()
            file.flush()
            os.fsync(file.fileno())

    for line in lines:
        line = line.strip()
        if not line:
            continue
        try:
            messages.append(json.loads(line))
        except json.JSONDecodeError:
            pass

    return messages


def ifc_write(filepath: str, data: Any) -> None:
    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    
    with open(filepath, "a", buffering=1) as file:
        with file_lock(file):
            file.write(json.dumps(data))
            file.write("\n")
            file.flush()
            os.fsync(file.fileno())
