import React, { createContext, useContext } from 'react';

export interface DebuggerState {
  event: string | null;
  file: string | null;
  function: string | null;
  frame_id: number | null;
  line_number: number | null;
  globals: Record<string, any>;
  locals: Record<string, any>;
  return_value: any;
  error: any;
}

export const DebuggerStateContext =
  createContext<DebuggerState | null>(null);

export function useDebuggerState() {
  return useContext(DebuggerStateContext);
}
