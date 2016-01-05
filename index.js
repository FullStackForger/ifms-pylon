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
MESSAGE_TYPE.MESSG = "message"
MESSAGE_TYPE.REPLY = "reply"

function Pylon () {
	this.$server = null
	this.$clients = [] // {obj} id, socket, name
	this.$actions = []
	this.$callbacks = []
	this.$broadcastQueue = []
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
	client.socket.on('data', (data) => { return $clientFn.onData.call(pylon, client, data) })
	client.socket.on('close', (data) => { return $clientFn.onClose.call(pylon, client, data) })

	this.$clients.push(client)
	return pylon
}

Pylon.prototype.notify = function (pattern, data, replyCb) {
	let msgObj = {
		msgId: shortId.generate(),
		pattern: pattern,
		data: data,
		replyCb: replyCb
	}

	this.$notify.call(this, msgObj)
}

Pylon.prototype.$notify = function (msgObj) {

	if (!this.isReady()) {
		this.$broadcastQueue.push(msgObj)
		return
	}

	if (this.$broadcastQueue.length > 0) {
		this.$broadcastQueue.push(msgObj)
		msgObj = this.$broadcastQueue.shift()
	}

	if (msgObj.replyCb != undefined) {
		this.$callbacks.push({
			msgId: msgObj.msgId,
			pattern: msgObj.pattern,
			replyCb: msgObj.replyCb
		})
	}

	if (this.$server != null) $serverFn.broadcast.call(this, msgObj)
	$clientFn.notify.call(this, msgObj)
	return this
}

Pylon.prototype.register = function (pattern, action /*(data, respond)*/) {
	this.$actions.push({
		pattern: pattern,
		action: action
	})
	return this
}

// todo: move to helpers
Pylon.prototype.parse = function (message) {
	return JSON.parse(message)
}

// todo: move to helpers
Pylon.prototype.isReady = function () {
	let ready = true
	this.$clients.forEach((client) => {
		if (!client.active) ready = false
	})
	this.$server.clients.forEach((client) => {
		if (!client.active) ready = false
	})
	return ready
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
	var msgObj = this.parse(message)

	$serverFn.log.call(this, 'received: ' + message)

	switch(msgObj.type) {
		case MESSAGE_TYPE.INTRO:
			client.name = msgObj.name
			this.$clientFn.activate.call(this, client);
			break;

		case MESSAGE_TYPE.MESSG:
			throw new Error('not implemented yet')
			break;

		case MESSAGE_TYPE.REPLY:
			this.$notify(msgObj)
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

Pylon.prototype.$serverFn.broadcast = function (msgObj) {
	let srvId = this.$server.id
	this.$server.clients.map((client) => {
		$sockFn.write(client.socket, {
			type: msgObj.type === MESSAGE_TYPE.REPLY ? msgObj.type : MESSAGE_TYPE.MESSG,
			msgId: msgObj.msgId,
			srvId: srvId,
			pattern: msgObj.pattern,
			data: msgObj.data
		})
	})
}

// --------------------------------------------
// internal clients methods
// --------------------------------------------

Pylon.prototype.$clientFn.log = function (client, info) {
	console.log('[CLIENT:' + client.id + ':' + client.name + '] ' + info)
}

Pylon.prototype.$clientFn.activate = function (client) {
	client.active = true
	if (this.isReady() && this.$broadcastQueue.length > 0) {
		let msgObj = this.$broadcastQueue.shift()
		this.$notify(msgObj)
	}
}

Pylon.prototype.$clientFn.onConnect = function (client) {
	$clientFn.log(client, 'connected to: ' + client.opts.host + ':' + client.opts.port)
	//client.socket.write(JSON.stringify({msg: 'I am Chuck Norris!', client: this.name}))
}

Pylon.prototype.$clientFn.onData = function (client, message) {
	let msgObj = this.parse(message)

	if(msgObj.type === MESSAGE_TYPE.IDENT) client.id = msgObj.id
	$clientFn.log(client, 'received: ' + message)

	switch(msgObj.type) {

		case MESSAGE_TYPE.IDENT:
			$sockFn.write(client.socket, {
				type: MESSAGE_TYPE.INTRO,
				name: client.name,
				id: client.id
			})

			this.$clientFn.activate.call(this, client)
			break;

		case MESSAGE_TYPE.MESSG:
			this.$actions.forEach((actionObj) => {
				// todo: allow regexes
				if (msgObj.pattern === actionObj.pattern) {
					actionObj.action(msgObj.data, function respond (data) {
						$sockFn.write(client.socket, {
							type: MESSAGE_TYPE.REPLY,
							msgId: msgObj.msgId,
							clientId: client.id,
							pattern: msgObj.pattern,
							data: data
						})
					})
				}
			})
			break;

		case MESSAGE_TYPE.REPLY:
			this.$callbacks = this.$callbacks.map((cbObj) => {
				// todo: allow regexes
				if (cbObj.pattern != msgObj.pattern || cbObj.msgId != msgObj.msgId) {
					return true
				}

				cbObj.replyCb(msgObj.data)
				return false
			})
			break;
	}
	// client.destroy();
}

Pylon.prototype.$clientFn.onClose = (client) => {
	$clientFn.log(client, 'connection closed')
}

Pylon.prototype.$clientFn.notify = function (msgObj) {
	msgObj = {
		type: msgObj.type === MESSAGE_TYPE.REPLY ? msgObj.type : MESSAGE_TYPE.MESSG,
		msgId: msgObj.msgId,
		pattern: msgObj.pattern,
		data: msgObj.data
	}
	this.$clients.map((client, index) => {
		if (index == 0) return
		msgObj.clientId = client.id
		$sockFn.write(client.socket, msgObj)
	})
}

// --------------------------------------------
// internal socket methods
// --------------------------------------------

Pylon.prototype.$sockFn.write = function (sock, data) {
	sock.write(JSON.stringify(data))
}