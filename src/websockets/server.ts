import express from "express";
import { createServer } from "http";
import { Server, Socket } from "socket.io";
import { Queue } from "../queue";
import { uid } from "uid";
import { Chess, Color, DEFAULT_POSITION } from "chess.js";
import { saveGame } from "../DBQueries";

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000",
  },
});

const queue = new Queue<Socket>();

function initiateRematch(room: string) {
  const chessis = roomToChess.get(room);
  if (chessis) {
    chessis.load(DEFAULT_POSITION);
  }
}

function completePGNFormatter(
  PGN: string,
  players: string[],
  result: string,
  room: string,
) {
  let initStr: string = "";
  const dateObj = new Date();
  const month = dateObj.getUTCMonth() + 1; // months from 1-12
  const pMonth = month.toString().padStart(2, "0");
  const day = dateObj.getUTCDate();
  const pDay = day.toString().padStart(2, "0");
  const year = dateObj.getUTCFullYear();
  const hours = String(dateObj.getUTCHours()).padStart(2, "0");
  const minutes = String(dateObj.getUTCMinutes()).padStart(2, "0");
  const seconds = String(dateObj.getUTCSeconds()).padStart(2, "0");
  const dateString = year + "." + pMonth + "." + pDay;
  const utcTimeString = `${hours}:${minutes}:${seconds}`;

  initStr += `[Event "Casual online gameplay"]\n`;
  initStr += `[Site "https://chessdom.vercel.app"]\n`;
  initStr += `[White "${players[0]}"]\n`;
  initStr += `[Black "${players[1]}"]\n`;
  initStr += `[Result "${result}"]\n`;
  initStr += `[GameId "${room}"]\n`;
  initStr += `[UTCDate "${dateString}"]\n`;
  initStr += `[UTCTime "${utcTimeString}"]\n`;
  initStr += `[Variant "Standard"]\n\n`;
  initStr += PGN;
  return initStr;
}

function handleGameResignation(socket: Socket, user: string, playColor: Color) {
  const room = userToRoomMap.get(user);
  if (room) {
    socket.to(room).emit("resigned", playColor);
    const resgString: string = playColor === "w" ? "0-1" : "1-0";
    const chessis = roomToChess.get(room);
    let PGN = chessis?.pgn();
    if (PGN) {
      if (playColor === "w") {
        const pgnString: string = ` { White Resigns. } ${resgString} `;
        PGN += pgnString;
      } else {
        const pgnString = ` { Black Resigns. } ${resgString} `;
        PGN += pgnString;
      }
      const players = getUsersFromRoom(room);
      // Save Game To Database
      console.log(PGN); // EXP
      const finalPGN = completePGNFormatter(PGN, players, resgString, room);
      saveGame(players[1], players[0], room, finalPGN, resgString);
    }
  }
}

function handleRematch(user: string) {
  const room = userToRoomMap.get(user);
  if (room) {
    let rematchNumber = roomToRematchMap.get(room);
    if (rematchNumber) {
      if (rematchNumber === 1) {
        roomToRematchMap.delete(room);
        initiateRematch(room);
        io.to(room).emit("rematchconfirmed");
      } else {
        console.log(
          "rematch number is other than 1, and I don't know why It came here"
        );
      }
    } else {
      roomToRematchMap.set(room, 1);
    }
  }
}

function handleGameLeave(user: string) {
  const room = userToRoomMap.get(user);
  const tempSocket = userToSocket.get(user);
  if (tempSocket && room) {
    tempSocket.to(room).emit("playeroptednewgame");
  }
  if (room) {
    roomToChess.delete(room);
    roomToRematchMap.delete(room);
    const players = getUsersFromRoom(room);
    for (let i = 0; i < players.length; i++) {
      userToRoomMap.delete(players[i]);
      const socket = userToSocket.get(players[i]);
      socket?.leave(room);
      socket?.removeAllListeners("move");
      if (players[i] === user && socket) {
        socket.disconnect();
      }
    }
    userToSocket.delete(user);
  } else {
    // I am assuming that code flow will reach here when other player already
    // clicked new game, thus userToRoom entry doesn't exist;
    const socket = userToSocket.get(user);
    if (socket) {
      socket.disconnect();
    }
    userToSocket.delete(user);
  }
}

