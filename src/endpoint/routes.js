import { nanoid } from 'nanoid'
import Joi from 'joi'
import boom from '@hapi/boom'
import { logger } from '@libp2p/logger'
import { tmpDir } from '../utils.js'

/**
 * @typedef {import('../types').Factory} Factory
 */

const debug = logger('ipfsd-ctl:routes')

const routeOptions = {
  validate: {
    query: Joi.object({
      id: Joi.string().required()
    })
  }
}

/**
 * @param {Error & { stdout?: string }} err
 */
const badRequest = err => {
  let msg
  if (err.stdout) {
    msg = err.stdout + ' - ' + err.message
  } else {
    msg = err.message
  }
  debug(err)
  throw boom.badRequest(msg)
}

/**
 * @type {Record<string, any>}
 */
const nodes = {}

/**
 * @namespace EndpointServerRoutes
 * @ignore
 * @param {import('@hapi/hapi').Server} server
 * @param {() => Factory | Promise<Factory>} createFactory
 * @returns {void}
 */
export default (server, createFactory) => {
  server.route({
    method: 'GET',
    path: '/util/tmp-dir',
    handler: async (request) => {
      const type = request.query.type || 'go'
      try {
        return { tmpDir: await tmpDir(type) }
      } catch (/** @type {any} */ err) {
        badRequest(err)
      }
    }
  })

  server.route({
    method: 'GET',
    path: '/version',
    handler: async (request) => {
      const id = request.query.id

      try {
        return { version: await nodes[id].version() }
      } catch (/** @type {any} */ err) {
        badRequest(err)
      }
    },
    options: routeOptions
  })

  server.route({
    method: 'POST',
    path: '/spawn',
    handler: async (request) => {
      const opts = request.payload || {}
      try {
        const ipfsd = await createFactory()
        const id = nanoid()
        // @ts-expect-error opts is a json object
        nodes[id] = await ipfsd.spawn(opts)
        return {
          id: id,
          apiAddr: nodes[id].apiAddr ? nodes[id].apiAddr.toString() : '',
          gatewayAddr: nodes[id].gatewayAddr ? nodes[id].gatewayAddr.toString() : '',
          grpcAddr: nodes[id].grpcAddr ? nodes[id].grpcAddr.toString() : '',
          initialized: nodes[id].initialized,
          started: nodes[id].started,
          disposable: nodes[id].disposable,
          env: nodes[id].env,
          path: nodes[id].path,
          clean: nodes[id].clean
        }
      } catch (/** @type {any} */ err) {
        badRequest(err)
      }
    }
  })

  /*
   * Initialize a repo.
   */
  server.route({
    method: 'POST',
    path: '/init',
    handler: async (request) => {
      const id = request.query.id
      const payload = request.payload || {}

      try {
        await nodes[id].init(payload)

        return {
          initialized: nodes[id].initialized
        }
      } catch (/** @type {any} */ err) {
        badRequest(err)
      }
    },
    options: routeOptions
  })

  /*
   * Start the daemon.
   */
  server.route({
    method: 'POST',
    path: '/start',
    handler: async (request) => {
      const id = request.query.id

      try {
        await nodes[id].start()

        return {
          apiAddr: nodes[id].apiAddr ? nodes[id].apiAddr.toString() : '',
          gatewayAddr: nodes[id].gatewayAddr ? nodes[id].gatewayAddr.toString() : '',
          grpcAddr: nodes[id].grpcAddr ? nodes[id].grpcAddr.toString() : ''
        }
      } catch (/** @type {any} */ err) {
        badRequest(err)
      }
    },
    options: routeOptions
  })

  /*
   * Delete the repo that was being used.
   * If the node was marked as `disposable` this will be called
   * automatically when the process is exited.
   */
  server.route({
    method: 'POST',
    path: '/cleanup',
    handler: async (request, h) => {
      const id = request.query.id

      try {
        await nodes[id].cleanup()

        return h.response().code(200)
      } catch (/** @type {any} */ err) {
        badRequest(err)
      }
    },
    options: routeOptions
  })

  /*
   * Stop the daemon.
   */
  server.route({
    method: 'POST',
    path: '/stop',
    handler: async (request, h) => {
      const id = request.query.id

      try {
        await nodes[id].stop()

        return h.response().code(200)
      } catch (/** @type {any} */ err) {
        badRequest(err)
      }
    },
    options: routeOptions
  })

  /*
   * Get the pid of the `ipfs daemon` process.
   */
  server.route({
    method: 'GET',
    path: '/pid',
    handler: async (request) => {
      const id = request.query.id

      return { pid: await nodes[id].pid() }
    },
    options: routeOptions
  })
}
