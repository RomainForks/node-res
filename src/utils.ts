/**
 * node-res
 *
 * (c) Harminder Virk <virk@adonisjs.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

export const returnContentAndType = (body) => {
  /**
   * Return the body and it's type when
   * body is a string.
   */
  if (typeof (body) === 'string') {
    return {
      body,
      type: /^\s*</.test(body) ? 'text/html' : 'text/plain',
    }
  }

  /**
   * If body is a buffer, return the exact copy
   * and type as bin.
   */
  if (Buffer.isBuffer(body)) {
    return { body, type: 'application/octet-stream' }
  }

  /**
   * If body is a number or boolean. Convert it to
   * a string and return the type as text.
   */
  if (typeof (body) === 'number' || typeof (body) === 'boolean') {
    return { body: String(body), type: 'text/plain' }
  }

  /**
   * Otherwise check whether body is an object or not. If yes
   * stringify it and otherwise return the exact copy.
   */
  return typeof (body) === 'object'
    ? { body: JSON.stringify(body), type: 'application/json' }
    : { body }
}
