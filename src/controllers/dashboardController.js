'use strict';

const { pool } = require('../config/db');

async function getStats(req, res) {
    const igrejaId = req.auth.igrejaId;

    try {
        const [
            rMembros,
            rVisitantes,
            rCriancas,
            rOracoes,
            rEventos,
            rMissionarios,
            rOutrasIgrejas,
            rAniversariantes,
            rRecentes,
            rMembrosTrend,
            rDizimosTrend
        ] = await Promise.all([
            pool.query(
                'SELECT COUNT(*) AS total FROM membros WHERE igreja_id = ?',
                [igrejaId]
            ),
            pool.query(
                'SELECT COUNT(*) AS total FROM visitantes WHERE igreja_id = ?',
                [igrejaId]
            ),
            pool.query(
                'SELECT COUNT(*) AS total FROM criancas WHERE igreja_id = ?',
                [igrejaId]
            ),
            pool.query(
                'SELECT COUNT(*) AS total FROM oracoes_pedidos WHERE igreja_id = ? AND is_private = 0 AND status = "pendente"',
                [igrejaId]
            ),
            pool.query(
                'SELECT COUNT(*) AS total FROM agenda_eventos WHERE igreja_id = ? AND inicio >= NOW()',
                [igrejaId]
            ),
            pool.query(
                'SELECT COUNT(*) AS total FROM missionarios WHERE igreja_id = ?',
                [igrejaId]
            ),
            pool.query(
                'SELECT COUNT(*) AS total FROM outras_igrejas WHERE igreja_id = ?',
                [igrejaId]
            ),
            pool.query(
                'SELECT COUNT(*) AS total FROM membros WHERE igreja_id = ? AND MONTH(nascimento) = MONTH(CURDATE()) AND nascimento IS NOT NULL',
                [igrejaId]
            ),
            pool.query(
                'SELECT id, nome, email, cidade, foto_url, created_at FROM membros WHERE igreja_id = ? ORDER BY id DESC LIMIT 6',
                [igrejaId]
            ),
            pool.query(
                `SELECT DATE_FORMAT(created_at, '%Y-%m') AS mes, COUNT(*) AS total
                 FROM membros
                 WHERE igreja_id = ? AND created_at >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
                 GROUP BY DATE_FORMAT(created_at, '%Y-%m')
                 ORDER BY mes ASC`,
                [igrejaId]
            ),
            pool.query(
                `SELECT competencia AS mes, SUM(valor) AS total
                 FROM dizimos
                 WHERE igreja_id = ? AND competencia >= DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL 6 MONTH), '%Y-%m')
                 GROUP BY competencia
                 ORDER BY competencia ASC`,
                [igrejaId]
            )
        ]);

        const [[membrosRow]]       = rMembros;
        const [[visitantesRow]]    = rVisitantes;
        const [[criancasRow]]      = rCriancas;
        const [[oracoesRow]]       = rOracoes;
        const [[eventosRow]]       = rEventos;
        const [[missionariosRow]]  = rMissionarios;
        const [[outrasIgrejasRow]] = rOutrasIgrejas;
        const [[anivRow]]          = rAniversariantes;
        const [recentesRows]       = rRecentes;
        const [membrosTrend]       = rMembrosTrend;
        const [dizimosTrend]       = rDizimosTrend;

        res.json({
            totais: {
                membros:       Number(membrosRow.total)      || 0,
                visitantes:    Number(visitantesRow.total)   || 0,
                criancas:      Number(criancasRow.total)     || 0,
                oracoes:       Number(oracoesRow.total)      || 0,
                eventos:       Number(eventosRow.total)      || 0,
                missionarios:  Number(missionariosRow.total) || 0,
                outrasIgrejas: Number(outrasIgrejasRow.total)|| 0,
                aniversariantes: Number(anivRow.total)       || 0
            },
            recentes: recentesRows || [],
            graficos: {
                membrosPorMes: (membrosTrend || []).map(r => ({
                    mes:   r.mes,
                    total: Number(r.total) || 0
                })),
                dizimosPorMes: (dizimosTrend || []).map(r => ({
                    mes:   r.mes,
                    total: Number(r.total) || 0
                }))
            }
        });
    } catch (err) {
        console.error('[dashboardController] getStats error:', err);
        res.status(500).json({ erro: 'Erro ao carregar estatísticas do dashboard' });
    }
}

module.exports = { getStats };
