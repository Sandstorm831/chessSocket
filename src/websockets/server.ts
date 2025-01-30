import express from 'express';
import {createServer} from 'http';
import {Server, Socket} from 'socket.io';
import { Queue } from '../queue';
import { uid } from 'uid';
import { Chess } from 'chess.js';

const app = express();
const server = createServer(app);
const io = new Server(server, {
    cors: {
        origin: 'http://localhost:3000'
    }
});

const queue = new Queue<Socket>();

function getRoomFromSocket(socket: Socket){
    let x = "";
    socket.rooms.forEach(sockt => {
        if(sockt.length !== 20) x = sockt;
    });
    return x;
}

function getUsersFromRoom(room: string){
    const temp = room.split('?user1=')[1];
    return temp.split('?user2=');
}

function clearnUserRoom(room: string, user: string){
    roomToChess.delete(room);
    userToTimeoutMap.delete(user);
    roomToSocketMap.delete(room);
    userToSocket.delete(user);
    const RoomUsers = getUsersFromRoom(room);
    for(let i=0; i<RoomUsers.length; i++){
        userToRoomMap.delete(RoomUsers[i]);
        if(RoomUsers[i] !== user){
            const x = userToSocket.get(RoomUsers[i])
            if(x === undefined) {}
            else{
                // See if you want the user to be able see the board without saying him to play new game.
                queue.enqueue(x);
                if(queue.length >= 2) makeRooms();
            }
        }
    }
}

function registerMove(room: string, san: string){
    try{
        const chessis = roomToChess.get(room);
        if(chessis === undefined){
            throw new Error('chess is undefined');
        }
        const xy = chessis.move(san);
        console.log(chessis.ascii())
        console.log(san);
    } catch(err){
        console.log(err);
        throw new Error('Chess thrown an error');
    }
}

const roomToChess = new Map<string, Chess>();
const roomToSocketMap = new Map<string, Socket[]>();
const userToRoomMap = new Map<string, string>();
const userToSocket = new Map<string, Socket>();
const userToTimeoutMap = new Map<string, number>();

function moveListener(room: string, socketNum: number, san: string, socket: Socket){

    function ackknowledgementCallback(err: Error, response: string){
        if(err){
            console.log("no acknowledgement")
            socket.timeout(10000).to(room).emit('move', san, (err: Error, response: string) => ackknowledgementCallback(err, response));
            return;
        }
        else{
            console.log(response)
            return;
        }
        return;
    }
    // console.log(socket);
    console.log(socket.rooms);
    registerMove(room, san)
    socket.timeout(10000).to(room).emit("move", san, (err: Error, response: string) => ackknowledgementCallback(err, response));
}

function makeRooms(){
    const sockets : Socket[] = [];
    while(queue.length > 0){
        const x = queue.peek();
        if(x?.connected){
            queue.dequeue();
            sockets.push(x);
            if(sockets.length === 2){
                const room : string = uid(20) + "?user1=" + sockets[0].handshake.auth.username + "?user2=" + sockets[1].handshake.auth.username;
                console.log(`room id = ${room}`);
                sockets[0].join(room);
                sockets[1].join(room);
                const socket0 = sockets[0];
                const socket1 = sockets[1];
                sockets[0].on('move', (san: string) => moveListener(room, 0, san, socket0));
                sockets[1].on('move', (san: string) => moveListener(room, 1, san, socket1));
                userToRoomMap.set(sockets[0].handshake.auth.username, room);
                userToRoomMap.set(sockets[1].handshake.auth.username, room);
                roomToChess.set(room, new Chess());
                roomToSocketMap.set(room, [sockets[0], sockets[1]]);
                sockets.length = 0;
            }
        }else{
            queue.dequeue();
        }
    }
    if(sockets.length === 1){
        if(!sockets[0].connected) {
            sockets.length = 0;
            return;
        }
        queue.enqueue(sockets[0]);
        sockets.length = 0;
        return;
    }
}

// socket.handshake.auth.username;

io.on('connection', (socket) => {
  console.log(`${socket.handshake.auth.username} has jointed`);
  console.log(`socket id : ${socket.id}`);


  socket.on('disconnect', (reason) => {
    console.log(`${socket.handshake.auth.username} is disconnected, reason : ${reason}`);
  })


  socket.on('disconnecting', (reason) => {
    console.log(`${socket.handshake.auth.username} is going to diconnect, corresponding room is :`);
    console.log(socket.rooms);
    let roomSet="";
    socket.rooms.forEach((x) => {
        if(x.length !== 20) roomSet = x;
    });
    console.log(roomSet);
    console.log(`length of socket rooms object : ${socket.rooms.size}`)
    const timed = setTimeout((room: string, author: string) => {
        if(room !== "") clearnUserRoom(room, author)
        console.log(room);
        console.log(`author = ${author}`)
    }, 3000, roomSet, socket.handshake.auth.username);
    userToTimeoutMap.set(socket.handshake.auth.username, timed);
    console.log(timed);
  })


  if(userToTimeoutMap.has(socket.handshake.auth.username)){
    const userName = socket.handshake.auth.username;
    clearTimeout(userToTimeoutMap.get(userName));
    const room = userToRoomMap.get(userName);
    if(room === undefined){
        // should I do something other than following him the normal route ??
        // room is not there for the corresponding user, thus display that his room/game is dissolved thus trying to get a new game for him
    }else{
        socket.join(room);
        socket.on('move', (san: string) => moveListener(room, 0, san, socket));
        userToTimeoutMap.delete(userName);
        userToSocket.set(userName, socket);
        const sockets = roomToSocketMap.get(room);
        if(sockets === undefined){
            // do something when no socket array is found for a room ....
            throw new Error();
        }
        for(let i=0; i<sockets.length; i++){
            if(!sockets[i].connected){
                sockets[i] = socket;
                break;
            }
        }
        roomToSocketMap.set(room, sockets);
        console.log('finally joined the old room');
        console.log(room);
    }
  }
  userToSocket.set(socket.handshake.auth.username, socket);

  queue.enqueue(socket);

  if(queue.length >= 2) {
    makeRooms();
  }

});

server.listen(8080, () => {
  console.log('server running at http://localhost:8080');
});