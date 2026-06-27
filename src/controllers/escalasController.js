const { pool } = require('../config/db');

// ───────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────
function fmtDate(d) {
    if (!d) return null;
    if (d instanceof Date) return d.toISOString().slice(0, 10);
    return String(d).slice(0, 10);
}

function addDays(date, n) {
    const d = new Date(date);
    d.setDate(d.getDate() + n);
    return d;
}

function addMonths(date, n) {
    const d = new Date(date);
    d.setMonth(d.getMonth() + n);
    return d;
}

function toDateStr(d) {
    return d.toISOString().slice(0, 10);
}

/**
 * Gera array de datas para um evento recorrente.
 * Limite máximo: 200 instâncias ou 2 anos, o que vier primeiro.
 */
function gerarInstancias(startDate, recurrenceType, endDate) {
    const datas = [];
    const inicio = new Date(startDate);
    const limite = endDate
        ? new Date(endDate)
        : new Date(toDateStr(addDays(inicio, 730))); // 2 anos

    datas.push(toDateStr(inicio));
    if (recurrenceType === 'none') return datas;

    const stepDias =
        recurrenceType === 'weekly'   ? 7  :
        recurrenceType === 'biweekly' ? 14 : null;

    if (stepDias) {
        let cur = addDays(inicio, stepDias);
        while (cur <= limite && datas.length < 200) {
            datas.push(toDateStr(cur));
            cur = addDays(cur, stepDias);
        }
    } else {
        // monthly — mesmo dia do mês
        const diaInicio = inicio.getDate();
        let cur = addMonths(inicio, 1);
        while (cur <= limite && datas.length < 200) {
            const tentativa = new Date(cur.getFullYear(), cur.getMonth(), diaInicio);
            if (tentativa <= limite) datas.push(toDateStr(tentativa));
            cur = addMonths(cur, 1);
        }
    }
    return datas;
}

// ───────────────────────────────────────────────
// Dashboard
// ───────────────────────────────────────────────
exports.getDashboard = async (req, res) => {
    const churchId = req.auth.igrejaId;
    try {
        const [[{ total_eventos }]] = await pool.query(
            'SELECT COUNT(*) AS total_eventos FROM escalas_eventos WHERE church_id = ?', [churchId]);
        const [[{ total_ocorrencias }]] = await pool.query(
            'SELECT COUNT(*) AS total_ocorrencias FROM escalas_instancias WHERE church_id = ? AND is_cancelled = 0', [churchId]);
        const [[{ total_atribuicoes }]] = await pool.query(
            'SELECT COUNT(*) AS total_atribuicoes FROM escalas_atribuicoes WHERE church_id = ?', [churchId]);
        const [participacao] = await pool.query(
            `SELECT m.nome AS full_name, COUNT(a.id) AS total_escalas
             FROM escalas_atribuicoes a
             JOIN membros m ON m.id = a.member_id
             WHERE a.church_id = ?
             GROUP BY a.member_id, m.nome
             ORDER BY total_escalas DESC
             LIMIT 10`, [churchId]);
        res.json({ total_eventos, total_ocorrencias, total_atribuicoes, participacao_membros: participacao });
    } catch (err) {
        console.error('getDashboard escalas:', err);
        res.status(500).json({ error: 'Erro interno' });
    }
};

// ───────────────────────────────────────────────
// Eventos
// ───────────────────────────────────────────────
exports.listEventos = async (req, res) => {
    const churchId = req.auth.igrejaId;
    try {
        const [rows] = await pool.query(
            `SELECT id, title, start_date, recurrence_type, recurrence_end_date, created_at
             FROM escalas_eventos
             WHERE church_id = ?
             ORDER BY start_date DESC`, [churchId]);
        rows.forEach(r => {
            r.start_date = fmtDate(r.start_date);
            r.recurrence_end_date = fmtDate(r.recurrence_end_date);
        });
        res.json(rows);
    } catch (err) {
        console.error('listEventos:', err);
        res.status(500).json({ error: 'Erro interno' });
    }
};

