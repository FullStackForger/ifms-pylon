'use strict'
var
	net = require('net'),
	shortId = require('shortid'),
	EventEmitter = require( "events" ).EventEmitter

const
	defaults = {
		host: '127.0.0.1',
		port: 9000
	},
	BUFF_SEP = '.EOB!',
	MESSAGE_TYPE = {},
	LOG_TYPE = {}

module.exports = Pylon

MESSAGE_TYPE.IDNT = "IDNT" // identification
MESSAGE_TYPE.INTR = "INTR" // introduction
MESSAGE_TYPE.MSSG = "MSSG" // message
MESSAGE_TYPE.REPL = "REPL" // reply
MESSAGE_TYPE.APAT = "APAT" // action registration

LOG_TYPE.STR = 'STR' // start
LOG_TYPE.CON = 'CON' // connection
LOG_TYPE.REC = 'REC' // message
LOG_TYPE.NOT = 'NOT' // notification
LOG_TYPE.BRD = 'BRD' // broadcast

function Pylon (opts) {

	EventEmitter.call(this)

	if (typeof(opts) == 'string') opts = { name : opts }
	if (opts === undefined) opts = {}
	this.opts = opts || {}
	opts.name = opts.name || 'pylon-' + shortId.generate().substr(0, 4)
	opts.debug = opts.debug || false

	this.$server = null
	this.$clients = [] // {obj} id, socket, name
	this.$actions = []
	this.$callbacks = []
	this.$broadcastQueue = []
}

Pylon.prototype = Object.create( EventEmitter.prototype )

const $serverFn = Pylon.prototype.$serverFn = {}
const $clientFn = Pylon.prototype.$clientFn = {}
const $helperFn = Pylon.prototype.$helperFn = {}
const $sockFn = Pylon.prototype.$sockFn = {}


// --------------------------------------------
// region: API methods
// --------------------------------------------

Pylon.prototype.create = function (opts) {
	let server  = net.createServer()
	let pylon = this
	let $server = this.$server = {}

	opts = opts || {}
	opts.name = opts.name || this.opts.name
	opts.port = opts.port || defaults.port
	opts.host = opts.host || defaults.host

	$server.opts = opts
	$server.name = opts.name
	$server.id = shortId.generate()
	$server.server = server
	$server.clients = []  // {obj} socket, id

	server.listen(opts.port, opts.host)
	server.on('connection', (sock) => { return $serverFn.onClientConnect.call(pylon, sock) })

	$serverFn.log.call(pylon, LOG_TYPE.STR + ' listening on ' + opts.host + ':' + opts.port)

	return this.connect(opts)
}

Pylon.prototype.connect = function (opts) {
	let pylon = this
	let client = {}

	// todo: use extension library
	opts = opts || {}
	client.opts = opts
	client.opts.port = opts.port || defaults.port
	client.opts.host = opts.host || defaults.host
	client.name = opts.name || this.opts.name
	client.patterns = []

	client.socket = net.Socket()
	client.socket.connect(opts, () => { return $clientFn.onConnect.call(pylon, client) })
	client.socket.on('data', (msg) => { return $clientFn.onData.call(pylon, client, msg) })
	client.socket.on('close', (msg) => { return $clientFn.onClose.call(pylon, client, msg) })

	this.$clients.push(client)
	return pylon
}

Pylon.prototype.notify = function (pattern, data, replyCb) {
	let msgObj = {
		meta : {
			id: shortId.generate(),
			patt: pattern,
			type: MESSAGE_TYPE.MSSG
		},
		body : data
	}

	if (replyCb != undefined) {
		this.$callbacks.push({
			msgId: msgObj.meta.id,
			pattern: msgObj.meta.patt,
			callback: replyCb
		})
	}

	this.$notify.call(this, msgObj)
}

Pylon.prototype.$notify = function (msgObj) {

	if (!this.isReady() || this.$broadcastQueue.length > 0) {
		if (msgObj.meta.type === MESSAGE_TYPE.APAT) {
			this.$broadcastQueue.unshift(msgObj)
		} else {
			this.$broadcastQueue.push(msgObj)
		}

		if (!this.isReady()) return
		msgObj = this.$broadcastQueue.shift()
	}

	if (this.$server != null) $serverFn.broadcast.call(this, msgObj, this.$server.clients)
	$clientFn.notify.call(this, msgObj)

	process.nextTick(() => {
		if (this.$broadcastQueue.length > 0) {
			let msgObj = this.$broadcastQueue.shift()
			this.$notify(msgObj)
		}
	})
	return this
}

Pylon.prototype.register = function (pattern, action /*(data, respond)*/) {
	this.$actions.push({
		pattern: pattern,
		action: action
	})

	if (this.isReady() && (this.$server != null
		&& this.$server.clients.length > 0 || this.$clients.length > 0)) {

		this.$notify({
			meta : {
				id: shortId.generate(),
				type: MESSAGE_TYPE.APAT
			},
			body : {
				pattern: pattern
			}
		})
	}

	return this
}

