let io;

function init(socketIo) {
  io = socketIo;
}

function emit(event, data) {
  if (io) {
    io.emit(event, data);
  }
}

module.exports = { init, emit };
