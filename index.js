const fs = require('fs');
const net = require('net');
const table = require('table').table;
const exec = require('child_process').exec;
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

          const dataCommmandRequest = JSON.parse(data);
          if(dataCommmandRequest.command) {    
            const cmdResponse = await this.dispatchCommandRequest(JSON.parse(data));

            socketClient.write(JSON.stringify(cmdResponse));
            socketClient.end();

          }
          else {
            console.log('Invalid command request was presented to server. This will be rejected.');
            const invalidCommandResponse = {
              status: 'err',
              message: 'Invalid command presented.'
            };

            socketClient.write(JSON.stringify(invalidCommandResponse));
            socketClient.end();

          }

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
    switch(request.command ) {
      case('heartbeat-status'):
        return {status: 'alive', time: new Date()};
      break;

      case('create-site'):
        if(this.isLetsEncryptInstalled()) {
          console.log('Creating new site with LetsEncrypt certificate.');
          const response = await this.createSiteWithSSL(request.data);

          return response;

        }
        else {
          console.log('Creatirng new site without LetsEncrypt certificate.');
          const response = await this.createSiteWithoutSSL(request.data);

          console.log(response);
          
          return response;

        }
      break;

      default:
        return {status: 'err', message: 'Invalid request.'};
    }
  }

  /**
   *
   *
   * @param {*} domain
   * @memberof NginxAutomationApi
   */
  doesNginxSiteExist(domain) {
    if(fs.existsSync(`${config.nginxPath}/sites-enabled/${domain}`)) {
      return true;
    }
    else {
      return false;
    }
  }

  /**
   *
   *
   * @param {*} siteData
   * @memberof NginxAutomationApi
   */
  async createSiteWithSSL(siteData) {
    if(siteData.domain && siteData.upstream) {
      if(this.doesNginxSiteExist(siteData.domain)) {
        return {
          status: 'err',
          errors: {
            domainExists: true
          },
          message: 'This site already exists.'
        }

      }
      else {
        let siteTemplate = fs.readFileSync(__dirname + '/site-templates/default').toString();
        siteTemplate.replace('@@@domain@@@', siteData.domain);
        siteTemplate.replace('@@@upstream@@@', siteData.upstream);

        // write the new site file
        fs.writeFileSync(`${config.nginxPath}/sites-enabled/${siteData.domain}`, siteTemplate);

        // attempt to reload the NGINX web server service.
        return new Promise((resolve, reject) => {
          const sudo = config.executeAsSudo? config.executeAsSudo: '';
          exec(`${sudo} service nginx reload`, (err, stderr, stdout) => {

            if(err) throw err;
            else if(stderr) {
              console.log('Service NGINX reload returned the following error: ');
              console.error(stderr);
  
              resolve({
                status: 'err',
                message: 'Could not reload NGINX service.',
                errors: [
                  {
                    unknown: stderr
                  }
                ]
              });
            }
            else {
              if(stdout) {
                console.log('Output from service NGINX reload:');
                console.log(stdout);
              }
  
              revolve({
                status: 'ok',
                time: new Date()
              });
            }
          });
        })
      }
    }
    else {
      return {
        status: 'err',
        message: 'siteData must include domain and upstream'
      };
    }
  }

  /**
   *
   *
   * @param {*} siteData
   * @memberof NginxAutomationApi
   */
  async createSiteWithoutSSL(siteData) {
    if(siteData.domain && siteData.upstream) {
      if(this.doesNginxSiteExist(siteData.domain)) {
        return {
          status: 'err',
          errors: {
            domainExists: true
          },
          message: 'This site already exists.'
        }

      }
      else {
        let siteTemplate = fs.readFileSync(__dirname + '/site-templates/default').toString();
        siteTemplate.replace('@@@domain@@@', siteData.domain);
        siteTemplate.replace('@@@upstream@@@', siteData.upstream);

        let siteWwwTemplate = fs.readFileSync(__dirname + '/site-templates/default').toString();
        siteTemplate.replace('@@@domain@@@', `www.${siteData.domain}`);
        siteTemplate.replace('@@@upstream@@@', siteData.upstream);

        // write the new site file
        fs.writeFileSync(`${config.nginxPath}/sites-enabled/${siteData.domain}`, siteTemplate);
        fs.writeFileSync(`${config.nginxPath}/sites-enabled/www.${siteData.domain}`, siteTemplate);

        // attempt to reload the NGINX web server service.
        return new Promise((resolve, reject) => {
          const sudo = config.executeAsSudo? config.executeAsSudo: '';
          exec(`${sudo} service nginx reload`, (err, stderr, stdout) => {

            if(err) throw err;
            else if(stderr) {
              console.log('Service NGINX reload returned the following error: ');
              console.error(stderr);
  
              resolve({
                status: 'err',
                message: 'Could not reload NGINX service.',
                errors: [
                  {
                    unknown: stderr
                  }
                ]
              });
            }
            else {
              if(stdout) {
                console.log('Output from service NGINX reload:');
                console.log(stdout);
              }
  
              // attempt to install the lets encrypt SSL certificate.
              console.log('Installing the SSL certificate.');
              exec(`${sudo} certbot certonly --noninteractive --webroot --agree-tos --register-unsafely-without-email -d ${siteData.domain}`, (err, stdErr, stdOuut) => {
                if(err) throw err;
                else if(stdErr) {
                  console.log('SSL certificate generation and installation returned the following error: ');
                  console.error(stdErr);

                }
                else {
                  console.log(`Installing the SSL certificate on the www. hostfile of ${siteData.domain}`);
                  exec(`${sudo} certbot certonly --noninteractive --webroot --agree-tos --register-unsafely-without-email -d www.${siteData.domain}`, (err, stdErr, stdOuut) => {
                    if(err) throw err;
                    else if(stdErr) {
                    console.log('SSL certificate generation and installation returned the following error: ');
                    console.error(stdErr);

                    }
                    else {
                      console.log(`Done creating and configuring websites ${siteData.domain} and www.${siteData.domain}`);

                      resolve({
                        status: 'ok',
                        time: new Date()
                      });
                    }
                  });

                }
              });
            }
          });
        });
      }
      
    }
    else {
      return {
        status: 'err',
        message: 'siteData must include domain and upstream'
      };
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
      for(let site of nginxSites) {
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