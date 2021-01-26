const fs = require('fs');
const net = require('net');
const table = require('table').table;
const config = require('./config.json');

class NginxAutomationApi {

  /**
   * Creates an instance of NginxAutomationApi.
   * @memberof NginxAutomationApi
   */
  constructor() {
    if(this.isLetsEncryptInstalled()) {
      console.log(`Lets Encrypt is installed in directory ${config.letsEncryptPath}`);
    }

    if(this.isNginxInstalled() && this.nginxPathIsValid) {
      console.log(`Found NGINX installation directory ${config.nginxPath}`);
      this.startSocketServer();
      this.displayActiveSitesTable();
    }
    else {
      if(this.isNginxInstalled()) {
        throw 'NGINX appears to be installed, but the provided path is not a valid NGINX directory.';
      }
      else {
        throw 'NGINX does not appear to be installed on this system. Please check configuration file.';
      }
    }
  }

  /**
   *
   *
   * @return {*} 
   * @memberof NginxAutomationApi
   */
  isNginxInstalled() {
    return fs.existsSync(`${config.nginxPath}`);
  }

  /**
   *
   *
   * @return {*} 
   * @memberof NginxAutomationApi
   */
  nginxPathIsValid() {
    return fs.existsSync(`${config.nginxPath}/sites-enabled`);
  }

  /**
   *
   *
   * @return {*} 
   * @memberof NginxAutomationApi
   */
  isLetsEncryptInstalled() {
    return fs.existsSync(config.letsEncryptPath);
  }

  /**
   *
   *
   * @memberof NginxAutomationApi
   */
  async startSocketServer() {
    try {
      console.log(`Starting socket server on port :${config.socketPort}`);
      
      const bindAddress = config.bindAddress? config.bindAddress: '0.0.0.0';
      console.log(`Socket server will bind to IP address ${config.bindAddress}`);

      const socketServerOptions = {
        host: bindAddress,
        port: config.socketPort
      }
      const netSocketServer = net.createServer(socketServerOptions, (socketClient) => {
        console.log(`API Client connection from ${socketClient.remoteAddress}`);

        socketClient.on('data', async (data) => {
          console.log(`Command received from ${socketClient.remoteAddress}`);
          const cmdResponse = await this.dispatchCommandRequest(data.toString());

          socketClient.write(JSON.stringify(cmdResponse));
          socketClient.end();

        });

        socketClient.on('end', () => {
          console.log(`API Client connection from ${socketClient.remoteAddress} has closed at request of client.`);
        })
      });

      // handle errors that are thrown through the socket server.
      netSocketServer.on('error', (error) => {
        throw error;
      });

      // start the net socket server.
      netSocketServer.listen(config.socketPort, () => {
        console.log('API socket server is listening, and accepting connections.');
      })
    }
    catch(error) {
      throw error;
    }

  }

  /**
   *
   *
   * @param {*} request
   * @memberof NginxAutomationApi
   */
  async dispatchCommandRequest(request) {
    switch(request) {
      case('heartbeat-status'):
        return {status: 'alive', time: new Date()};
      break;

      case('create-site'):
        if(this.isLetsEncryptInstalled()) {
          console.log('Creating new site with LetsEncrypt certificate.');
        }
        else {
          console.log('Creatirng new site without LetsEncrypt certificate.');
        }
      break;

      default:
        return {status: 'err', message: 'Invalid request.'};
    }
  }

  /**
   *
   *
   * @memberof NginxAutomationApi
   */
  async displayActiveSitesTable() {
    try {
      console.log('Found the following installed sites:');
      let data = [
        ['Site Domain Name', 'Path']
      ];

      const nginxSites = fs.readdirSync(`${config.nginxPath}/sites-enabled`);
      for(let site in nginxSites) {
        data.push([site, `${config.nginxPath}/sites-enabled/${site}`]);
      }
        
      const tableConfiguration = {
        columns: {
          0: {
            alignment: 'left',
            width: 40
          },
          1: {
            alignment: 'center',
            width: 40
          },
        }
      };

      const output = table(data, tableConfiguration);
      console.log(output);
    }
    catch(error) {
      throw error;
    }
  }

}
new NginxAutomationApi();