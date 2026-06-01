'use strict'

const cds = require('@sap/cds')
const multer = require('multer')

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } })

cds.on('bootstrap', (app) => {
  app.post('/api/files/upload', upload.array('files'), async (req, res) => {
    const svc = await cds.connect.to('FileManagerService')
    return svc._handleUpload(req, res)
  })
  app.get('/api/files/download', async (req, res) => {
    const svc = await cds.connect.to('FileManagerService')
    return svc._handleDownload(req, res)
  })
})

// Increase keep-alive timeout to avoid 502s from CF router
cds.once('listening', ({ server }) => {
  server.keepAliveTimeout = 3 * 60 * 1000
})

module.exports = cds.server
