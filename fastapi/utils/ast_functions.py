#!/usr/bin/env python3

from ast import parse, walk, Import, ImportFrom, stmt, get_source_segment
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

def get_source_code_cache(script_path: Path):
    source_code = script_path.read_text()
    script_lines = source_code.splitlines()
    ast_tree = parse(source_code, filename=script_path.name)
    
    stmt_lines = {}
    for node in walk(ast_tree):
        if isinstance(node, stmt):
            segment = get_source_segment(source_code, node)
            stmt_lines[node.lineno] = segment
    
    source_code_cache = {}
    for lineno, line in enumerate(script_lines, start=1):
        if lineno in stmt_lines:
            source_code_cache[lineno] = {'segment': stmt_lines[lineno]}
        else:
            source_code_cache[lineno] = {'line': line}
    
    return source_code_cache
