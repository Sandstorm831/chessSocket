import express from "express";
import { createServer } from "http";
import { Server, Socket } from "socket.io";
import { Queue } from "../queue";
import { uid } from "uid";
import { Chess, Color } from "chess.js";

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000",
  },
});

const queue = new Queue<Socket>();

function handleUserBanning(notoriousUser: string, room: string){
    roomToChess.delete(room);
    userToRoomMap.delete(notoriousUser);
    userToTimeoutMap.delete(notoriousUser);
    const notoriousSocket = userToSocket.get(notoriousUser);
    if(notoriousSocket !== undefined){
        notoriousSocket.emit('banned', "you are banned for an hour for the attempt of tampering with servers");
    }
    userToSocket.delete(notoriousUser);
}

function handleUserNewGame(evenUser: string, room: string){
  userToRoomMap.delete(evenUser);
  roomToChess.delete(room);
  const evenSocket = userToSocket.get(evenUser);
  if(evenSocket !== undefined){
    evenSocket.emit('newgame', "opponent left unexpectedly, transferring to a new game");
    queue.enqueue(evenSocket);
    if(queue.length >= 2) makeRooms();
  }
}

function banTheUser(room: string, color: Color){
    const users = getUsersFromRoom(room);
    const notoriousUser = users[color === 'w' ? 0 : 1];
    const evenUser = users[color === 'w' ? 1 : 0]
    const currTime = new Date();
    bannedUsers.set(notoriousUser, currTime);
    handleUserBanning(notoriousUser, room);
    handleUserNewGame(evenUser, room);
}

function beginReconciliation(socket: Socket){
    const room = getRoomFromSocket(socket);
    const chessis = roomToChess.get(room);
    if(chessis === undefined){
        // do something when chess object is not defined
        throw new Error('chess is not defined');
    }
    const x = chessis.history();

    function acknowledgementCallback(err: Error, response: string){
        if (err) {
            console.log("no acknowledgement");
            socket
              .timeout(10000)
              .to(room)
              .emit("reconciliation", x, (err: Error, response: string) =>
                acknowledgementCallback(err, response)
              );
            return;
          } else {
            console.log(response);
            return;
          }
          return;
    }

    socket.timeout(20000).emit('reconciliation', x, (err: Error, response: string) => {
        acknowledgementCallback(err, response);
    });
}

function getRoomFromSocket(socket: Socket) {
  let x = "";
  socket.rooms.forEach((sockt) => {
    if (sockt.length !== 20) x = sockt;
  });
  return x;
}

function getUsersFromRoom(room: string) {
  const temp = room.split("?user1=")[1];
  return temp.split("?user2=");
}

function clearnUserRoom(room: string, user: string) {
  roomToChess.delete(room);
  userToTimeoutMap.delete(user);
  roomToSocketMap.delete(room);
  userToSocket.delete(user);
  const RoomUsers = getUsersFromRoom(room);
  for (let i = 0; i < RoomUsers.length; i++) {
    userToRoomMap.delete(RoomUsers[i]);
    if (RoomUsers[i] !== user) {
      const x = userToSocket.get(RoomUsers[i]);
      if (x === undefined) {
      } else {
        // See if you want the user to be able see the board without saying him to play new game.
        queue.enqueue(x);
        if (queue.length >= 2) makeRooms();
      }
    }
  }
}

function registerMove(room: string, san: string, color: Color) {
  try {
    const chessis = roomToChess.get(room);
    if (chessis === undefined) {
        console.log("chess is not defined at the server");
        return;
    }
    if(color !== chessis.turn()){
        throw new Error()
    }
    const xy = chessis.move(san);
    console.log(chessis.ascii());
    console.log(san);
  } catch (err) {
    console.log(err);
    banTheUser(room, color);
    throw new Error("Chess thrown an error");
  }
}

const bannedUsers = new Map<string, Date>();
const roomToChess = new Map<string, Chess>();
const roomToSocketMap = new Map<string, Socket[]>();
const userToRoomMap = new Map<string, string>();
const userToSocket = new Map<string, Socket>();
const userToTimeoutMap = new Map<string, number>();

function moveListener(
  room: string,
  color: Color,
  san: string,
  socket: Socket
) {
  function ackknowledgementCallback(err: Error, response: string) {
    if (err) {
      console.log("no acknowledgement");
      socket
        .timeout(10000)
        .to(room)
        .emit("move", san, (err: Error, response: string) =>
          ackknowledgementCallback(err, response)
        );
      return;
    } else {
      console.log(response);
      return;
    }
    return;
  }
  // console.log(socket);
  console.log(socket.rooms);
  registerMove(room, san, color);
  socket
    .timeout(10000)
    .to(room)
    .emit("move", san, (err: Error, response: string) =>
      ackknowledgementCallback(err, response)
    );
}

