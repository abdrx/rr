const { Server } = require('socket.io')
let io
module.exports.init = httpServer => {
  io = new Server(httpServer, { cors: { origin: '*' } })
  module.exports.io = io
}
