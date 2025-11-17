import { useEffect, useRef, useState } from "react";

export function useWebSocket(url: string) {
  const ws = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let reconnectTimeout: NodeJS.Timeout;

    const connect = () => {
      ws.current = new WebSocket(url);

      ws.current.onopen = () => {
        setIsConnected(true);
        console.log("WS Connected");
      };

      ws.current.onmessage = (event) => {
        setMessage(event.data);
      };

      //ws.current.onerror = (err) => {
      //  console.error("WS Error:", err);
      //};

      ws.current.onclose = () => {
        setIsConnected(false);
        console.log("WS Closed, reconnecting in 1s...");
        reconnectTimeout = setTimeout(connect, 1000); // reconnect after 1s
      };
    };

    connect();

    return () => {
      clearTimeout(reconnectTimeout);
    };
  }, [url]);

  const send = (data: any) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(typeof data === "string" ? data : JSON.stringify(data));
    } else {
      console.warn("WS not connected. Message not sent:", data);
    }
  };

  return { isConnected, message, send };
}