exports.getEvento = async (req, res) => {
    const churchId = req.auth.igrejaId;
    const { id } = req.params;
    try {
        const [[event]] = await pool.query(
            'SELECT id, title, start_date, recurrence_type, recurrence_end_date FROM escalas_eventos WHERE id = ? AND church_id = ?',
            [id, churchId]);
        if (!event) return res.status(404).json({ error: 'Evento não encontrado' });
        event.start_date = fmtDate(event.start_date);
        event.recurrence_end_date = fmtDate(event.recurrence_end_date);

        const [functions] = await pool.query(
            'SELECT function_id FROM escalas_evento_funcoes WHERE event_id = ?', [id]);
        res.json({ event, functions });
    } catch (err) {
        console.error('getEvento:', err);
        res.status(500).json({ error: 'Erro interno' });
    }
};

exports.createEvento = async (req, res) => {
    const churchId = req.auth.igrejaId;
    const { title, start_date, recurrence_type = 'none', recurrence_end_date, function_ids = [] } = req.body;
    if (!title || !start_date) return res.status(400).json({ error: 'Título e data são obrigatórios' });

    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        const [{ insertId: eventId }] = await conn.query(
            `INSERT INTO escalas_eventos (church_id, title, start_date, recurrence_type, recurrence_end_date)
             VALUES (?, ?, ?, ?, ?)`,
            [churchId, title.trim(), start_date, recurrence_type, recurrence_end_date || null]);

        // Funções vinculadas ao evento
        if (function_ids.length) {
            const vals = function_ids.map(fid => [eventId, fid]);
            await conn.query('INSERT INTO escalas_evento_funcoes (event_id, function_id) VALUES ?', [vals]);
        }

        // Gerar instâncias
        const datas = gerarInstancias(start_date, recurrence_type, recurrence_end_date);
        if (datas.length) {
            const instVals = datas.map(d => [eventId, churchId, d]);
            await conn.query('INSERT INTO escalas_instancias (event_id, church_id, instance_date) VALUES ?', [instVals]);
        }

        await conn.commit();
        res.status(201).json({ id: eventId, instancias_criadas: datas.length });
    } catch (err) {
        await conn.rollback();
        console.error('createEvento:', err);
        res.status(500).json({ error: 'Erro interno' });
    } finally {
        conn.release();
    }
};

exports.updateEvento = async (req, res) => {
    const churchId = req.auth.igrejaId;
    const { id } = req.params;
    const { title, start_date, recurrence_type = 'none', recurrence_end_date, function_ids = [] } = req.body;
    if (!title || !start_date) return res.status(400).json({ error: 'Título e data são obrigatórios' });

    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        const [info] = await conn.query(
            'UPDATE escalas_eventos SET title = ?, start_date = ?, recurrence_type = ?, recurrence_end_date = ?, updated_at = NOW() WHERE id = ? AND church_id = ?',
            [title.trim(), start_date, recurrence_type, recurrence_end_date || null, id, churchId]);
        if (!info.affectedRows) {
            await conn.rollback();
            return res.status(404).json({ error: 'Evento não encontrado' });
        }

        // Atualiza funções vinculadas
        await conn.query('DELETE FROM escalas_evento_funcoes WHERE event_id = ?', [id]);
        if (function_ids.length) {
            const vals = function_ids.map(fid => [id, fid]);
            await conn.query('INSERT INTO escalas_evento_funcoes (event_id, function_id) VALUES ?', [vals]);
        }

        await conn.commit();
        res.json({ ok: true });
    } catch (err) {
        await conn.rollback();
        console.error('updateEvento:', err);
        res.status(500).json({ error: 'Erro interno' });
    } finally {
        conn.release();
    }
};

