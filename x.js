const {Chess, DEFAULT_POSITION} = require('chess.js');

const chess = new Chess()
console.log(chess);
// chess.board()
// console.log(chess.ascii())
while (!chess.isGameOver()) {
  const moves = chess.moves()
  const move = moves[Math.floor(Math.random() * moves.length)]
  chess.move(move)
  console.log(chess.fen() + '\n');
}
console.log(chess.history());
console.log(chess.fen())
chess.load(DEFAULT_POSITION);
console.log(chess.history());
console.log(chess.fen())
// console.log(chess.pgn())