function makeRooms() {
  const sockets: Socket[] = [];
  while (queue.length > 0) {
    const x = queue.peek();
    if (x?.connected) {
      queue.dequeue();
      sockets.push(x);
      if (sockets.length === 2) {
        const room: string =
          uid(20) +
          "?user1=" +
          sockets[0].handshake.auth.username +
          "?user2=" +
          sockets[1].handshake.auth.username;
        console.log(`room id = ${room}`);
        sockets[0].join(room);
        sockets[1].join(room);
        const socket0 = sockets[0];
        const socket1 = sockets[1];
        // user1 is assigned color white
        sockets[0].on("move", (san: string) =>
          moveListener(room, 'w', san, socket0)
        );
        // user 2 is assigned color black
        sockets[1].on("move", (san: string) =>
          moveListener(room, 'b', san, socket1)
        );
        userToRoomMap.set(sockets[0].handshake.auth.username, room);
        userToRoomMap.set(sockets[1].handshake.auth.username, room);
        roomToChess.set(room, new Chess());
        roomToSocketMap.set(room, [sockets[0], sockets[1]]);
        sockets.length = 0;
      }
    } else {
      queue.dequeue();
    }
  }
  if (sockets.length === 1) {
    if (!sockets[0].connected) {
      sockets.length = 0;
      return;
    }
    queue.enqueue(sockets[0]);
    sockets.length = 0;
    return;
  }
}

// socket.handshake.auth.username;

io.on("connection", (socket) => {
  console.log(`${socket.handshake.auth.username} has jointed`);
  console.log(`socket id : ${socket.id}`);

  if(bannedUsers.has(socket.handshake.auth.username)){
    let currTime = new Date().getTime();
    let prevTime = bannedUsers.get(socket.handshake.auth.username)?.getTime();
    if(prevTime !== undefined){
        const x = (currTime - prevTime)/1000;
        if(x < 60){
          socket.emit('banned', `you are banned for ${Math.ceil(x/60)} minutes for the attempt of tampering with servers`);
          console.log(`${socket.handshake.auth.username} has been banned for ${Math.ceil(x/60)} minutes`)
          return;
        }
        else{
          bannedUsers.delete(socket.handshake.auth.username);
        }
    }
  }

  socket.on("disconnect", (reason) => {
    console.log(
      `${socket.handshake.auth.username} is disconnected, reason : ${reason}`
    );
  });

  socket.on("disconnecting", (reason) => {
    console.log(
      `${socket.handshake.auth.username} is going to diconnect, corresponding room is :`
    );
    console.log(socket.rooms);
    let roomSet = "";
    socket.rooms.forEach((x) => {
      if (x.length !== 20) roomSet = x;
    });
    console.log(roomSet);
    console.log(`length of socket rooms object : ${socket.rooms.size}`);
    const timed = setTimeout(
      (room: string, author: string) => {
        if (room !== "") clearnUserRoom(room, author);
        console.log(room);
        console.log(`author = ${author}`);
      },
      3000,
      roomSet,
      socket.handshake.auth.username
    );
    userToTimeoutMap.set(socket.handshake.auth.username, timed);
    console.log(timed);
  });

  if (userToTimeoutMap.has(socket.handshake.auth.username)) {
    const userName = socket.handshake.auth.username;
    clearTimeout(userToTimeoutMap.get(userName));
    const room = userToRoomMap.get(userName);
    if (room === undefined) {
      // should I do something other than following him the normal route ??
      // room is not there for the corresponding user, thus display that his room/game is dissolved thus trying to get a new game for him
    } else {
      socket.join(room);
      const users = getUsersFromRoom(room);
      if(users[0] === userName) socket.on("move", (san: string) => moveListener(room, 'w', san, socket));
      else socket.on("move", (san: string) => moveListener(room, 'b', san, socket));
      userToTimeoutMap.delete(userName);
      userToSocket.set(userName, socket);
      console.log("finally joined the old room");
      console.log(room);
      beginReconciliation(socket);
    }
  }
  userToSocket.set(socket.handshake.auth.username, socket);

  queue.enqueue(socket);

  if (queue.length >= 2) {
    makeRooms();
  }
});

server.listen(8080, () => {
  console.log("server running at http://localhost:8080");
});
