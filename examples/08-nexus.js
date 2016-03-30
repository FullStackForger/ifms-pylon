// Architecture
//                            [ p-proxy ]
//                                 |
//   [ p-nexus ]=============================
//                   |                |
//              [p-nexus]             |
//                                    |
//                      [ p-gate ]============================
//
//                                            [ p-api-1 ]        [ p-api-2 ]
'use strict'
var
	Pylon = new require('..'),
	pNexus = new Pylon({name: 'p-nexus', debug: true }).create({port: 9000}),
	pProxy = new Pylon({name: 'p-proxy', debug: true }).connect({port: 9000}),
	pGate = new Pylon({name: 'p-gate', debug: true }).connect({port: 9000}).create({port: 9010}),
	pApi1 = new Pylon({name: 'p-api-1', debug: true }).connect({port: 9010}),
	pApi2 = new Pylon({name: 'p-api-2', debug: true }).connect({port: 9010})

pGate.register('some/data/request', function (data, respond) {
		var responses = []

		console.log((new Date()).toISOString() + ' GATE: some/data/request, asking for partials')
		this.notify('api/a', {}, update)
		this.notify('api/b', {}, update)

		function update(msg) {
			responses.push(msg.data)
			console.log((new Date()).toISOString() + ' GATE: updating responses: ', responses)
			if (responses.length == 2) {
				respond({ responses: responses })
			}
		}
	})



pApi1.register('api/a', (data, respond) => {
			console.log((new Date()).toISOString() + ' API-1: api/a, data: ', data)
			respond({ data: 'aaaAAAaaa'})
	})

pApi2.register('api/b', (data, respond) => {
		console.log((new Date()).toISOString() + ' API-2: api/b, data: ', data)
		respond({ data: 'bbbBBBbbb' })
	})

pProxy.notify('some/data/request', { api: 'a&b' }, (data) => {
	console.log((new Date()).toISOString() + ' NEXUS: data received: ' + JSON.stringify(data))
})