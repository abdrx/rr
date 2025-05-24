const { Queue, Worker } = require('bullmq')
const connection = { host: '127.0.0.1', port: 6379 }

module.exports.paintQueue = new Queue('paint', { connection })

module.exports.startWorker = () =>
  new Worker('paint', require('./workers/paintJob'), { connection })
