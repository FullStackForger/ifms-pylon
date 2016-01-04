# ifms-pylon
communication framework for node.js micro services


## Setup
 
 
### Create service
Creates parent service (server) with transport bus
```
pylon.create()
pylon.create({ port: 9000 })
pylon.create({ port: 9000, host: '127.0.0.1' })
```

### Connect to service
Creates child service (client) and will attempt to connect it a transport bus
```
var client = pylon.connect({ port: 9000 })
```

### Create and connect
Services can be both: a child and a parent
```
var service = pylon
  .connect({ port: 9000 })
  .create({ port: 9010 })
```

## service info
```
service.info()
```
returns
```
{
    server: { // if service is a server
        port: 9000,
        host: '127.0.0.1',
        clients: [{  // only if there are some
            id: 'a3S2dXd1',
            name: 'my-awesome-service'
        }]
    },
    client: {
        active: true,
        name: 'my-awesome-service'
        id: 'a3S2dXd1',  // only if active
        server: {        // only if active
            host: '127.0.0.1',
            port: 9000
        }
    }
}
```

## Communication

### Queries
```
host.ask('scope/action', { url: '/some/uri/pattern' }, () => { /* do smth. */})
host.ask({
  header: 'scope/action',
  data: { url: '/some/uri/pattern' }
}, () => { /* do smth. */})
```

### Notifications
```
host.say('scope/info', {  })
host.say('scope/error', {  })
```

### Subscribes
```
host.for('scope/action', () => { /* do smth */ } )
```