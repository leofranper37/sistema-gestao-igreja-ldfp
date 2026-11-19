const { pool } = require('../config/db');
const { criarRecibo, listarRecibos, buscarRecibo, deletarRecibo } = require('../models/reciboModel');

async function getRecibos(req, res) {
    try {
        const igrejaId = req.auth.igrejaId;
        const { pagina, limite, busca } = req.query;
        const resultado = await listarRecibos(igrejaId, { pagina, limite, busca });
        res.json(resultado);
    } catch (err) {
        res.status(500).json({ error: 'Erro ao listar recibos.' });
    }
}

async function postRecibo(req, res) {
    try {
        const igrejaId = req.auth.igrejaId;
        const { favorecido, referente, data_recibo, observacao } = req.body || {};
        const valor = Number(String(req.body && req.body.valor != null ? req.body.valor : '').replace(',', '.'));
        if (!(valor > 0)) return res.status(400).json({ error: 'Informe um valor maior que zero.' });
        if (!favorecido || !referente || !valor || !data_recibo) {
            return res.status(400).json({ error: 'Campos obrigatórios: favorecido, referente, valor, data_recibo.' });
        }
        const resultado = await criarRecibo(igrejaId, { favorecido, referente, valor, data_recibo, observacao }, req.auth.id);
        res.status(201).json(resultado);
    } catch (err) {
        res.status(500).json({ error: 'Erro ao criar recibo.' });
    }
}

async function getRecibo(req, res) {
    try {
        const recibo = await buscarRecibo(req.auth.igrejaId, Number(req.params.id));
        if (!recibo) return res.status(404).json({ error: 'Recibo não encontrado.' });
        const [ig] = await pool.query('SELECT nome FROM igrejas WHERE id = ? LIMIT 1', [req.auth.igrejaId]);
        res.json({ ...recibo, igreja_nome: ig[0] ? ig[0].nome : '' });
    } catch (err) {
        res.status(500).json({ error: 'Erro ao buscar recibo.' });
    }
}

async function deleteRecibo(req, res) {
    try {
        const ok = await deletarRecibo(req.auth.igrejaId, Number(req.params.id));
        if (!ok) return res.status(404).json({ error: 'Recibo não encontrado.' });
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: 'Erro ao excluir recibo.' });
    }
}

module.exports = { getRecibos, postRecibo, getRecibo, deleteRecibo };
