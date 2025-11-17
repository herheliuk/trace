#!/usr/bin/env python3

from sys import stdin, stdout, exit as sys_exit

try:
    from msvcrt import getch   # Windows
except:
    from termios import tcgetattr, tcsetattr, TCSADRAIN
    from tty import setraw
    def getch():
        file_descriptor = stdin.fileno()
        old_settings = tcgetattr(file_descriptor)
        try:
            setraw(file_descriptor)
            return stdin.read(1).encode()
        finally:
            tcsetattr(file_descriptor, TCSADRAIN, old_settings)

def await_command(prompt):
    stdout.write(prompt)
    stdout.flush()
    buffer = b""

    while True:
        match getch():
            # Digits
            case char if char.isdigit():
                buffer += char
                stdout.write(char.decode())
                stdout.flush()

            # Enter
            case b"\r" | b"\n":
                # Erasing typed-in data from the terminal
                stdout.write("\b \b" * len(buffer))
                stdout.flush()
                
                stdout.write('\n')
                decoded = buffer.decode()
                if decoded.isdigit():
                    return 'int', decoded
                return 'enter', None

            # Backspace
            case b"\x08" | b"\x7f":
                if not buffer:
                    stdout.write("\n")
                    return 'backspace', None
                else:
                    buffer = buffer[:-1]
                    stdout.write("\b \b")
                    stdout.flush()

            # Ctrl + C | ESC
            case b"\x03" | b"\x1b":
                stdout.write("\n")
                sys_exit(1)

if __name__ == '__main__':
    while True:
        code, return_value = await_command("> ")

        match code:
            case 'enter':
                print("NEXT")
            case 'backspace':
                print("PREV")
            case 'int':
                print(f"JUMP {return_value}")