exports.deleteEvento = async (req, res) => {
    const churchId = req.auth.igrejaId;
    const { id } = req.params;
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        // Verify ownership before any mutation — prevents cross-tenant cascade deletion
        const [[ev]] = await conn.query(
            'SELECT id FROM escalas_eventos WHERE id = ? AND church_id = ? LIMIT 1', [id, churchId]);
        if (!ev) {
            await conn.rollback();
            return res.status(404).json({ error: 'Evento não encontrado' });
        }
        // Cascade in reverse dependency order (ownership confirmed above)
        await conn.query(
            `DELETE a FROM escalas_atribuicoes a
             JOIN escalas_instancias i ON i.id = a.instance_id
             WHERE i.event_id = ? AND i.church_id = ?`, [id, churchId]);
        await conn.query('DELETE FROM escalas_instancias WHERE event_id = ? AND church_id = ?', [id, churchId]);
        await conn.query('DELETE FROM escalas_evento_funcoes WHERE event_id = ?', [id]);
        await conn.query('DELETE FROM escalas_eventos WHERE id = ? AND church_id = ?', [id, churchId]);
        await conn.commit();
        res.json({ ok: true });
    } catch (err) {
        await conn.rollback();
        console.error('deleteEvento:', err);
        res.status(500).json({ error: 'Erro interno' });
    } finally {
        conn.release();
    }
};

// ───────────────────────────────────────────────
// Instâncias
// ───────────────────────────────────────────────
exports.listInstancias = async (req, res) => {
    const churchId = req.auth.igrejaId;
    const { id: eventId } = req.params;
    try {
        const [rows] = await pool.query(
            `SELECT i.id, i.instance_date, i.is_cancelled
             FROM escalas_instancias i
             JOIN escalas_eventos e ON e.id = i.event_id
             WHERE i.event_id = ? AND i.church_id = ? AND e.church_id = ?
             ORDER BY i.instance_date`,
            [eventId, churchId, churchId]);
        rows.forEach(r => { r.instance_date = fmtDate(r.instance_date); });
        res.json(rows);
    } catch (err) {
        console.error('listInstancias:', err);
        res.status(500).json({ error: 'Erro interno' });
    }
};

exports.updateInstancia = async (req, res) => {
    const churchId = req.auth.igrejaId;
    const { id } = req.params;
    const { is_cancelled } = req.body;
    try {
        await pool.query(
            'UPDATE escalas_instancias SET is_cancelled = ? WHERE id = ? AND church_id = ?',
            [is_cancelled ? 1 : 0, id, churchId]);
        res.json({ ok: true });
    } catch (err) {
        console.error('updateInstancia:', err);
        res.status(500).json({ error: 'Erro interno' });
    }
};

// ───────────────────────────────────────────────
// Grupos
// ───────────────────────────────────────────────
exports.listGrupos = async (req, res) => {
    const churchId = req.auth.igrejaId;
    try {
        const [rows] = await pool.query(
            'SELECT id, name, parent_id FROM escalas_grupos WHERE church_id = ? ORDER BY name',
            [churchId]);
        res.json(rows);
    } catch (err) {
        console.error('listGrupos:', err);
        res.status(500).json({ error: 'Erro interno' });
    }
};

exports.createGrupo = async (req, res) => {
    const churchId = req.auth.igrejaId;
    const { name, parent_id } = req.body;
    if (!name) return res.status(400).json({ error: 'Nome é obrigatório' });
    try {
        const [{ insertId }] = await pool.query(
            'INSERT INTO escalas_grupos (church_id, name, parent_id) VALUES (?, ?, ?)',
            [churchId, name.trim(), parent_id || null]);
        res.status(201).json({ id: insertId });
    } catch (err) {
        console.error('createGrupo:', err);
        res.status(500).json({ error: 'Erro interno' });
    }
};

exports.updateGrupo = async (req, res) => {
    const churchId = req.auth.igrejaId;
    const { id } = req.params;
    const { name, parent_id } = req.body;
    if (!name) return res.status(400).json({ error: 'Nome é obrigatório' });
    try {
        const [info] = await pool.query(
            'UPDATE escalas_grupos SET name = ?, parent_id = ? WHERE id = ? AND church_id = ?',
            [name.trim(), parent_id || null, id, churchId]);
        if (!info.affectedRows) return res.status(404).json({ error: 'Grupo não encontrado' });
        res.json({ ok: true });
    } catch (err) {
        console.error('updateGrupo:', err);
        res.status(500).json({ error: 'Erro interno' });
    }
};

