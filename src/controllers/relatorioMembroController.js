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

    // 4. Batismos em que o membro é candidato
    let batismosRows = [];
    try {
        const fmtD = d => {
            if (!d) return null;
            if (d instanceof Date) return d.toISOString().slice(0, 10);
            return String(d).slice(0, 10);
        };
        const [rows] = await pool.query(
            `SELECT b.descricao, b.data_batismo, b.local_batismo, b.pastor, b.encerrado,
                    c.status AS status_candidato, c.created_at AS data_inscricao
             FROM batismo_candidatos c
             JOIN batismos b ON b.id = c.batismo_id
             WHERE c.igreja_id = ? AND (c.membro_id = ? OR c.nome = ?)
             ORDER BY b.data_batismo DESC LIMIT 50`,
            [igrejaId, membroId, membro.nome]
        );
        batismosRows = rows.map(r => ({ ...r, data_batismo: fmtD(r.data_batismo) }));
    } catch (_) {
        // tabela ainda não existe — ignora silenciosamente
    }

    // 5. Escalas em que o membro está atribuído
    let escalasRows = [];
    try {
        const fmtD2 = d => {
            if (!d) return null;
            if (d instanceof Date) return d.toISOString().slice(0, 10);
            return String(d).slice(0, 10);
        };
        const [erows] = await pool.query(
            `SELECT e.title AS evento, i.instance_date AS data, f.name AS funcao
             FROM escalas_atribuicoes a
             JOIN escalas_instancias i ON i.id = a.instance_id
             JOIN escalas_funcoes f   ON f.id = a.function_id
             JOIN escalas_eventos e   ON e.id = i.event_id
             WHERE a.church_id = ? AND a.member_id = ? AND i.is_cancelled = 0
             ORDER BY i.instance_date DESC LIMIT 30`,
            [igrejaId, membroId]
        );
        escalasRows = erows.map(r => ({ ...r, data: fmtD2(r.data) }));
    } catch (_) {
        // tabelas ainda não existem — ignora silenciosamente
    }

    // 6. Grupos & Células em que o membro participa
    let gruposRows = [];
    try {
        const [grows] = await pool.query(
            `SELECT g.nome, g.categoria, gm.funcao, gm.desde
             FROM grupo_membros gm
             JOIN grupos g ON g.id = gm.grupo_id
             WHERE gm.membro_id = ? AND gm.igreja_id = ?
             ORDER BY g.nome`,
            [membroId, igrejaId]
        );
        const fmtD3 = d => {
            if (!d) return null;
            if (d instanceof Date) return d.toISOString().slice(0, 10);
            return String(d).slice(0, 10);
        };
        gruposRows = grows.map(r => ({ ...r, desde: fmtD3(r.desde) }));
    } catch (_) {
        // tabelas ainda não existem — ignora silenciosamente
    }

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
        },
        batismos: batismosRows,
        escalas: escalasRows,
        grupos: gruposRows
    });
}

module.exports = { getRelatorioMembro };
