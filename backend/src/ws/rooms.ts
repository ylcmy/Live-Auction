import type { Socket, Server } from 'socket.io';

const roomClients = new Map<string, Set<string>>(); // roomId -> Set<socketId>

export function joinRoom(socket: Socket, roomId: string) {
  socket.join(roomId);
  if (!roomClients.has(roomId)) roomClients.set(roomId, new Set());
  roomClients.get(roomId)!.add(socket.id);
}

export function leaveRoom(socket: Socket, roomId: string) {
  socket.leave(roomId);
  const clients = roomClients.get(roomId);
  if (clients) {
    clients.delete(socket.id);
    if (clients.size === 0) roomClients.delete(roomId);
  }
}

export function removeClient(socketId: string) {
  for (const [roomId, clients] of roomClients) {
    if (clients.has(socketId)) {
      clients.delete(socketId);
      if (clients.size === 0) roomClients.delete(roomId);
      return roomId;
    }
  }
  return null;
}

export function getRoomClients(roomId: string): string[] {
  return Array.from(roomClients.get(roomId) || []);
}

export function getOnlineCount(roomId: string): number {
  return roomClients.get(roomId)?.size || 0;
}

export function broadcastToRoom(io: Server, roomId: string, event: string, data: any) {
  io.to(roomId).emit(event, data);
}