exports.deleteGrupo = async (req, res) => {
    const churchId = req.auth.igrejaId;
    const { id } = req.params;
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        await conn.query('DELETE FROM escalas_funcoes WHERE group_id = ? AND church_id = ?', [id, churchId]);
        await conn.query('DELETE FROM escalas_grupos WHERE id = ? AND church_id = ?', [id, churchId]);
        await conn.commit();
        res.json({ ok: true });
    } catch (err) {
        await conn.rollback();
        console.error('deleteGrupo:', err);
        res.status(500).json({ error: 'Erro interno' });
    } finally {
        conn.release();
    }
};

// ───────────────────────────────────────────────
// Funções
// ───────────────────────────────────────────────
exports.listFuncoes = async (req, res) => {
    const churchId = req.auth.igrejaId;
    try {
        const [rows] = await pool.query(
            `SELECT f.id, f.name, f.max_quantity, f.group_id, g.name AS group_name
             FROM escalas_funcoes f
             JOIN escalas_grupos g ON g.id = f.group_id
             WHERE f.church_id = ?
             ORDER BY g.name, f.name`, [churchId]);
        res.json(rows);
    } catch (err) {
        console.error('listFuncoes:', err);
        res.status(500).json({ error: 'Erro interno' });
    }
};

exports.createFuncao = async (req, res) => {
    const churchId = req.auth.igrejaId;
    const { group_id, name, max_quantity } = req.body;
    if (!group_id || !name) return res.status(400).json({ error: 'Grupo e nome são obrigatórios' });
    try {
        const [{ insertId }] = await pool.query(
            'INSERT INTO escalas_funcoes (church_id, group_id, name, max_quantity) VALUES (?, ?, ?, ?)',
            [churchId, group_id, name.trim(), max_quantity || null]);
        res.status(201).json({ id: insertId });
    } catch (err) {
        console.error('createFuncao:', err);
        res.status(500).json({ error: 'Erro interno' });
    }
};

exports.updateFuncao = async (req, res) => {
    const churchId = req.auth.igrejaId;
    const { id } = req.params;
    const { group_id, name, max_quantity } = req.body;
    if (!group_id || !name) return res.status(400).json({ error: 'Grupo e nome são obrigatórios' });
    try {
        const [info] = await pool.query(
            'UPDATE escalas_funcoes SET group_id = ?, name = ?, max_quantity = ? WHERE id = ? AND church_id = ?',
            [group_id, name.trim(), max_quantity || null, id, churchId]);
        if (!info.affectedRows) return res.status(404).json({ error: 'Função não encontrada' });
        res.json({ ok: true });
    } catch (err) {
        console.error('updateFuncao:', err);
        res.status(500).json({ error: 'Erro interno' });
    }
};

exports.deleteFuncao = async (req, res) => {
    const churchId = req.auth.igrejaId;
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM escalas_funcoes WHERE id = ? AND church_id = ?', [id, churchId]);
        res.json({ ok: true });
    } catch (err) {
        console.error('deleteFuncao:', err);
        res.status(500).json({ error: 'Erro interno' });
    }
};

// ───────────────────────────────────────────────
// Matriz de escalas
// ───────────────────────────────────────────────
exports.getMatriz = async (req, res) => {
    const churchId = req.auth.igrejaId;
    const today = toDateStr(new Date());
    const from = req.query.from || today;
    const to   = req.query.to   || toDateStr(addDays(new Date(), 60));
    const eventId = req.query.eventId ? parseInt(req.query.eventId, 10) : null;

    try {
        // Instâncias no período
        let instSql = `SELECT i.id AS instance_id, i.instance_date, e.title, e.id AS event_id
                       FROM escalas_instancias i
                       JOIN escalas_eventos e ON e.id = i.event_id
                       WHERE i.church_id = ? AND i.is_cancelled = 0
                         AND i.instance_date BETWEEN ? AND ?`;
        const instParams = [churchId, from, to];
        if (eventId) { instSql += ' AND e.id = ?'; instParams.push(eventId); }
        instSql += ' ORDER BY i.instance_date';

        const [instances] = await pool.query(instSql, instParams);
        instances.forEach(r => { r.instance_date = fmtDate(r.instance_date); });

        if (!instances.length) return res.json({ instances: [], functions: [], assignments: [] });

        const eventIds = [...new Set(instances.map(i => i.event_id))];

        // Funções dos eventos filtrados
        const [functions] = await pool.query(
            `SELECT DISTINCT f.id, f.name, g.name AS group_name
             FROM escalas_funcoes f
             JOIN escalas_grupos g ON g.id = f.group_id
             JOIN escalas_evento_funcoes ef ON ef.function_id = f.id
             WHERE ef.event_id IN (?)
             ORDER BY g.name, f.name`, [eventIds]);

        // Atribuições para as instâncias encontradas
        const instanceIds = instances.map(i => i.instance_id);
        const [assignments] = await pool.query(
            `SELECT a.id, a.instance_id, a.function_id, a.member_id, m.nome AS full_name
             FROM escalas_atribuicoes a
             JOIN membros m ON m.id = a.member_id
             WHERE a.instance_id IN (?)`, [instanceIds]);

        res.json({ instances, functions, assignments });
    } catch (err) {
        console.error('getMatriz:', err);
        res.status(500).json({ error: 'Erro interno' });
    }
};

