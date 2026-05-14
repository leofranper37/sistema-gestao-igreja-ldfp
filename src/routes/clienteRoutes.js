const express = require('express');
const { requireAuth } = require('../middlewares/auth');
const { pool } = require('../config/db');
const moduleAccessService = require('../services/moduleAccessService');

const router = express.Router();

function toNumber(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

async function queryCount(sql, params = [], fallback = 0) {
    try {
        const [rows] = await pool.query(sql, params);
        const row = rows?.[0] || {};
        return toNumber(row.total ?? row.cnt ?? row.count ?? fallback, fallback);
    } catch (_) {
        return fallback;
    }
}

router.get('/painel', requireAuth, async (req, res) => {
    try {
        const igrejaId = Number(req.auth?.igrejaId || 0);
        if (!igrejaId) {
            return res.status(400).json({ error: 'Igreja não definida.' });
        }

        const [igrejaRows] = await pool.query(
            `SELECT i.id, i.nome, i.plano, i.status_assinatura,
                    i.max_cadastros, i.max_congregacoes,
                    i.responsavel, i.email_admin, i.telefone, i.cnpj,
                    sp.nome AS plano_nome, sp.subtitulo AS plano_subtitulo,
                    sp.preco_mensal, sp.preco_anual
             FROM igrejas i
             LEFT JOIN saas_planos sp ON sp.slug = i.plano
             WHERE i.id = ?
             LIMIT 1`,
            [igrejaId]
        );

        const igreja = igrejaRows?.[0];
        if (!igreja) {
            return res.status(404).json({ error: 'Igreja não encontrada.' });
        }

        const access = await moduleAccessService.getEffectiveAccessForChurch(igrejaId, igreja.plano || 'eden');
        const modulos = await moduleAccessService.getChurchModules(igrejaId, igreja.plano || 'eden');

        const totalMembros = await queryCount('SELECT COUNT(*) AS total FROM membros WHERE igreja_id = ?', [igrejaId]);
        const totalVisitantes = await queryCount("SELECT COUNT(*) AS total FROM membros WHERE igreja_id = ? AND LOWER(COALESCE(situacao, '')) = 'visitante'", [igrejaId]);
        const totalCriancas = await queryCount('SELECT COUNT(*) AS total FROM criancas WHERE igreja_id = ?', [igrejaId]);
        const totalOracoes = await queryCount('SELECT COUNT(*) AS total FROM pedidos_oracao WHERE igreja_id = ?', [igrejaId]);
        const totalEventos = await queryCount('SELECT COUNT(*) AS total FROM agenda WHERE igreja_id = ? AND data >= CURRENT_DATE', [igrejaId]);
        const totalMissionarios = await queryCount('SELECT COUNT(*) AS total FROM missionarios WHERE igreja_id = ?', [igrejaId]);
        const totalOutrasIgrejas = await queryCount('SELECT COUNT(*) AS total FROM outras_igrejas WHERE igreja_id = ?', [igrejaId]);

        let aniversariantes = [];
        try {
            [aniversariantes] = await pool.query(
                `SELECT id, nome, telefone, data_nascimento
                 FROM membros
                 WHERE igreja_id = ?
                   AND DATE(data_nascimento) = DATE('now')
                 ORDER BY nome ASC
                 LIMIT 10`,
                [igrejaId]
            );
        } catch (_) {
            try {
                [aniversariantes] = await pool.query(
                    `SELECT id, nome, telefone, data_nascimento
                     FROM membros
                     WHERE igreja_id = ?
                       AND DAY(data_nascimento) = DAY(CURDATE())
                       AND MONTH(data_nascimento) = MONTH(CURDATE())
                     ORDER BY nome ASC
                     LIMIT 10`,
                    [igrejaId]
                );
            } catch (_) {
                aniversariantes = [];
            }
        }

        let membrosRecentes = [];
        try {
            [membrosRecentes] = await pool.query(
                `SELECT id, nome, email, telefone, situacao, created_at
                 FROM membros
                 WHERE igreja_id = ?
                 ORDER BY created_at DESC
                 LIMIT 5`,
                [igrejaId]
            );
        } catch (_) {
            membrosRecentes = [];
        }

        return res.json({
            igreja,
            modulos,
            featureKeys: access.featureKeys || [],
            metricas: {
                total_membros: totalMembros,
                total_visitantes: totalVisitantes,
                total_criancas: totalCriancas,
                total_oracoes: totalOracoes,
                total_eventos: totalEventos,
                total_missionarios: totalMissionarios,
                total_outras_igrejas: totalOutrasIgrejas,
                aniversariantes_hoje: aniversariantes.length
            },
            aniversariantes,
            membros_recentes: membrosRecentes
        });
    } catch (error) {
        console.error('Erro /api/cliente/painel:', error);
        return res.status(500).json({ error: 'Erro ao carregar painel.' });
    }
});

module.exports = router;