function handleNewGame(user: string) {
  const room = userToRoomMap.get(user);
  const tempSocket = userToSocket.get(user);
  if (tempSocket && room) {
    tempSocket.to(room).emit("playeroptednewgame");
  }
  if (room) {
    roomToChess.delete(room);
    roomToRematchMap.delete(room);
    const players = getUsersFromRoom(room);
    for (let i = 0; i < players.length; i++) {
      userToRoomMap.delete(players[i]);
      const sock = userToSocket.get(players[i]);
      sock?.leave(room);
      sock?.removeAllListeners("move");
      if (players[i] === user && sock) queue.enqueue(sock);
    }
    if (queue.length >= 2) makeRooms();
  } else {
    // I am assuming that code flow will reach here when other player already
    // clicked new game, thus userToRoom  entry doesn't exist;
    const socket = userToSocket.get(user);
    if (socket) {
      socket.removeAllListeners("move");
      queue.enqueue(socket);
    }
    if (queue.length >= 2) makeRooms();
  }
}

function banTheUser(room: string, color: Color) {
  const players = getUsersFromRoom(room);
  const notoriousUser = players[color === "w" ? 0 : 1];
  const evenUser = players[color === "w" ? 1 : 0];
  const currTime = new Date();
  bannedUsers.set(notoriousUser, currTime);

  ///////////////

  if (room) {
    io.in(room).socketsLeave(room);
    roomToChess.delete(room);
    roomToRematchMap.delete(room);
    for (let i = 0; i < players.length; i++) {
      userToTimeoutMap.delete(players[i]);
      userToRoomMap.delete(players[i]);
      userToTimeoutMap.delete(players[i]);
      const socket = userToSocket.get(players[i]);
      socket?.removeAllListeners("move");
      if (players[i] !== notoriousUser && socket) {
        console.log(
          "Testing If control is reaching the emit statement of opponentleftgame & room = " +
            room
        );
        socket.emit("opponentleftgame");
      } else if (players[i] === notoriousUser && socket) {
        socket.emit("banned", 30);
        socket.removeAllListeners();
        socket.disconnect();
      }
    }
    userToSocket.delete(notoriousUser);
  } else {
    // Don't know what to do if room is not there
  }
  ///////////////

  // handleUserBanning(notoriousUser, room);
  // handleNewGameBanned(evenUser, room);
}

