from types import FrameType

def get_stack(frame: FrameType) -> list[FrameType]:
    stack = []
    stack_append = stack.append
    
    while frame is not None:
        stack_append(frame)
        frame = frame.f_back

    stack.reverse()
    return stack
