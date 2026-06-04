const express = require('express');
const router = express.Router();
const { exec } = require('child_process');

router.post('/', (req, res) => {
    // O comando entra na pasta do projeto, puxa as atualizações do GitHub 
    // e dá um "touch" para reiniciar o app Node.js automaticamente.
    const cmd = 'cd /home/ldfp8965/ldfp.com.br && git pull origin main && touch tmp/restart.txt';
    
    exec(cmd, (error, stdout, stderr) => {
        if (error) {
            console.error(`Erro no webhook: ${error.message}`);
            return res.status(500).json({ error: 'Erro ao atualizar o servidor' });
        }
        console.log(`Atualização concluída: ${stdout}`);
        res.status(200).json({ message: 'Servidor atualizado com sucesso via GitHub!' });
    });
});

module.exports = router;