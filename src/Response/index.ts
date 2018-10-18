/* tslint:disable:max-line-length */

/**
 * node-res
 *
 * (c) Harminder Virk <virk@adonisjs.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { Stream } from 'stream'
import { IncomingMessage, ServerResponse } from 'http'
import * as mime from 'mime-types'
import * as etag from 'etag'
import * as vary from 'vary'
import * as onFinished from 'on-finished'
import * as destroy from 'destroy'
import methods from '../methods'
import { returnContentAndType } from '../utils'

/**
 * A simple IO module to make consistent HTTP response, without
 * worrying about underlying details.
 */
export class Response {
  public static descriptiveMethods = methods

  /**
   * Returns the value of an existing header on
   * the response object.
   *
   * @return Return type depends upon the header existing value
   *
   * ```js
   * nodeRes.getHeader(res, 'Content-type')
   * ```
   */
  public static getHeader (res: ServerResponse, key: string): string | number | string[] | undefined {
    return res.getHeader(key)
  }

  /**
   * Sets header on the response object. This method will wipe off
   * existing values. To append to existing values, use `append`.
   *
   * ```js
   * nodeRes.header(res, 'Content-type', 'application/json')
   *
   * // or set an array of headers
   * nodeRes.header(res, 'Link', ['<http://localhost/>', '<http://localhost:3000/>'])
   * ```
   */
  public static header (res: ServerResponse, key: string, value: string | number | string[]): void {
    const values = Array.isArray(value) ? value.map(String) : value
    res.setHeader(key, values)
  }

  /**
   * Appends value to the header existing values.
   *
   * ```js
   * nodeRes.append(res, 'Content-type', 'application/json')
   *
   * // or append an array of headers
   * nodeRes.append(res, 'Link', ['<http://localhost/>', '<http://localhost:3000/>'])
   * ```
   */
public static append (res: ServerResponse, key: string, value: string | number | string[]): void {
  const previousValue = Response.getHeader(res, key)

  if (typeof value === 'number') {
    value = value.toString()
  }

  const headers = previousValue
    ? (Array.isArray(previousValue) ? previousValue.concat(value) : [previousValue.toString()].concat(value))
    : value

    Response.header(res, key, headers)
}

  /**
   * Set status on the HTTP res object.
   *
   * ```js
   * nodeRes.status(res, 200)
   * ```
   */
  public static status (res: ServerResponse, code: number): void {
    res.statusCode = code
  }

  /**
   * Sets the header on response object, only if it
   * does not exists.
   *
   * ```js
   * nodeRes.safeHeader(res, 'Content-type', 'application/json')
   * ```
   */
  public static safeHeader (res: ServerResponse, key: string, value: string | number | string[]): void {
    if (!res.getHeader(key)) {
      Response.header(res, key, value)
    }
  }

  /**
   * Removes the header from response.
   *
   * ```js
   * nodeRes.removeHeader(res, 'Content-type')
   * ```
   */
  public static removeHeader (res: ServerResponse, key: string): void {
    res.removeHeader(key)
  }

  /**
   * Write string or buffer to the response object.
   *
   * ```js
   * nodeRes.write(res, 'Hello world')
   * ```
   */
  public static write (res: ServerResponse, body: any): void {
    res.write(body)
  }

  /**
   * Explictly end HTTP response.
   *
   * ```js
   * nodeRes.end(res, 'Hello world')
   * ```
   */
  public static end (res: ServerResponse, payload?: any): void {
    res.end(payload)
  }

