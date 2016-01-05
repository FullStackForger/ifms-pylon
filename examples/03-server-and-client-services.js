var
	Pylon = new require('..')

pylonA = new Pylon('pylon-A')
	.create()
	.register('user/info/request', onInfoRequestAction)

pylonB = new Pylon('pylon-B')
	.connect()
	.notify('user/info/request', { userId: 'mark-bevels' }, onInfoRequestReply)

function onInfoRequestAction (data, respond) {
	console.log('request received: ' + JSON.stringify(data))
	respond({
		userId: 'mark-bevels',
		name: 'Mark',
		lname: 'Bevels'
	})
}

function onInfoRequestReply (data) {
	console.log('data received: ' + JSON.stringify(data))
}