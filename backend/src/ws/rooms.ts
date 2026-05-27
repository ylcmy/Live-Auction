import type { Socket, Server } from 'socket.io';

export function joinRoom(socket: Socket, roomId: string) {
  socket.join(roomId);
}

export function leaveRoom(socket: Socket, roomId: string) {
  socket.leave(roomId);
}

export function getOnlineCount(io: Server, roomId: string): number {
  return io.sockets.adapter.rooms.get(roomId)?.size || 0;
}

export function broadcastToRoom(io: Server, roomId: string, event: string, data: any) {
  io.to(roomId).emit(event, data);
}
