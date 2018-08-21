'use strict'

/*
 * node-res
 *
 * (c) Harminder Virk <virk@adonisjs.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
*/

const test = require('japa')
const supertest = require('supertest')
const http = require('http')
const path = require('path')
const fs = require('fs')
const Response = require('..')

const methods = require('../methods')

test.group('Response', function (assert) {
  test('should set dynamic method on response object which auto set statuses', async function (assert) {
    const server = http.createServer(function (req, res) {
      Response.tooManyRequests(req, res, 'Please wait')
    })
    const response = await supertest(server).get('/').expect(429)
    assert.equal(response.text, 'Please wait')
  })

  test('should have all descriptive methods on response status, point to right status', function (assert) {
    const methodNames = Object.keys(methods)
    methodNames.forEach(function (method) {
      assert.isFunction(Response[method])
    })
  })

  test('should set response header', async function (assert) {
    const server = http.createServer(function (req, res) {
      Response.header(res, 'content-type', 'application/json')
      res.end()
    })
    await supertest(server).get('/').expect(200).expect('Content-Type', /json/)
  })

  test('should not set response header when already there by using safeHeader method', async function (assert) {
    const server = http.createServer(function (req, res) {
      Response.header(res, 'content-type', 'application/json')
      Response.safeHeader(res, 'content-type', 'text/html')
      res.end()
    })
    await supertest(server).get('/').expect(200).expect('Content-Type', /json/)
  })

  test('should set an array of headers for a given field', async function (assert) {
    const server = http.createServer(function (req, res) {
      Response.header(res, 'Foo', ['bar', 'baz'])
      res.end()
    })
    const res = await supertest(server).get('/').expect(200)
    assert.equal(res.headers.foo, 'bar, baz')
  })

  test('should set response status', async function (assert) {
    const server = http.createServer(function (req, res) {
      Response.status(res, 400)
      res.end()
    })
    await supertest(server).get('/').expect(400)
  })

  test('should send text back to client with proper headers', async function (assert) {
    const server = http.createServer(function (req, res) {
      Response.send(req, res, 'hello world')
    })
    const res = await supertest(server).get('/').expect(200)
    assert.equal(res.text, 'hello world')
    assert.equal(res.headers['content-type'], 'text/plain; charset=utf-8')
  })

  test('should send number back to client with proper headers', async function (assert) {
    const server = http.createServer(function (req, res) {
      Response.send(req, res, 1)
    })
    const res = await supertest(server).get('/').expect(200)
    assert.equal(res.text, '1')
    assert.equal(res.headers['content-type'], 'text/plain; charset=utf-8')
  })

  test('should send json back to client with proper headers', async function (assert) {
    const body = {
      name: 'foo',
      age: 22,
      nested: ['foo', 'bar']
    }
    const server = http.createServer(function (req, res) {
      Response.send(req, res, body)
    })
    const res = await supertest(server).get('/').expect(200)
    assert.deepEqual(res.body, body)
    assert.equal(res.headers['content-type'], 'application/json; charset=utf-8')
  })

  test('should send empty response', async function (assert) {
    const body = ''
    const server = http.createServer(function (req, res) {
      Response.send(req, res, body)
    })
    const res = await supertest(server).get('/').expect(200)
    assert.equal(res.text, '')
    assert.equal(res.headers['content-type'], 'text/plain; charset=utf-8')
  })

  test('should send empty response when request body is null', async function (assert) {
    const body = null
    const server = http.createServer(function (req, res) {
      Response.send(req, res, body)
    })
    const res = await supertest(server).get('/').expect(204)
    assert.equal(res.text, '')
  })

  test('should send empty response when request body is undefined', async function (assert) {
    const server = http.createServer(function (req, res) {
      Response.send(req, res)
    })
    const res = await supertest(server).get('/').expect(204)
    assert.equal(res.text, '')
  })

  test('should send boolean as response', async function (assert) {
    const body = true
    const server = http.createServer(function (req, res) {
      Response.send(req, res, body)
    })
    const res = await supertest(server).get('/').expect(200)
    assert.equal(res.text, 'true')
    assert.equal(res.headers['content-type'], 'text/plain; charset=utf-8')
  })

  test('should send buffer as response', async function (assert) {
    const body = Buffer.from('hello world', 'utf8')
    const server = http.createServer(function (req, res) {
      Response.send(req, res, body)
    })
    const res = await supertest(server).get('/').expect(200)
    assert.equal(res.body.toString(), 'hello world')
    assert.equal(res.headers['content-type'], 'application/octet-stream; charset=utf-8')
  })

  test('should send empty body for HEAD request', async function (assert) {
    const body = Buffer.from('hello world', 'utf8')
    const server = http.createServer(function (req, res) {
      Response.send(req, res, body)
    })
    const res = await supertest(server).head('/').expect(200)
    assert.equal(res.headers['content-type'], 'application/octet-stream; charset=utf-8')
    assert.deepEqual(res.body, {})
  })

  test('should not override existing status by calling send method', async function (assert) {
    const body = true
    const server = http.createServer(function (req, res) {
      Response.status(res, 204)
      Response.send(req, res, body)
    })
    await supertest(server).get('/').expect(204)
  })

  test('should send valid json response using json as shorthand method', async function (assert) {
    const body = {
      foo: 'bar',
      baz: ['foo', 'bar']
    }
    const server = http.createServer(function (req, res) {
      Response.json(req, res, body)
    })
    const res = await supertest(server).get('/').expect(200)
    assert.deepEqual(res.body, body)
  })

  test('should send jsonp response back to client with default callback', async function (assert) {
    const body = {
      name: 'foo',
      age: 22,
      nested: ['foo', 'bar']
    }
    const response = "/**/ typeof callback === 'function' && callback(" + JSON.stringify(body) + ');'
    const server = http.createServer(function (req, res) {
      Response.jsonp(req, res, body)
    })
    const res = await supertest(server).get('/').expect(200)
    assert.equal(res.text, response)
    assert.equal(res.headers['content-type'], 'text/javascript; charset=utf-8')
    assert.equal(res.headers['x-content-type-options'], 'nosniff')
  })

  test('should send jsonp response back to client with defined callback', async function (assert) {
    const body = {
      name: 'foo',
      age: 22,
      nested: ['foo', 'bar']
    }
    const response = "/**/ typeof foo === 'function' && foo(" + JSON.stringify(body) + ');'
    const server = http.createServer(function (req, res) {
      Response.jsonp(req, res, body, 'foo')
    })
    const res = await supertest(server).get('/').expect(200)
    assert.equal(res.text, response)
    assert.equal(res.headers['content-type'], 'text/javascript; charset=utf-8')
    assert.equal(res.headers['x-content-type-options'], 'nosniff')
  })

  test('should remove irrelevant headers when response status is 204 or 304', async function (assert) {
    const body = 'hello world'
    const server = http.createServer(function (req, res) {
      Response.status(res, 204)
      Response.send(req, res, body)
    })
    const res = await supertest(server).get('/').expect(204)
    assert.equal(res.headers['content-type'], undefined)
    assert.equal(res.headers['content-length'], undefined)
  })

  test('should set location header on response', async function (assert) {
    const server = http.createServer(function (req, res) {
      Response.location(res, 'http://localhost')
      Response.send(req, res, '')
    })
    const res = await supertest(server).get('/').expect(200)
    assert.equal(res.headers['location'], 'http://localhost')
  })

  test('should redirect to a given url', async function (assert) {
    const server = http.createServer(function (req, res) {
      Response.redirect(req, res, 'http://localhost', 301)
    })
    const res = await supertest(server).get('/').expect(301)
    assert.equal(res.headers['location'], 'http://localhost')
    assert.equal(res.headers['content-length'], '0')
  })

  test('should redirect with 302 when status is not defined', async function (assert) {
    const server = http.createServer(function (req, res) {
      Response.redirect(req, res, 'http://localhost')
    })
    const res = await supertest(server).get('/').expect(302)
    assert.equal(res.headers['location'], 'http://localhost')
    assert.equal(res.headers['content-length'], '0')
  })

  test('should add vary header', async function (assert) {
    const server = http.createServer(function (req, res) {
      Response.vary(res, 'Origin')
      Response.send(req, res, '')
    })
    const res = await supertest(server).get('/').expect(200)
    assert.equal(res.headers['vary'], 'Origin')
  })

  test('should be able to set content type using the type method', async function (assert) {
    const server = http.createServer(function (req, res) {
      Response.type(res, 'json')
      Response.send(req, res, '')
    })
    const res = await supertest(server).get('/').expect(200)
    assert.equal(res.headers['content-type'], 'application/json; charset=utf-8')
  })

  test('should be able to override the charset using the type method', async function (assert) {
    const server = http.createServer(function (req, res) {
      Response.type(res, 'application/json', 'myjson')
      Response.send(req, res, '')
    })
    const res = await supertest(server).get('/').expect(200)
    assert.equal(res.headers['content-type'], 'application/json; charset=myjson')
  })

  test('should append to existing headers', async function (assert) {
    const server = http.createServer(function (req, res) {
      res.setHeader('Foo', 'bar')
      Response.append(res, 'Foo', 'baz')
      Response.append(res, 'Foo', 'foo')
      res.end()
    })
    const res = await supertest(server).get('/').expect(200)
    assert.equal(res.headers.foo, 'bar, baz, foo')
  })

  test('should append to existing headers with mixed headers type', async function (assert) {
    const server = http.createServer(function (req, res) {
      Response.append(res, 'Foo', ['bar'])
      Response.append(res, 'Foo', 'baz')
      Response.append(res, 'Foo', ['foo'])
      res.end()
    })
    const res = await supertest(server).get('/').expect(200)
    assert.equal(res.headers.foo, 'bar, baz, foo')
  })

  test('set content type as html when body is an HTML string', async function (assert) {
    const server = http.createServer(function (req, res) {
      Response.send(req, res, '<h1> hello </h1>')
      res.end()
    })
    await supertest(server).get('/').expect('content-type', 'text/html; charset=utf-8').expect(200)
  })

  test('send stream', async function (assert) {
    const server = http.createServer(function (req, res) {
      Response.stream(res, fs.createReadStream(path.join(__dirname, './files', 'hello.txt')))
    })

    const { text } = await supertest(server).get('/').expect(200)
    assert.equal(text.trim(), 'hello world')
  })

  test('set content type when defined explicitly', async function (assert) {
    const server = http.createServer(function (req, res) {
      Response.type(res, 'html')
      Response.stream(res, fs.createReadStream(path.join(__dirname, './files', 'hello.txt')))
    })

    await supertest(server).get('/').expect('content-type', 'text/html; charset=utf-8').expect(200)
  })

  test('should not hit the maxListeners when making more than 10 calls', async function (assert) {
    const server = http.createServer(function (req, res) {
      Response.stream(res, fs.createReadStream(path.join(__dirname, './files', 'hello.txt')))
    })
    const requests = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13].map(() => supertest(server).get('/').expect(200))
    await Promise.all(requests)
  })

  test('raise error when stream raises one', async function (assert) {
    const server = http.createServer(function (req, res) {
      Response
        .stream(res, fs.createReadStream(path.join(__dirname, './files', 'foo.txt')))
        .catch((error) => {
          Response.send(req, res, error.code)
        })
    })

    const { text } = await supertest(server).get('/')
    assert.equal(text, 'ENOENT')
  })

  test('send stream', async function (assert) {
    const server = http.createServer(function (req, res) {
      Response.send(req, res, fs.createReadStream(path.join(__dirname, './files', 'hello.txt')))
    })

    const { text } = await supertest(server).get('/').expect(200)
    assert.equal(text.trim(), 'hello world')
  })

  test('send stream errors as response', async function (assert) {
    const server = http.createServer(function (req, res) {
      Response.send(req, res, fs.createReadStream(path.join(__dirname, './files', 'foo.txt')))
    })

    await supertest(server).get('/').expect(404)
  })
})
