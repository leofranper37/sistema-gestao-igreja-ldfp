const { pool } = require('../config/db');
const { createVisitante } = require('../models/systemModel');

// GET /api/visita/:slug — retorna nome da igreja (endpoint público)
exports.getIgrejaPublica = async (req, res) => {
    const { slug } = req.params;
    try {
        const [rows] = await pool.query(
            'SELECT id, nome FROM igrejas WHERE slug = ? AND is_system = 0 LIMIT 1',
            [slug]
        );
        if (!rows.length) return res.status(404).json({ error: 'Igreja não encontrada.' });
        res.json({ nome: rows[0].nome });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// POST /api/visita/:slug — salva o visitante na tabela visitantes
exports.registrarVisita = async (req, res) => {
    const { slug } = req.params;
    const { nome, telefone, como_conheceu } = req.body || {};

    if (!nome || !String(nome).trim()) {
        return res.status(400).json({ error: 'Nome é obrigatório.' });
    }

    try {
        const [rows] = await pool.query(
            'SELECT id FROM igrejas WHERE slug = ? AND is_system = 0 LIMIT 1',
            [slug]
        );
        if (!rows.length) return res.status(404).json({ error: 'Igreja não encontrada.' });

        const igrejaId = rows[0].id;
        const hoje = new Date().toISOString().slice(0, 10);

        await createVisitante({
            nome: String(nome).trim(),
            telefone: telefone ? String(telefone).trim() : null,
            data: hoje,
            observacao: como_conheceu ? String(como_conheceu).trim() : null,
            igrejaId,
            nascimento: null,
            sexo: null,
            estadoCivil: null,
            endereco: null,
            numero: null,
            bairro: null,
            cidade: null,
            estado: null,
            cep: null,
            celular: null,
            email: null,
            congregacao: null,
            aceitouJesusEm: null,
            retornoEm: null
        });

        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