  /**
   * Send body as the HTTP response and end it. Also
   * this method will set the appropriate `Content-type`
   * and `Content-length`.
   *
   * If body is set to null, this method will end the response
   * as 204.
   *
   * ```js
   * nodeRes.send(req, res, 'Hello world')
   *
   * // or html
   * nodeRes.send(req, res, '<h2> Hello world </h2>')
   *
   * // or JSON
   * nodeRes.send(req, res, { greeting: 'Hello world' })
   *
   * // or Buffer
   * nodeRes.send(req, res, Buffer.from('Hello world', 'utf-8'))
   *
   * // Ignore etag
   * nodeRes.send(req, res, 'Hello world', false)
   * ```
   */
  public static send (req: IncomingMessage, res: ServerResponse, body?: any, generateEtag: boolean = true): void {
    // Handle streams
    if (body && typeof (body.pipe) === 'function') {
      Response
        .stream(res, body)
        .catch((error) => {
          Response.status(res, error.code === 'ENOENT' ? 404 : 500)
          Response.send(req, res, error.message, generateEtag)
        })
      return
    }

    const chunk = Response.prepare(res, body)

    if (chunk === null || chunk === undefined || req.method === 'HEAD') {
      Response.end(res)
      return
    }

    // Generate etag when instructured for
    if (generateEtag) {
      Response.etag(res, chunk)
    }

    Response.end(res, chunk)
  }

  /**
   * Sets the Etag header for a given body chunk.
   *
   * ```js
   * nodeRes.etag(res, 'Hello world')
   * ```
   */
  public static etag (res: ServerResponse, body: any): void {
    Response.header(res, 'ETag', etag(body))
  }

  /**
   * Prepares the response body by encoding it properly. Also
   * sets appropriate headers based upon the body content type.
   *
   * This method is used internally by `send`, so you should
   * never use it when calling `send`.
   *
   * It is helpful when you want to get the final payload and end the
   * response at a later stage.
   *
   * ```js
   * const chunk = nodeRes.prepare(res, '<h2> Hello </h2>')
   *
   * if (chunk) {
   *   nodeRes.etag(res, chunk)
   *
   *   if (nodeReq.fresh(req, res)) {
   *     chunk = null
   *     nodeRes.status(304)
   *   }
   *
   *   nodeRes.end(chunk)
   * }
   * ```
   */
  public static prepare (res: ServerResponse, body: any): string | null {
    if (body === null || body === undefined) {
      Response.status(res, methods.noContent)
      Response.removeHeader(res, 'Content-Type')
      Response.removeHeader(res, 'Content-Length')
      Response.removeHeader(res, 'Transfer-Encoding')
      return null
    }

    let { body: chunk, type } = returnContentAndType(body)

    // Remove unwanted headers when statuscode is 204 or 304
    if (res.statusCode === methods.noContent || res.statusCode === methods.notModified) {
      Response.removeHeader(res, 'Content-Type')
      Response.removeHeader(res, 'Content-Length')
      Response.removeHeader(res, 'Transfer-Encoding')
      return chunk
    }

    const headers = typeof res.getHeaders === 'function' ? res.getHeaders() : {}

    /**
     * Setting content type. Ideally we can use `Response.type`, which
     * sets the right charset too. But we will be doing extra
     * processing for no reasons.
     */
    if (type && !headers['content-type']) {
      Response.header(res, 'Content-Type', `${type}; charset=utf-8`)
    }

    // Setting up content length as response header
    if (chunk && !headers['content-length']) {
      Response.header(res, 'Content-Length', Buffer.byteLength(chunk))
    }

    return chunk
  }

  /**
   * Prepares response for JSONP.
   *
   * ```js
   * const chunk = nodeRes.prepareJsonp(res, '<h2> Hello </h2>', 'callback')
   *
   * if (chunk) {
   *   nodeRes.etag(res, chunk)
   *
   *   if (nodeReq.fresh(req, res)) {
   *     chunk = null
   *     nodeRes.status(304)
   *   }
   *
   *   nodeRes.end(chunk)
   * }
   * ```
   */
  public static prepareJsonp (res: ServerResponse, body: any, callbackFn: string): string {
    Response.header(res, 'X-Content-Type-Options', 'nosniff')
    Response.safeHeader(res, 'Content-Type', 'text/javascript; charset=utf-8')

    const parsedBody = JSON
      .stringify(body)
      .replace(/\u2028/g, '\\u2028')
      .replace(/\u2029/g, '\\u2029')

    /**
     * setting up callbackFn on response body , typeof will make
     * sure not to throw error of client if callbackFn is not
     * a function
     */
    return `/**/ typeof ${callbackFn} === 'function' && ${callbackFn}(${parsedBody});`
  }