Pylon.prototype.terminate = function () {
	this.$clients.forEach((client) => {
		client.socket.destroy()
	})
	this.$server.clients.forEach((client) => {
		client.socket.destroy()
	})
	this.$server.server.close()
}
// todo: move to helpers
Pylon.prototype.parse = function (message) {
	return JSON.parse(message)
}

// todo: move to helpers
Pylon.prototype.$ready = true
Pylon.prototype.isReady = function () {
	let ready = true

	this.$clients.forEach((client) => {
		if (!client.active) ready = false
	})

	if (this.$server != null) {
		this.$server.clients.forEach((client) => {
			if (!client.active) ready = false
		})
	}

	return ready
}

// --------------------------------------------
// internal helpers methods
// --------------------------------------------

Pylon.prototype.$helperFn.updatePattern = function (client, pattern) {
	let patterns = (pattern instanceof Array)  ? pattern : [pattern]

	patterns.forEach((pattern) => {
		if (client.patterns.indexOf(pattern) == -1) {
			client.patterns.push(pattern)
		}
	})
}

// --------------------------------------------
// internal server methods
// --------------------------------------------


Pylon.prototype.$serverFn.log = function (info) {
	if (!this.opts.debug) return
	console.log((new Date()).toISOString() + '   ' + this.$server.name + ' (server:' + this.$server.id + ')\t ' + info)
}

Pylon.prototype.$serverFn.onClientConnect = function (sock) {

	let $server = this.$server
	let client = {
		socket: sock,
		id: shortId.generate(),
		patterns: []
	}

	$serverFn.log.call(this, LOG_TYPE.CON + ' client connected'
		+ ' on ' + sock.localAddress + ':' + sock.localPort
		+ ' from ' + sock.remoteAddress + ':' + sock.remotePort
		+ ' as { id: ' + client.id + ' }')

	client.socket.on('data', (msg) => { return $serverFn.onData.call(this, client, msg) })
	client.socket.on('close', (msg) => { return $serverFn.onClose.call(this, client, msg) })

	$server.clients.push(client)

	let msgObj = {
		meta: {
			type: MESSAGE_TYPE.IDNT
		},
		body: {
			id: client.id,
				srvId: $server.id
		}
	}

	$serverFn.log.call(this, LOG_TYPE.BRD + ' ' + JSON.stringify(msgObj) + ' B> ' + client.id)
	$sockFn.write.call(this, client.socket, msgObj)
}

Pylon.prototype.$serverFn.onData = function (client, message) {
	let pylon = this
	let messages = message.toString().split(BUFF_SEP);
	messages.pop()
	messages.forEach(function(message) {
		process.nextTick(function() {
			$serverFn.processMessage.call(pylon, client, message)
		});
	})
}

Pylon.prototype.$serverFn.processMessage = function (client, message) {
	$serverFn.log.call(this, LOG_TYPE.REC + ' ' + message)

	let msgObj = this.parse(message)
	switch(msgObj.meta.type) {
		case MESSAGE_TYPE.INTR:
			client.name = msgObj.body.name
			$clientFn.activate.call(this, client)

			if (this.$actions.length > 0) {
				$serverFn.broadcast.call(this, {
					meta : {
						id: shortId.generate(),
						type: MESSAGE_TYPE.APAT
					},
					body : {
						pattern: this.$actions.map((action) => { return action.pattern })
					}
				}, client)
			}
			break

		case MESSAGE_TYPE.APAT:
			$helperFn.updatePattern.call(this, client, msgObj.body.pattern)
			break

		case MESSAGE_TYPE.MSSG:
			this.$notify.call(this, msgObj)
			break

		case MESSAGE_TYPE.REPL:
			this.$notify.call(this, msgObj)
			break
	}
}

Pylon.prototype.$serverFn.onClose = function (client, data) {
	$serverFn.log('client (' + client.id + ') disconnected: '
		+ client.socket.remoteAddress + ':' + client.socket.remotePort)

	this.$server.clients = this.$server.clients.filter((fClient) => {
		return fClient.socket.id != client.socket.id
	})
}

Pylon.prototype.$serverFn.broadcast = function (msgObj, clients) {
	let srvId = this.$server.id

	msgObj.meta.type = msgObj.meta.type || MESSAGE_TYPE.MSSG
	msgObj.meta.srvId = srvId

	let targetClients = (clients instanceof Array) ? clients : [clients]
	targetClients.forEach((client) => {
		$serverFn.log.call(this, LOG_TYPE.BRD + ' ' + JSON.stringify(msgObj) + ' B> ' + client.id)
		$sockFn.write.call(this, client.socket, msgObj)
	})
}

// --------------------------------------------
// internal clients methods
// --------------------------------------------

