'use strict';

const { pool } = require('../config/db');
const financeModel = require('../models/financeModel');

function getIgrejaId(req) {
    return Number(req.auth?.igrejaId || 1);
}

async function getRelatorioMembro(req, res) {
    const igrejaId = getIgrejaId(req);
    const membroId = Number(req.params.id);

    if (!membroId || isNaN(membroId)) {
        return res.status(400).json({ message: 'ID de membro inválido.' });
    }

    // 1. Buscar dados do membro
    const [membros] = await pool.query(
        `SELECT id, nome, email, telefone, celular, apelido, nascimento,
                data_nascimento, sexo, estado_civil, profissao,
                endereco, numero, bairro, cidade, estado, cep,
                situacao, cargo, foto_url, created_at
         FROM membros
         WHERE id = ? AND igreja_id = ?
         LIMIT 1`,
        [membroId, igrejaId]
    );

    if (!membros || !membros.length) {
        return res.status(404).json({ message: 'Membro não encontrado.' });
    }

    const membro = membros[0];

    // 2. Buscar dizimos — por membro_id (link direto) OU por nome (lançamentos antigos sem id)
    const [dizimosRows] = await pool.query(
        `SELECT id, competencia, valor, tipo, observacao, membro_nome, created_at
         FROM dizimos
         WHERE igreja_id = ?
           AND (membro_id = ? OR membro_nome = ?)
         ORDER BY competencia DESC, id DESC
         LIMIT 200`,
        [igrejaId, membroId, membro.nome]
    );

    // 3. Calcular totais de dízimos
    const totalContribuido = dizimosRows.reduce((acc, d) => acc + Number(d.valor || 0), 0);
    const competenciasUnicas = [...new Set(dizimosRows.map(d => d.competencia))].length;
    const ultimaContribuicao = dizimosRows[0]?.competencia || null;

    // Agrupar por competencia para resumo mensal
    const porCompetencia = {};
    for (const d of dizimosRows) {
        if (!porCompetencia[d.competencia]) {
            porCompetencia[d.competencia] = { competencia: d.competencia, total: 0, itens: 0 };
        }
        porCompetencia[d.competencia].total += Number(d.valor || 0);
        porCompetencia[d.competencia].itens += 1;
    }
    const resumoMensal = Object.values(porCompetencia).sort((a, b) =>
        b.competencia.localeCompare(a.competencia)
    );

    return res.json({
        membro,
        dizimos: {
            items: dizimosRows,
            totais: {
                total_contribuido: totalContribuido,
                num_contribuicoes: dizimosRows.length,
                competencias_distintas: competenciasUnicas,
                ultima_contribuicao: ultimaContribuicao
            },
            resumo_mensal: resumoMensal
        }
    });
}

module.exports = { getRelatorioMembro };
