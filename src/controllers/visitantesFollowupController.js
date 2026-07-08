const { pool } = require('../config/db');

exports.getKanbanData = async (req, res) => {
    const { igrejaId } = req.auth;
    try {
        // Fallback seguro: se a coluna status_consolidacao não existir, cria em tempo de execução
        try { await pool.query("ALTER TABLE visitantes ADD COLUMN status_consolidacao VARCHAR(50) DEFAULT 'Novo'"); } catch (e) {}

        const [rows] = await pool.query(
            `SELECT id, nome, telefone, status_consolidacao, created_at, congregacao 
             FROM visitantes 
             WHERE igreja_id = ? 
             ORDER BY created_at DESC`,
            [igrejaId]
        );
        
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.updateStatus = async (req, res) => {
    const { igrejaId } = req.auth;
    const { id } = req.params;
    const { status } = req.body;
    
    try {
        await pool.query(
            'UPDATE visitantes SET status_consolidacao = ? WHERE id = ? AND igreja_id = ?', 
            [status, id, igrejaId]
        );
        res.json({ ok: true, status });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.getFollowups = async (req, res) => {
    const { igrejaId } = req.auth;
    const { id } = req.params;
    
    try {
        const [rows] = await pool.query(
            `SELECT id, tipo_contato, observacao, data_contato, responsavel_nome 
             FROM visitante_followup 
             WHERE visitante_id = ? AND igreja_id = ? 
             ORDER BY data_contato DESC`, 
            [id, igrejaId]
        );
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.addFollowup = async (req, res) => {
    const { igrejaId, nome } = req.auth;
    const { id } = req.params;
    const { tipo_contato, observacao } = req.body;
    
    if (!tipo_contato || !observacao) {
        return res.status(400).json({ error: 'Tipo de contato e observação são obrigatórios.' });
    }

    try {
        const [[visitante]] = await pool.query(
            'SELECT id FROM visitantes WHERE id = ? AND igreja_id = ?', [id, igrejaId]
        );
        if (!visitante) return res.status(404).json({ error: 'Visitante não encontrado.' });

        await pool.query(
            `INSERT INTO visitante_followup
            (igreja_id, visitante_id, tipo_contato, observacao, responsavel_nome) 
            VALUES (?, ?, ?, ?, ?)`, 
            [igrejaId, id, tipo_contato, observacao, nome]
        );
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};