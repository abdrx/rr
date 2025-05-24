const db = require('../database')
const { io } = require('../socket')
const { getPrompt } = require('../services/openRouterService')
const { createImage } = require('../services/openAIService')

module.exports = async job => {
  const { paintingId, title, instructions, refs } = job.data

  await db.query('update paintings set status="prompt" where id=?', [paintingId])
  io.emit('painting', { id: paintingId, status: 'prompt' })

  let prompt
  try {
    prompt = await getPrompt(title, instructions)
    await db.query('update paintings set prompt=? where id=?', [prompt, paintingId])
  } catch (e) {
    await db.query('update paintings set status="fail", error_message=? where id=?', [e.message, paintingId])
    return io.emit('painting', { id: paintingId, status: 'fail' })
  }

  await db.query('update paintings set status="image" where id=?', [paintingId])
  io.emit('painting', { id: paintingId, status: 'image' })

  try {
    const url = await createImage(prompt, refs)
    await db.query('update paintings set status="done", image_url=? where id=?', [url, paintingId])
    io.emit('painting', { id: paintingId, status: 'done', url })
  } catch (e) {
    await db.query('update paintings set status="fail", error_message=? where id=?', [e.message, paintingId])
    io.emit('painting', { id: paintingId, status: 'fail' })
  }
}