function beginReconciliation(socket: Socket, color: Color) {
  const room = getRoomFromSocket(socket);
  const chessis = roomToChess.get(room);
  if (chessis === undefined) {
    // do something when chess object is not defined
    console.log("chess is not defined");
    return;
  }
  const x = chessis.history();

  function acknowledgementCallback(err: Error, response: string) {
    if (err) {
      console.log("no acknowledgement");
      socket
        .timeout(10000)
        .emit("reconciliation", x, color, (err: Error, response: string) =>
          acknowledgementCallback(err, response)
        );
      return;
    } else {
      console.log(response);
      socket.to(room).emit("opponentreconnected");
      return;
    }
    return;
  }

  socket
    .timeout(20000)
    .emit("reconciliation", x, color, (err: Error, response: string) => {
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

function cleanUsersAndRoom(user: string) {
  ///////////////
  if (user) {
    const room = userToRoomMap.get(user);
    userToTimeoutMap.delete(user);
    if (room) {
      io.in(room).socketsLeave(room);
      roomToChess.delete(room);
      roomToRematchMap.delete(room);
      const players = getUsersFromRoom(room);
      for (let i = 0; i < players.length; i++) {
        userToRoomMap.delete(players[i]);
        userToTimeoutMap.delete(players[i]);
        const socket = userToSocket.get(players[i]);
        socket?.removeAllListeners("move");
        if (players[i] !== user && socket) {
          console.log(
            "Testing If control is reaching the emit statement of opponentleftgame & room = " +
              room
          );
          socket.emit("opponentleftgame");
        }
      }
      userToSocket.delete(user);
    } else {
      // just a safety net
      userToSocket.delete(user);
    }
  }
  ///////////////
}

function registerMove(room: string, san: string, color: Color) {
  try {
    const chessis = roomToChess.get(room);
    if (chessis === undefined) {
      console.log("chess is not defined at the server");
      return;
    }
    if (color !== chessis.turn()) {
      throw new Error();
    }
    const xy = chessis.move(san);
    if (chessis.isGameOver()) {
      const players = getUsersFromRoom(room);
      // save the game to the database
      const gameDraw = chessis.isDraw();
      const resultStr: string = gameDraw
        ? "1/2-1/2"
        : chessis.turn() === "w"
        ? "0-1"
        : "1-0";
      const PGN = chessis.pgn() + ` ${resultStr}`;
      const finalPGN = completePGNFormatter(PGN, players, resultStr, room);
      saveGame(players[1], players[0], room, finalPGN, resultStr);
    }
    return true;
  } catch (err) {
    banTheUser(room, color);
    return false;
    // throw new Error("Chess thrown an error");
  }
}

const bannedUsers = new Map<string, Date>(); // \/
const roomToChess = new Map<string, Chess>(); // \/
const userToRoomMap = new Map<string, string>(); // \/
const userToSocket = new Map<string, Socket>(); // \/
const userToTimeoutMap = new Map<string, number>(); // \/
const roomToRematchMap = new Map<string, number>(); // \/

function moveListener(
  room: string,
  color: Color,
  san: string,
  socket: Socket,
  callback: Function
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
  console.log(`room : ${room}`); // FC
  console.log(`color: ${color}`); // FC
  console.log(`SAN : ${san}`); // FC
  console.log(`USER : ${socket.handshake.auth.username}`); // FC
  console.log("-------------------------------------------------");
  callback("ok");
  if (!registerMove(room, san, color)) return;
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
        if (
          sockets[0].handshake.auth.username ===
          sockets[1].handshake.auth.username
        ) {
          // fix the memory leak
          continue;
        }
        const room: string =
          uid(20) +
          "?user1=" +
          sockets[0].handshake.auth.username +
          "?user2=" +
          sockets[1].handshake.auth.username;
        sockets[0].join(room);
        sockets[1].join(room);
        const socket0 = sockets[0];
        const socket1 = sockets[1];
        // user1 is assigned color white
        sockets[0].on("move", (san: string, callback: Function) =>
          moveListener(room, "w", san, socket0, callback)
        );
        // user 2 is assigned color black
        sockets[1].on("move", (san: string, callback: Function) =>
          moveListener(room, "b", san, socket1, callback)
        );

        socket0.emit("gamecolor", "w");
        socket1.emit("gamecolor", "b");
        userToRoomMap.set(sockets[0].handshake.auth.username, room);
        userToRoomMap.set(sockets[1].handshake.auth.username, room);
        roomToChess.set(room, new Chess());
        io.to(room).emit("startgame");
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

  if (bannedUsers.has(socket.handshake.auth.username)) {
    let currTime = new Date().getTime();
    let prevTime = bannedUsers.get(socket.handshake.auth.username)?.getTime();
    if (prevTime) {
      const x = (currTime - prevTime) / 1000;
      if (x < 60) {
        socket.emit("banned", 60 - x);
        console.log(
          `${socket.handshake.auth.username} has been banned for ${
            60 - x
          } seconds`
        );
        return;
      } else {
        bannedUsers.delete(socket.handshake.auth.username);
        socket.emit("banlifted");
      }
    }
  }
  if (userToSocket.has(socket.handshake.auth.username)) {
    socket.disconnect();
    return;
  }
  socket.on("disconnect", (reason) => {
    console.log(
      `${socket.handshake.auth.username} is disconnected, reason : ${reason}`
    );
    userToSocket.delete(socket.handshake.auth.username);
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
    const chessis = roomToChess.get(roomSet);
    if (roomSet !== "" && chessis && !chessis.isGameOver()) {
      socket.to(roomSet).emit("opponentdisconnected");
      const timed = setTimeout(
        (author: string) => {
          cleanUsersAndRoom(author);
        },
        3000,
        socket.handshake.auth.username
      );
      userToTimeoutMap.set(socket.handshake.auth.username, timed);
    } else if (roomSet !== "" && chessis && chessis.isGameOver()) {
      handleGameLeave(socket.handshake.auth.username);
    } else {
      userToSocket.delete(socket.handshake.auth.username);
    }
  });

  socket.on("rematch", () => handleRematch(socket.handshake.auth.username));
  socket.on("newgame", () => handleNewGame(socket.handshake.auth.username));
  socket.on("gameleave", () => handleGameLeave(socket.handshake.auth.username));
  socket.on("resigned", (playColor: Color) =>
    handleGameResignation(socket, socket.handshake.auth.username, playColor)
  );

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
      let color: Color;
      if (users[0] === userName) {
        color = "w";
        socket.on("move", (san: string, callback: Function) =>
          moveListener(room, "w", san, socket, callback)
        );
      } else {
        color = "b";
        socket.on("move", (san: string, callback: Function) =>
          moveListener(room, "b", san, socket, callback)
        );
      }
      userToTimeoutMap.delete(userName);
      if (!userToSocket.has(userName)) userToSocket.set(userName, socket);
      beginReconciliation(socket, color);
      return;
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