Pylon.prototype.$clientFn.log = function (client, info) {
	if (!this.opts.debug) return
	console.log((new Date()).toISOString() + '   ' + client.name + ' (client:' + client.id + ')\t ' + info)
}

Pylon.prototype.$clientFn.activate = function (client) {
	client.active = true
	if (this.isReady() && this.$broadcastQueue.length > 0) {
		let msgObj = this.$broadcastQueue.shift()
		this.$notify(msgObj)
	}
}

Pylon.prototype.$clientFn.onConnect = function (client) {
	$clientFn.log.call(this, client, LOG_TYPE.CON + ' connecting to: ' + client.opts.host + ':' + client.opts.port)
}

Pylon.prototype.$clientFn.onData = function (client, message) {
	let pylon = this
	let messages = message.toString().split(BUFF_SEP);
	messages.pop()
	messages.forEach(function(message) {
		process.nextTick(function() {
			$clientFn.processMessage.call(pylon, client, message)
		})
	})
}

Pylon.prototype.$clientFn.processMessage = function (client, message) {
	let msgObj = this.parse(message)
	let pylon = this

	$clientFn.log.call(this, client, LOG_TYPE.REC + ' ' + message)
	switch(msgObj.meta.type) {

		case MESSAGE_TYPE.IDNT:
			client.id = msgObj.body.id
			client.srvId = msgObj.body.srvId
			this.$clientFn.activate.call(this, client)
			$sockFn.write.call(this, client.socket, {
				meta: {
					type: MESSAGE_TYPE.INTR
				},
				body: {
					name: client.name,
					clientId: client.id
				}
			})
			break

		case MESSAGE_TYPE.APAT:
			$helperFn.updatePattern.call(this, client, msgObj.body.pattern)
			break

		case MESSAGE_TYPE.MSSG:
			this.$actions.forEach((actionObj) => {
				// todo: allow regexes
				if (msgObj.meta.patt !== actionObj.pattern) return

				actionObj.action.call(this, msgObj.body, function respond (data) {
					msgObj.meta.type = MESSAGE_TYPE.REPL
					msgObj.meta.clientId = client.id
					msgObj.body  = data
					delete msgObj.meta.srvId

					$clientFn.log.call(pylon, client, LOG_TYPE.NOT + ' ' + JSON.stringify(msgObj) + ' N> ' + client.srvId)
					$sockFn.write.call(pylon, client.socket, msgObj)
				})
			})
			break;

		case MESSAGE_TYPE.REPL:

			let count = this.$callbacks.length
			let allCbs = this.$callbacks
			let checkedCbs = []
			let msgId = msgObj.meta.msgId
			let msgPatt = msgObj.meta.patt
			let founded = false

			while(count > 0 && !founded) {
				let cbObj = allCbs.pop()

				if (cbObj.msgId == msgId && cbObj.pattern == msgPatt) {
					founded = true
					cbObj.callback(msgObj.body)
					this.$callbacks = Array.prototype.push.apply(allCbs, checkedCbs);
					return
				}
				checkedCbs.push(cbObj)
				count --
			}


			return
			this.$callbacks = this.$callbacks.filterX((cbObj) => {
				// todo: allow regexes
				if (cbObj.msgId == msgObj.meta.id && cbObj.pattern == msgObj.meta.patt) {
					cbObj.callback(msgObj.body)
					return false
				}

				return true
			})
			break;
	}
}

Array.prototype.filterX = function(expression) {
	var res = [];
	for(var idx=0; idx<this.length; idx++)
	{
		var currentItem = this[idx];
		if(expression(currentItem))
		{
			res.push(currentItem);
		}
	}
	return res;
};


Pylon.prototype.$clientFn.onClose = (client) => {
	$clientFn.log.call(this, client, 'connection closed')
}

Pylon.prototype.$clientFn.notify = function (msgObj) {
	let srvId = this.$server ? this.$server.id : null

	msgObj.meta.type = msgObj.meta.type || MESSAGE_TYPE.MSSG
	this.$clients.forEach((client) => {
		if (srvId != null && (client.id == srvId || msgObj.meta.srvId == srvId)) return
		if (msgObj.meta.patt && client.patterns.indexOf(msgObj.meta.patt) == -1) {
			return;
		}
		msgObj.meta.clientId = client.id
		$clientFn.log.call(this, client, LOG_TYPE.NOT + ' ' + JSON.stringify(msgObj) + ' N> ' + client.srvId)
		$sockFn.write.call(this, client.socket, msgObj)
	})
}


// --------------------------------------------
// internal socket methods
// --------------------------------------------
var msgLimit = 0, msgCount = 0;
Pylon.prototype.$sockFn.write = function (sock, msgObj) {
	if (msgLimit > 0 && msgLimit < msgCount) throw new Error('bandwith reached')
	msgCount++
	this.emit('pulse')
	sock.write(JSON.stringify(msgObj) + BUFF_SEP)

}
