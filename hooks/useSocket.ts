"use client";

import { useEffect, useMemo } from "react";
import { io, type Socket } from "socket.io-client";
import { socketUrl } from "@/lib/config";

export function useSocket(): Socket {
  const socket = useMemo(
    () =>
      io(socketUrl, {
        autoConnect: false,
        withCredentials: true,
        transports: ["websocket", "polling"]
      }),
    []
  );

  useEffect(() => {
    socket.connect();
    return () => {
      socket.disconnect();
    };
  }, [socket]);

  return socket;
}
