const net = require('net');

const NGINX_API_ADDRESS = '127.0.0.1';
const NGINX_API_PORT = 5600;

// the command to execute on the remote API
const COMMAND = 'heartbeat-status';

async function startExample() {
  try {
    const clientConnectionOptions = {
      port: NGINX_API_PORT,
      host: NGINX_API_ADDRESS
    };
    const client = net.createConnection(clientConnectionOptions, () => {
      console.log(`Connection to NGINX API server [${NGINX_API_ADDRESS}:${NGINX_API_PORT}] has been established.`);
      
      // send command through established connection
      console.log('Sending command transaction to NGINX API server.');
      console.log(`WRITE -> ${COMMAND}`);
      client.write(COMMAND);

    });
    client.on('data', (data) => {
      console.log('Received response from NGINX API server:');
      const heartbeatStatusResponse = JSON.parse(data);

      if(heartbeatStatusResponse.status === 'alive') {
        console.log(`NGINX API server has responsed with status ALIVE at time ${new Date(heartbeatStatusResponse.time).toString()}`);
      }

      client.end();

    });

    client.on('end', () => {
      console.log('Connection to NGINX socket server has been closed.')
    });

  }
  catch(error) {
    throw error;
  }

}

startExample().catch((error) => {
  throw error;
});

