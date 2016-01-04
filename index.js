'use strict'
const
	net = require('net'),
	shortId = require('shortid'),
	defaults = {
		host: '127.0.0.1',
		port: 9000
	},
	MESSAGE_TYPE = {}

module.exports = Pylon

MESSAGE_TYPE.IDENT = "ident"
MESSAGE_TYPE.INTRO = "intro"
MESSAGE_TYPE.MESSAGE = "message"

function Pylon () {
	this.$server = null
	this.$clients = [] // {obj} id, socket, name
	this.$patterns = []
}

const $serverFn = Pylon.prototype.$serverFn = {}
const $clientFn = Pylon.prototype.$clientFn = {}
const $sockFn = Pylon.prototype.$sockFn = {}

// --------------------------------------------
// region: API methods
// --------------------------------------------

Pylon.prototype.create = function (opts) {
	let server  = net.createServer()
	let pylon = this
	let $server = this.$server = {}

	opts = opts || {}
	opts.name = opts.name || 'anonymous'
	opts.port = opts.port || defaults.port
	opts.host = opts.host || defaults.host

	$server.opts = opts
	$server.name = opts.name
	$server.id = shortId.generate()
	$server.server = server
	$server.clients = []  // {obj} socket, id

	server.listen(opts.port, opts.host)
	server.on('connection', (sock) => { return $serverFn.onClientConnect.call(pylon, sock) })

	$serverFn.log.call(pylon, 'listening on ' + opts.host + ':' + opts.port)

	return this.connect(opts)
}

Pylon.prototype.connect = function (opts) {
	let pylon = this
	let client = {}

	client.opts = opts || {}
	client.opts.port = opts.port || defaults.port
	client.opts.host = opts.host || defaults.host

	client.name =  opts.name || opts.host + ':' + opts.port

	client.socket = net.Socket()
	client.socket.connect(opts, () => { return $clientFn.onConnect.call(pylon, client) })
	client.socket.on('data', (data) => { return $clientFn.onData(client, data) })
	client.socket.on('close', (data) => { return $clientFn.onClose(client, data) })

	this.$clients.push(client)
	return pylon
}

Pylon.prototype.broadcast = function (pattern, data) {
	let msgId = shortId.generate()
	if (this.$server != null) $serverFn.notify.call(this, msgId, pattern, data)
	///if (this.$clients.length > 0) $clientFn.broadcast.call(this, pattern, data)
	return this
}

Pylon.prototype.register = function (msg, action) {
	this.$patterns[msg] = action
	return this
}

// --------------------------------------------
// internal server methods
// --------------------------------------------


Pylon.prototype.$serverFn.log = function (info) {
	console.log('[SERVER:' + this.$server.id + ':' + this.$server.name + '] ' + info)
}

Pylon.prototype.$serverFn.onClientConnect = function (sock) {

	let $server = this.$server
	let client = {
		socket: sock,
		id: shortId.generate()
	}

	$serverFn.log.call(this, 'client (' + client.id + ') connected'
		+ ' to: ' + sock.localAddress + ':' + sock.localPort
		+ ' from: ' + sock.remoteAddress + ':' + sock.remotePort)

	client.socket.on('data', (data) => { return $serverFn.onData.call(this, client, data) })
	client.socket.on('close', (data) => { return $serverFn.onClose.call(this, client, data) })

	$server.clients.push(client)

	$sockFn.write(client.socket, {
		type: MESSAGE_TYPE.IDENT,
		id: client.id
	})
}

Pylon.prototype.$serverFn.onData = function (client, message) {
	var msgObj = $sockFn.parse(message)

	$serverFn.log.call(this, 'received: ' + message)

	switch(msgObj.type) {
		case MESSAGE_TYPE.INTRO:
			client.name = msgObj.name
			client.active = true
			break;

		case MESSAGE_TYPE.MESSG:
			if (this.$clients.length > 0) $clientFn.broadcast.call(this, msgObj)
			break;
	}
}

Pylon.prototype.$serverFn.onClose = function (client, data) {
	$serverFn.log('client (' + client.id + ') disconnected: '
		+ client.socket.remoteAddress + ':' + client.socket.remotePort)

	this.$server.clients = this.$server.clients.filter((fClient) => {
		return fClient.socket.id != client.socket.id
	})
}

Pylon.prototype.$serverFn.notify = function (id, pattern, data) {
	this.$server.clients.map((client) => {
		$sockFn.write(client.socket, {
			type: MESSAGE_TYPE.MESSAGE,
			id: id,
			patt: pattern,
			data: data
		})
	})
}

// --------------------------------------------
// internal clients methods
// --------------------------------------------

Pylon.prototype.$clientFn.log = function (client, info) {
	console.log('[CLIENT:' + client.id + ':' + client.name + '] ' + info)
}

Pylon.prototype.$clientFn.onConnect = (client) => {
	$clientFn.log(client, 'connected to: ' + client.opts.host + ':' + client.opts.port)
	//client.socket.write(JSON.stringify({msg: 'I am Chuck Norris!', client: this.name}))
}

Pylon.prototype.$clientFn.onData = (client, message) => {
	let data = $sockFn.parse(message)

	if(data.type === MESSAGE_TYPE.IDENT) client.id = data.id
	$clientFn.log(client, 'received: ' + message)

	switch(data.type) {

		case MESSAGE_TYPE.IDENT:
			$sockFn.write(client.socket, {
				type: MESSAGE_TYPE.INTRO,
				name: client.name,
				id: client.id
			})
			break;

		case MESSAGE_TYPE.MESSG:
			break;
	}
	// client.destroy();
}

Pylon.prototype.$clientFn.onClose = (client) => {
	$clientFn.log(client, 'connection closed')
}

Pylon.prototype.$clientFn.broadcast = function (pattern, data) {
	this.$clients.map((client) => {
		$sockFn.write(client.socket, {
			type: MESSAGE_TYPE.MESSG,
			id: shortId.generate(),
			patt: pattern,
			data: data
		})
	})
}

// --------------------------------------------
// internal socket methods
// --------------------------------------------

Pylon.prototype.$sockFn.write = function (sock, data) {
	sock.write(JSON.stringify(data))
}

Pylon.prototype.$sockFn.parse = function (message) {
	return JSON.parse(message)
}