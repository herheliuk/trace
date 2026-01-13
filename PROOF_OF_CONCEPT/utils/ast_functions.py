#!/usr/bin/env python3

from ast import parse, walk, Import, ImportFrom
from pathlib import Path

def find_python_imports(script_path: Path) -> set[Path]:
    script_dir = script_path.parent
    source_code = script_path.read_text()
    ast_tree = parse(source_code, filename=script_path.name)
    script_paths = {script_path}

    for node in walk(ast_tree):
        if isinstance(node, (Import, ImportFrom)):
            base_name = node.module if isinstance(node, ImportFrom) else None
            for alias in node.names:
                name = base_name or alias.name
                candidate = script_dir.joinpath(*name.split('.')).with_suffix('.py')
                if candidate.exists():
                    script_paths.add(candidate)

    return script_paths