// ───────────────────────────────────────────────
// Atribuições
// ───────────────────────────────────────────────
exports.createAtribuicao = async (req, res) => {
    const churchId = req.auth.igrejaId;
    const { instance_id, function_id, member_id } = req.body;
    if (!instance_id || !function_id || !member_id)
        return res.status(400).json({ error: 'instance_id, function_id e member_id são obrigatórios' });
    try {
        // Verifica se a instância pertence à igreja
        const [[inst]] = await pool.query(
            'SELECT id FROM escalas_instancias WHERE id = ? AND church_id = ?',
            [instance_id, churchId]);
        if (!inst) return res.status(404).json({ error: 'Instância não encontrada' });

        const [{ insertId }] = await pool.query(
            'INSERT INTO escalas_atribuicoes (instance_id, function_id, member_id, church_id) VALUES (?, ?, ?, ?)',
            [instance_id, function_id, member_id, churchId]);
        res.status(201).json({ id: insertId });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY')
            return res.status(409).json({ error: 'Membro já atribuído a esta função nesta data' });
        console.error('createAtribuicao:', err);
        res.status(500).json({ error: 'Erro interno' });
    }
};

exports.deleteAtribuicao = async (req, res) => {
    const churchId = req.auth.igrejaId;
    const { id } = req.params;
    try {
        await pool.query(
            'DELETE FROM escalas_atribuicoes WHERE id = ? AND church_id = ?', [id, churchId]);
        res.json({ ok: true });
    } catch (err) {
        console.error('deleteAtribuicao:', err);
        res.status(500).json({ error: 'Erro interno' });
    }
};

// ───────────────────────────────────────────────
// Conflitos
// ───────────────────────────────────────────────
exports.listConflitos = async (req, res) => {
    const churchId = req.auth.igrejaId;
    try {
        const [rows] = await pool.query(
            `SELECT m.nome AS full_name, i.instance_date, COUNT(DISTINCT a.instance_id) AS events_same_day
             FROM escalas_atribuicoes a
             JOIN escalas_instancias i ON i.id = a.instance_id
             JOIN membros m ON m.id = a.member_id
             WHERE a.church_id = ?
             GROUP BY a.member_id, i.instance_date
             HAVING events_same_day > 1
             ORDER BY i.instance_date DESC
             LIMIT 50`, [churchId]);
        rows.forEach(r => { r.instance_date = fmtDate(r.instance_date); });
        res.json(rows);
    } catch (err) {
        console.error('listConflitos:', err);
        res.status(500).json({ error: 'Erro interno' });
    }
};

// ───────────────────────────────────────────────
// Membros (lista simples para modal de atribuição)
// ───────────────────────────────────────────────
exports.listMembros = async (req, res) => {
    const churchId = req.auth.igrejaId;
    try {
        const [rows] = await pool.query(
            `SELECT id, nome AS full_name
             FROM membros
             WHERE igreja_id = ? AND (situacao IS NULL OR situacao = 'Ativo')
             ORDER BY nome
             LIMIT 500`, [churchId]);
        res.json(rows);
    } catch (err) {
        console.error('listMembros escalas:', err);
        res.status(500).json({ error: 'Erro interno' });
    }
};
