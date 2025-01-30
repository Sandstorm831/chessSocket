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
    },
    connectionStateRecovery: {
        maxDisconnectionDuration: 60 * 1000,
    }
});

const queue = new Queue<Socket>();

function registerMove(room: string, san: string){
    try{
        const chessis = chessMap.get(room);
        if(chessis === undefined){
            throw new Error('chess is undefined');
        }
        const xy = chessis.move(san);
        console.log(san);
    } catch(err){
        console.log(err);
        throw new Error('Chess thrown an error');
    }
}

const chessMap = new Map<string, Chess>();
const socketMap = new Map<string, Socket[]>();

function moveListener(room: string, socket: number, san: string){

    function ackknowledgementCallback(err: Error, response: string){
        if(err){
            console.log("no acknowledgement")
            socketA.timeout(10000).to(room).emit('move', san, (err: Error, response: string) => ackknowledgementCallback(err, response));
            return;
        }
        else{
            console.log(response)
            return;
        }
        return;
    }

    registerMove(room, san)
    const socketArry = socketMap.get(room);
    if(socketArry === undefined) throw new Error('room does not contain any socket array')
    const socketA = socketArry[socket];
    socketA.timeout(10000).to(room).emit("move", san, (err: Error, response: string) => ackknowledgementCallback(err, response));
}

function makeRooms(){
    const sockets : Socket[] = [];
    while(queue.length > 0){
        const x = queue.peek();
        if(x?.connected){
            queue.dequeue();
            sockets.push(x);
            if(sockets.length === 2){
                const room : string = uid(16) + "_" + sockets[0].handshake.auth.username + "_" + sockets[1].handshake.auth.username;
                console.log(`room id = ${room}`);
                sockets[0].join(room);
                sockets[1].join(room);
                sockets[0].on('move', (san: string) => moveListener(room, 0, san));
                sockets[1].on('move', (san: string) => moveListener(room, 1, san));
                chessMap.set(room, new Chess());
                socketMap.set(room, [sockets[0], sockets[1]]);
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
  if(socket.recovered){
    console.log("state recovered")
    console.log(`socket rooms : ${socket.rooms}`);
    console.log(`recovered socket id : ${socket.id}`);
    // trigger event to each memeber of room of the latest state.
  }
  queue.enqueue(socket);

//   socket.recovered()
//   socket.disconnect(true)
  if(queue.length >= 2) {
    makeRooms();
  }

});

server.listen(8080, () => {
  console.log('server running at http://localhost:8080');
});