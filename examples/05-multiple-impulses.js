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

		console.log((new Date()).toISOString() + ' GATE: some/data/request, asking for partials')
		this.notify('api/a', {}, update)
		this.notify('api/b', {}, update)

		function update(msg) {
			responses.push(msg.data)
			console.log((new Date()).toISOString() + ' GATE: responses updated: ', responses)
			if (responses.length == 2) {
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


pNexus.notify('some/data/request', { api: 'a&b1' }, (data) => {
	console.log((new Date()).toISOString() + ' NEXUS: data received: ' + JSON.stringify(data))
})

pApi1.notify('some/data/request', { api: 'a&b2' }, (data) => {
	console.log((new Date()).toISOString() + ' API_1: data received: ' + JSON.stringify(data))
})

pApi2.notify('some/data/request', { api: 'a&b3' }, (data) => {
	console.log((new Date()).toISOString() + ' API_2: data received: ' + JSON.stringify(data))
})
