// Architecture
//
//   [ p-nexus ]================================================================
//                   |                |                     |                 |
//               [p-nexus]       [ p-gate ]           [ p-api-1 ]        [ p-api-2 ]

'use strict'
var Pylon = new require('..')

var pNexus = new Pylon('p-nexus')
	.create()

var pGate = new Pylon('p-gate')
	.connect()
	.register('some/data/request', function (data, respond) {
		var responses = []

		console.log((new Date()).toISOString() + ' GATE: some/data/request, responses: ', responses)

		//respond({a: 123})
		//return

		this.notify('api/a', {}, update)
		this.notify('api/b', {}, update)

		function update(msg) {
			responses.push(msg.data)
			console.log((new Date()).toISOString() + ' GATE: update, responses: ', responses)
			if (responses.length == 2) {
				console.log('GATE: responding', responses)
				respond({ responses: responses })
			}
		}
	})

var pApi1 = new Pylon('p-api-1')
	.connect()
	.register('api/a', (data, respond) => {
			console.log((new Date()).toISOString() + ' API-1: api/a, data: ', data)
			respond({ data: 'aaaAAAaaa'})
	})

var pApi2 = new Pylon('p-api-2')
	.connect()
	.register('api/b', (data, respond) => {
		console.log((new Date()).toISOString() + ' API-2: api/b, data: ', data)
		respond({ data: 'bbbBBBbbb' })
	})

// nexus requests some data
pApi1.notify('some/data/request', { api: 'a&b' }, (data) => {
	console.log((new Date()).toISOString() + ' data received: ' + JSON.stringify(data))
})

// that request can be made from any of the service in the matrix
// uncomment below lines to test it
/*
pApi1.notify('some/data/request', { api: 'a&b' }, (data) => {
	console.log((new Date()).toISOString() + ' data received: ' + JSON.stringify(data))
})

pApi2.notify('some/data/request', { api: 'a&b' }, (data) => {
	console.log((new Date()).toISOString() + ' data received: ' + JSON.stringify(data))
})
*/
