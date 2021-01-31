const net = require('net');

const NGINX_API_ADDRESS = '172.168.0.3';
const NGINX_API_PORT = 5600;

// the command to execute on the remote API
const COMMAND = 'create-site';
const DOMAIN = 'test.flipweb.co.uk';
const UPSTREAM = 'http://flipNG';

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
      client.write(JSON.stringify({
        command: COMMAND,
        data: {
          domain: DOMAIN,
          upstream: UPSTREAM
        }
      }));

    });
    client.on('data', (data) => {
      console.log('Received response from NGINX API server:');
      const serverResponse = JSON.parse(data);

      if(serverResponse.status === 'ok') {
        console.log(`NGINX API server has responsed with a success status at time ${new Date(serverResponse.time).toString()}`);
      }
      else {
        console.error('The server has indicated that the command returned an error.');
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

