const {Chess} = require('chess.js');

const chess = new Chess()
console.log(chess);
chess.board()
// console.log(chess.ascii())
while (!chess.game_over()) {
  const moves = chess.moves()
  const move = moves[Math.floor(Math.random() * moves.length)]
  chess.move(move)
  console.log(chess.fen() + '\n');
}
// console.log(chess.pgn())