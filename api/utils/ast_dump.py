#!/usr/bin/env python3

from sys import argv
from ast import parse, dump
from pathlib import Path

if __name__ == '__main__':
    assert len(argv) == 2, f'Usage: python {argv[0]} <script to dump>'

    script_path = Path(argv[1]).resolve()

    assert script_path.is_file(), f'File "{script_path.name}" does not exist or is a directory.'
    
    output_file = Path.cwd() / (script_path.stem + '.ast.txt')

    source_code = script_path.read_text()
    
    ast_tree = parse(source_code, filename=script_path.name)
    
    tree_dump = dump(ast_tree, indent=4)

    output_file.write_text(tree_dump)
