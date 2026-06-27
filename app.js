// Compatibilidade com cPanel/Passenger quando o Startup File padrao e "app.js".
// Mantem o bootstrap principal em server.js na raiz do projeto.
const fs = require('fs');
const path = require('path');

const cpanelProjectServerPath = path.join(__dirname, 'sistema-gestao-igreja-ldfp-main', 'server.js');

if (fs.existsSync(cpanelProjectServerPath)) {
	require('./sistema-gestao-igreja-ldfp-main/server');
} else {
	require('./server');
}
