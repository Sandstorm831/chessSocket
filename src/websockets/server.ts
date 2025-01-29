import express from 'express';
import {createServer} from 'http';
import {Server, Socket} from 'socket.io';
import { Queue } from '../queue';
import { uid } from 'uid';
import { Chess } from 'chess.js';

const app = express();
const server = createServer(app);
const io = new Server(server);

const queue = new Queue<Socket>();

function registerMove(room: string, san: string){
    try{
        const chessis = chessMap.get(room);
        if(chessis === undefined){
            throw new Error('chess is undefined');
        }
        // const moves = chessis.moves()
        // const move = moves[Math.floor(Math.random() * moves.length)]
        // const x = chessis.move(move)
        // console.log(chessis.fen() + '\n');
        // console.log(x);
        console.log(typeof san)
        const xy = chessis.move(san);
        console.log(chessis.moves());
        console.log(san);
        console.log(chessis.fen());
    } catch(err){
        console.log(err);
        throw new Error('Chess thrown an error');
    }
}

const chessMap = new Map<string, Chess>();
const socketMap = new Map<string, Socket[]>();

function moveListener(room: string, socket: number, san: string){
    registerMove(room, san)
    const socketArry = socketMap.get(room);
    if(socketArry === undefined) throw new Error('room does not contain any socket array')
    console.log(socketArry.length)
    const socketA = socketArry[socket]
    console.log(socketA.id);
    socketA.to(room).emit("move", san);
}

function makeRooms(){
    const sockets : Socket[] = [];
    while(queue.length > 0){
        const x = queue.peek();
        if(x?.connected){
            queue.dequeue();
            sockets.push(x);
            if(sockets.length === 2){
                const room : string = uid(16);// + "_" + sockets[0].handshake.auth.username + "_" + sockets[1].handshake.auth.username;
                console.log(room);
                sockets[0].join(room);
                sockets[1].join(room);
                sockets[0].on('move', (san: string) => moveListener(room, 0, san));
                sockets[1].on('move', (san: string) => moveListener(room, 1, san));
                const x = new Chess();
                x.load("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
                chessMap.set(room, x);
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
  console.log('a user connected');
  queue.enqueue(socket);
  console.log(queue.length);
  if(queue.length >= 2) {
    console.log("am I coming here")
    console.log(socket.id);
    makeRooms();
  }

});

server.listen(3000, () => {
  console.log('server running at http://localhost:3000');
});