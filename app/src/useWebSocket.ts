import { useCallback, useEffect, useRef, useState, useCallback } from "react";

export function useWebSocket(url: string, messageReceived) {
  const ws = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  const openWs = () => {
    let reconnectTimeout: any;

    const connect = () => {
      ws.current = new WebSocket(url);

      ws.current.onopen = () => {
        setIsConnected(true);
        console.info(`${location.host}: Backend is online!`);
      };

      ws.current.onmessage = (event) => {
        messageReceived(event.data)
      };

      ws.current.onclose = () => {
        setIsConnected(false);
        reconnectTimeout = setTimeout(connect, 2000);
      };
    };

    connect();

    return () => {
      clearTimeout(reconnectTimeout);

      if (ws.current) {
        ws.current.onopen = null;
        ws.current.onmessage = null;
        ws.current.onclose = null;
        ws.current.onerror = null;
        ws.current.close();
        ws.current = null;
      }
    };
  }

  let xxx = true;

  useEffect(() => {
    if (xxx) openWs()
    xxx = false
  }, [url]);

  const send = useCallback((data: any) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(typeof data === "string" ? data : JSON.stringify(data));
    } else {
      console.warn("WS not connected. Message not sent:", data);
    }
  })

  return { isConnected, send };
}