  /**
   * Returns the HTTP response with `Content-type`
   * set to `application/json`.
   *
   * ```js
   * nodeRes.json(req, res, { name: 'virk' })
   * nodeRes.json(req, res, [ 'virk', 'joe' ])
   * ```
   */
  public static json (req: IncomingMessage, res: ServerResponse, body: any, generateEtag: boolean = true): void {
    Response.safeHeader(res, 'Content-Type', 'application/json; charset=utf-8')
    Response.send(req, res, body, generateEtag)
  }

  /**
   * Make JSONP response with `Content-type` set to
   * `text/javascript`.
   *
   * ```js
   * nodeRes.jsonp(req, res, { name: 'virk' }, 'callback')
   * ```
   */
  public static jsonp (req: IncomingMessage, res: ServerResponse, body: any, callbackFn: string = 'callback', generateEtag: boolean = true): void {
    Response.send(req, res, Response.prepareJsonp(res, body, callbackFn), generateEtag)
  }

  /**
   * Set `Location` header on the HTTP response.
   */
  public static location (res: ServerResponse, url: string): void {
    Response.header(res, 'Location', url)
  }

  /**
   * Redirect the HTTP request to the given url.
   *
   * ```js
   * nodeRes.redirect(req, res, '/')
   * ```
   */
  public static redirect (req: IncomingMessage, res: ServerResponse, url: string, status: number = 302): void {
    const body = ''
    Response.status(res, status)
    Response.location(res, url)
    Response.send(req, res, body)
  }

  /**
   * Add vary header to the HTTP response.
   */
  public static vary (res: ServerResponse, field: string): void {
    vary(res, field)
  }

  /**
   * Set content type header by looking up the actual
   * type and setting charset to utf8.
   *
   * ### Note
   * When defining custom charset, you must set pass the complete
   * content type, otherwise `false` will be set as the
   * content-type header.
   *
   * ```js
   * nodeRes.type(res, 'html')
   *
   * nodeRes.type(res, 'json')
   *
   * nodeRes.type(res, 'text/html', 'ascii')
   * ```
   */
  public static type (res: ServerResponse, type: string, charset?: string): void {
    type = charset ? `${type}; charset=${charset}` : type
    Response.safeHeader(res, 'Content-Type', mime.contentType(type))
  }

  /**
   * Pipe stream to the response. Also this method will make sure
   * to destroy the stream, if request gets cancelled.
   *
   * The promise resolve when response finishes and rejects, when
   * stream raises errors.
   *
   * ```js
   * Response.stream(res, fs.createReadStream('foo.txt'))
   *
   * // handle stream errors
   * Response
   *   .stream(res, fs.createReadStream('foo.txt'))
   *   .catch((error) => {
   *   })
   * ```
   */
  public static stream (res: ServerResponse, body: Stream) {
    return new Promise((resolve, reject) => {
      if (typeof (body.pipe) !== 'function') {
        reject(new Error('Body is not a valid stream'))
        return
      }

      let finished = false

      // Error in stream
      body.on('error', (error) => {
        if (finished) {
          return
        }

        finished = true

        destroy(body)
        reject(error)
      })

      // Consumed stream
      body.on('end', resolve)

      // Written response
      onFinished(res, () => {
        finished = true
        destroy(body)
      })

      // Pipe to res
      body.pipe(res)
    })
  }
}

/**
 * Copying all the descriptive methods to the response object.
 */
Object.keys(methods).map((method) => {
  Response[method] = (req, res, body) => {
    Response.status(res, methods[method])
    Response.send(req, res, body)
  }
})
