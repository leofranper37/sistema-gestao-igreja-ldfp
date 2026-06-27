'use strict';

const { pool } = require('../config/db');
const { bootstrapAllTables } = require('../models/tableBootstrap');

async function safeCount(sql, params) {
    try {
        const [[row]] = await pool.query(sql, params);
        return Number(row?.total || 0);
    } catch (_) {
        return 0;
    }
}

async function safeRows(sql, params) {
    try {
        const [rows] = await pool.query(sql, params);
        return rows || [];
    } catch (_) {
        return [];
    }
}

async function getStats(req, res) {
    const igrejaId = req.auth.igrejaId;

    try {
        await bootstrapAllTables();

        const [
            membros,
            visitantes,
            criancas,
            oracoes,
            eventos,
            missionarios,
            outrasIgrejas,
            aniversariantes,
            recentes,
            membrosTrend,
            dizimosTrend,
            anivLista
        ] = await Promise.all([
            safeCount(
                'SELECT COUNT(*) AS total FROM membros WHERE igreja_id = ?',
                [igrejaId]
            ),
            safeCount(
                'SELECT COUNT(*) AS total FROM visitantes WHERE igreja_id = ?',
                [igrejaId]
            ),
            safeCount(
                'SELECT COUNT(*) AS total FROM criancas WHERE igreja_id = ?',
                [igrejaId]
            ),
            safeCount(
                "SELECT COUNT(*) AS total FROM oracoes_pedidos WHERE igreja_id = ? AND status = 'pendente'",
                [igrejaId]
            ),
            safeCount(
                'SELECT COUNT(*) AS total FROM agenda_eventos WHERE igreja_id = ? AND inicio >= NOW()',
                [igrejaId]
            ),
            safeCount(
                'SELECT COUNT(*) AS total FROM missionarios WHERE igreja_id = ?',
                [igrejaId]
            ),
            safeCount(
                'SELECT COUNT(*) AS total FROM outras_igrejas WHERE igreja_id = ?',
                [igrejaId]
            ),
            safeCount(
                'SELECT COUNT(*) AS total FROM membros WHERE igreja_id = ? AND MONTH(nascimento) = MONTH(CURDATE()) AND nascimento IS NOT NULL',
                [igrejaId]
            ),
            safeRows(
                'SELECT id, nome, email, cidade, foto_url, created_at FROM membros WHERE igreja_id = ? ORDER BY id DESC LIMIT 6',
                [igrejaId]
            ),
            safeRows(
                "SELECT DATE_FORMAT(created_at, '%Y-%m') AS mes, COUNT(*) AS total" +
                ' FROM membros' +
                ' WHERE igreja_id = ? AND created_at >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)' +
                " GROUP BY DATE_FORMAT(created_at, '%Y-%m')" +
                ' ORDER BY mes ASC',
                [igrejaId]
            ),
            safeRows(
                'SELECT competencia AS mes, SUM(valor) AS total' +
                ' FROM dizimos' +
                " WHERE igreja_id = ? AND competencia >= DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL 6 MONTH), '%Y-%m')" +
                ' GROUP BY competencia' +
                ' ORDER BY competencia ASC',
                [igrejaId]
            ),
            safeRows(
                'SELECT id, nome, foto_url, nascimento' +
                ' FROM membros' +
                ' WHERE igreja_id = ? AND MONTH(nascimento) = MONTH(CURDATE()) AND nascimento IS NOT NULL' +
                ' ORDER BY DAY(nascimento) ASC LIMIT 10',
                [igrejaId]
            )
        ]);

        res.json({
            totais: {
                membros,
                visitantes,
                criancas,
                oracoes,
                eventos,
                missionarios,
                outrasIgrejas,
                aniversariantes
            },
            recentes,
            aniversariantesMes: anivLista,
            graficos: {
                membrosPorMes: membrosTrend.map(r => ({ mes: r.mes, total: Number(r.total) || 0 })),
                dizimosPorMes: dizimosTrend.map(r => ({ mes: r.mes, total: Number(r.total) || 0 }))
            }
        });
    } catch (err) {
        console.error('[dashboardController] getStats error:', err);
        res.status(500).json({ erro: 'Erro ao carregar estatísticas do dashboard' });
    }
}

module.exports = { getStats };
