const { pool } = require('../config/db');

// ─── Helpers ─────────────────────────────────────────────
function fmtDate(d) {
    if (!d) return null;
    if (d instanceof Date) return d.toISOString().slice(0, 10);
    return String(d).slice(0, 10);
}

function safeJson(v) {
    if (!v) return null;
    if (typeof v === 'object') return v;
    try { return JSON.parse(v); } catch { return null; }
}

function rowToTurma(r) {
    return {
        id:               r.id,
        nome:             r.nome,
        ano:              r.ano || '',
        estagio:          r.estagio || '',
        situacao:         r.situacao || 'Ativo',
        professor:        r.professor || '',
        segundoProfessor: r.segundo_professor || '',
        telefoneProfessor:r.telefone_professor || '',
        emailProfessor:   r.email_professor || '',
        diaSemana:        r.dia_semana || '',
        horario:          r.horario || '',
        sala:             r.sala || '',
        revistaInfo:      safeJson(r.revista_info),
        licoes:           safeJson(r.licoes) || [],
        totalAlunos:      Number(r.total_alunos) || 0,
    };
}

function rowToAluno(r) {
    return {
        id:          r.id,
        turmaId:     r.turma_id || null,
        turmaNome:   r.turma_nome || '',
        nome:        r.nome,
        matricula:   r.matricula || '',
        estagio:     r.estagio || '',
        situacao:    r.situacao || 'Ativo',
        sexo:        r.sexo || '',
        nascimento:  fmtDate(r.nascimento),
        estadoCivil: r.estado_civil || '',
        profissao:   r.profissao || '',
        responsavel: r.responsavel || '',
        telefone:    r.telefone || '',
        celular:     r.celular || '',
        email:       r.email || '',
        cep:         r.cep || '',
        endereco:    r.endereco || '',
        bairro:      r.bairro || '',
        cidade:      r.cidade || '',
        estado:      r.estado || '',
        obs:         r.obs || '',
        revistaInfo: safeJson(r.revista_info),
    };
}

function rowToApt(r) {
    return {
        id:               r.id,
        turmaId:          r.turma_id || null,
        turmaNome:        r.turma_nome || '',
        data:             fmtDate(r.data),
        licaoNumero:      r.licao_numero || '',
        licaoTitulo:      r.licao_titulo || '',
        professorPresente:r.professor_presente || '',
        visitantes:       Number(r.visitantes) || 0,
        oferta:           parseFloat(r.oferta) || 0,
        biblias:          Number(r.biblias) || 0,
        revistas:         Number(r.revistas) || 0,
        obs:              r.obs || '',
        presentes:        Number(r.presentes) || 0,
        ausentes:         Number(r.ausentes) || 0,
    };
}

// ─── Turmas ──────────────────────────────────────────────
exports.listTurmas = async (req, res) => {
    const churchId = req.auth.igrejaId;
    const q = req.query.q || '';
    try {
        let sql = `SELECT t.*, COUNT(a.id) AS total_alunos
                   FROM ebd_turmas t
                   LEFT JOIN ebd_alunos a ON a.turma_id = t.id
                   WHERE t.igreja_id = ?`;
        const params = [churchId];
        if (q) { sql += ' AND t.nome LIKE ?'; params.push(`%${q}%`); }
        sql += ' GROUP BY t.id ORDER BY t.nome';
        const [rows] = await pool.query(sql, params);
        res.json(rows.map(rowToTurma));
    } catch (err) {
        console.error('listTurmas:', err);
        res.status(500).json({ error: 'Erro interno' });
    }
};

exports.getTurma = async (req, res) => {
    const churchId = req.auth.igrejaId;
    const { id } = req.params;
    try {
        const [[row]] = await pool.query(
            `SELECT t.*, COUNT(a.id) AS total_alunos
             FROM ebd_turmas t
             LEFT JOIN ebd_alunos a ON a.turma_id = t.id
             WHERE t.id = ? AND t.igreja_id = ?
             GROUP BY t.id`,
            [id, churchId]);
        if (!row) return res.status(404).json({ error: 'Turma não encontrada' });
        res.json(rowToTurma(row));
    } catch (err) {
        console.error('getTurma:', err);
        res.status(500).json({ error: 'Erro interno' });
    }
};

exports.createTurma = async (req, res) => {
    const churchId = req.auth.igrejaId;
    const { nome, ano, estagio, situacao = 'Ativo', professor, segundoProfessor,
            telefoneProfessor, emailProfessor, diaSemana, horario, sala,
            revistaInfo, licoes } = req.body;
    if (!nome) return res.status(400).json({ error: 'Nome é obrigatório' });
    try {
        const [{ insertId }] = await pool.query(
            `INSERT INTO ebd_turmas
             (igreja_id, nome, ano, estagio, situacao, professor, segundo_professor,
              telefone_professor, email_professor, dia_semana, horario, sala,
              revista_info, licoes)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [churchId, nome.trim(), ano || null, estagio || null, situacao,
             professor || null, segundoProfessor || null, telefoneProfessor || null,
             emailProfessor || null, diaSemana || null, horario || null, sala || null,
             revistaInfo ? JSON.stringify(revistaInfo) : null,
             licoes ? JSON.stringify(licoes) : null]);
        res.status(201).json({ id: insertId });
    } catch (err) {
        console.error('createTurma:', err);
        res.status(500).json({ error: 'Erro interno' });
    }
};

exports.updateTurma = async (req, res) => {
    const churchId = req.auth.igrejaId;
    const { id } = req.params;
    const { nome, ano, estagio, situacao = 'Ativo', professor, segundoProfessor,
            telefoneProfessor, emailProfessor, diaSemana, horario, sala,
            revistaInfo, licoes } = req.body;
    if (!nome) return res.status(400).json({ error: 'Nome é obrigatório' });
    try {
        const [info] = await pool.query(
            `UPDATE ebd_turmas SET nome=?, ano=?, estagio=?, situacao=?,
             professor=?, segundo_professor=?, telefone_professor=?, email_professor=?,
             dia_semana=?, horario=?, sala=?, revista_info=?, licoes=?,
             updated_at=NOW()
             WHERE id=? AND igreja_id=?`,
            [nome.trim(), ano || null, estagio || null, situacao,
             professor || null, segundoProfessor || null, telefoneProfessor || null,
             emailProfessor || null, diaSemana || null, horario || null, sala || null,
             revistaInfo ? JSON.stringify(revistaInfo) : null,
             licoes ? JSON.stringify(licoes) : null,
             id, churchId]);
        if (!info.affectedRows) return res.status(404).json({ error: 'Turma não encontrada' });
        res.json({ ok: true });
    } catch (err) {
        console.error('updateTurma:', err);
        res.status(500).json({ error: 'Erro interno' });
    }
};

exports.deleteTurma = async (req, res) => {
    const churchId = req.auth.igrejaId;
    const { id } = req.params;
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        await conn.query(
            `DELETE ep FROM ebd_presenca ep
             JOIN ebd_apontamentos ea ON ea.id = ep.apontamento_id
             WHERE ea.turma_id = ? AND ea.igreja_id = ?`,
            [id, churchId]);
        await conn.query('DELETE FROM ebd_apontamentos WHERE turma_id = ? AND igreja_id = ?', [id, churchId]);
        await conn.query('UPDATE ebd_alunos SET turma_id = NULL WHERE turma_id = ? AND igreja_id = ?', [id, churchId]);
        const [info] = await conn.query('DELETE FROM ebd_turmas WHERE id = ? AND igreja_id = ?', [id, churchId]);
        await conn.commit();
        if (!info.affectedRows) return res.status(404).json({ error: 'Turma não encontrada' });
        res.json({ ok: true });
    } catch (err) {
        await conn.rollback();
        console.error('deleteTurma:', err);
        res.status(500).json({ error: 'Erro interno' });
    } finally {
        conn.release();
    }
};

// ─── Alunos ──────────────────────────────────────────────
exports.listAlunos = async (req, res) => {
    const churchId = req.auth.igrejaId;
    const { q = '', turma_id, situacao } = req.query;
    try {
        let sql = `SELECT a.*, t.nome AS turma_nome
                   FROM ebd_alunos a
                   LEFT JOIN ebd_turmas t ON t.id = a.turma_id
                   WHERE a.igreja_id = ?`;
        const params = [churchId];
        if (q) { sql += ' AND a.nome LIKE ?'; params.push(`%${q}%`); }
        if (turma_id) { sql += ' AND a.turma_id = ?'; params.push(turma_id); }
        if (situacao) { sql += ' AND a.situacao = ?'; params.push(situacao); }
        sql += ' ORDER BY a.nome';
        const [rows] = await pool.query(sql, params);
        res.json(rows.map(rowToAluno));
    } catch (err) {
        console.error('listAlunos:', err);
        res.status(500).json({ error: 'Erro interno' });
    }
};

exports.getAluno = async (req, res) => {
    const churchId = req.auth.igrejaId;
    const { id } = req.params;
    try {
        const [[row]] = await pool.query(
            `SELECT a.*, t.nome AS turma_nome
             FROM ebd_alunos a
             LEFT JOIN ebd_turmas t ON t.id = a.turma_id
             WHERE a.id = ? AND a.igreja_id = ?`,
            [id, churchId]);
        if (!row) return res.status(404).json({ error: 'Aluno não encontrado' });
        const aluno = rowToAluno(row);

        // Últimas presenças
        const [presRows] = await pool.query(
            `SELECT ea.data, ea.licao_numero, ea.licao_titulo, et.nome AS turma_nome,
                    p.presente
             FROM ebd_presenca p
             JOIN ebd_apontamentos ea ON ea.id = p.apontamento_id
             LEFT JOIN ebd_turmas et ON et.id = ea.turma_id
             WHERE p.aluno_id = ? AND p.igreja_id = ?
             ORDER BY ea.data DESC
             LIMIT 20`,
            [id, churchId]);
        aluno.presencas = presRows.map(p => ({
            data: fmtDate(p.data),
            licaoNumero: p.licao_numero || '',
            licaoTitulo: p.licao_titulo || '',
            turmaNome: p.turma_nome || '',
            presente: p.presente === 1,
        }));
        res.json(aluno);
    } catch (err) {
        console.error('getAluno:', err);
        res.status(500).json({ error: 'Erro interno' });
    }
};

exports.createAluno = async (req, res) => {
    const churchId = req.auth.igrejaId;
    const { nome, turmaId, matricula, estagio, situacao = 'Ativo', sexo, nascimento,
            estadoCivil, profissao, responsavel, telefone, celular, email,
            cep, endereco, bairro, cidade, estado, obs, revistaInfo } = req.body;
    if (!nome) return res.status(400).json({ error: 'Nome é obrigatório' });
    try {
        const [{ insertId }] = await pool.query(
            `INSERT INTO ebd_alunos
             (igreja_id, turma_id, nome, matricula, estagio, situacao, sexo, nascimento,
              estado_civil, profissao, responsavel, telefone, celular, email,
              cep, endereco, bairro, cidade, estado, obs, revista_info)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [churchId, turmaId || null, nome.trim(), matricula || null, estagio || null,
             situacao, sexo || null, nascimento || null, estadoCivil || null,
             profissao || null, responsavel || null, telefone || null, celular || null,
             email || null, cep || null, endereco || null, bairro || null,
             cidade || null, estado || null, obs || null,
             revistaInfo ? JSON.stringify(revistaInfo) : null]);
        res.status(201).json({ id: insertId });
    } catch (err) {
        console.error('createAluno:', err);
        res.status(500).json({ error: 'Erro interno' });
    }
};

exports.updateAluno = async (req, res) => {
    const churchId = req.auth.igrejaId;
    const { id } = req.params;
    const { nome, turmaId, matricula, estagio, situacao = 'Ativo', sexo, nascimento,
            estadoCivil, profissao, responsavel, telefone, celular, email,
            cep, endereco, bairro, cidade, estado, obs, revistaInfo } = req.body;
    if (!nome) return res.status(400).json({ error: 'Nome é obrigatório' });
    try {
        const [info] = await pool.query(
            `UPDATE ebd_alunos SET
             turma_id=?, nome=?, matricula=?, estagio=?, situacao=?, sexo=?, nascimento=?,
             estado_civil=?, profissao=?, responsavel=?, telefone=?, celular=?, email=?,
             cep=?, endereco=?, bairro=?, cidade=?, estado=?, obs=?, revista_info=?,
             updated_at=NOW()
             WHERE id=? AND igreja_id=?`,
            [turmaId || null, nome.trim(), matricula || null, estagio || null, situacao,
             sexo || null, nascimento || null, estadoCivil || null, profissao || null,
             responsavel || null, telefone || null, celular || null, email || null,
             cep || null, endereco || null, bairro || null, cidade || null,
             estado || null, obs || null,
             revistaInfo ? JSON.stringify(revistaInfo) : null,
             id, churchId]);
        if (!info.affectedRows) return res.status(404).json({ error: 'Aluno não encontrado' });
        res.json({ ok: true });
    } catch (err) {
        console.error('updateAluno:', err);
        res.status(500).json({ error: 'Erro interno' });
    }
};

exports.deleteAluno = async (req, res) => {
    const churchId = req.auth.igrejaId;
    const { id } = req.params;
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        await conn.query('DELETE FROM ebd_presenca WHERE aluno_id = ? AND igreja_id = ?', [id, churchId]);
        const [info] = await conn.query('DELETE FROM ebd_alunos WHERE id = ? AND igreja_id = ?', [id, churchId]);
        await conn.commit();
        if (!info.affectedRows) return res.status(404).json({ error: 'Aluno não encontrado' });
        res.json({ ok: true });
    } catch (err) {
        await conn.rollback();
        console.error('deleteAluno:', err);
        res.status(500).json({ error: 'Erro interno' });
    } finally {
        conn.release();
    }
};

// ─── Apontamentos ────────────────────────────────────────
exports.listApontamentos = async (req, res) => {
    const churchId = req.auth.igrejaId;
    const { q = '', turma_id } = req.query;
    try {
        let sql = `SELECT a.*,
                          t.nome AS turma_nome,
                          (SELECT COUNT(*) FROM ebd_presenca p WHERE p.apontamento_id = a.id AND p.presente = 1) AS presentes,
                          (SELECT COUNT(*) FROM ebd_presenca p WHERE p.apontamento_id = a.id AND p.presente = 0) AS ausentes
                   FROM ebd_apontamentos a
                   LEFT JOIN ebd_turmas t ON t.id = a.turma_id
                   WHERE a.igreja_id = ?`;
        const params = [churchId];
        if (q) { sql += ' AND (t.nome LIKE ? OR CAST(a.data AS CHAR) LIKE ?)'; params.push(`%${q}%`, `%${q}%`); }
        if (turma_id) { sql += ' AND a.turma_id = ?'; params.push(turma_id); }
        sql += ' ORDER BY a.data DESC, a.id DESC';
        const [rows] = await pool.query(sql, params);
        res.json(rows.map(rowToApt));
    } catch (err) {
        console.error('listApontamentos:', err);
        res.status(500).json({ error: 'Erro interno' });
    }
};

exports.getApontamento = async (req, res) => {
    const churchId = req.auth.igrejaId;
    const { id } = req.params;
    try {
        const [[row]] = await pool.query(
            `SELECT a.*, t.nome AS turma_nome,
                    0 AS presentes, 0 AS ausentes
             FROM ebd_apontamentos a
             LEFT JOIN ebd_turmas t ON t.id = a.turma_id
             WHERE a.id = ? AND a.igreja_id = ?`,
            [id, churchId]);
        if (!row) return res.status(404).json({ error: 'Apontamento não encontrado' });

        const [presRows] = await pool.query(
            `SELECT p.*, al.nome AS aluno_nome, al.estagio AS aluno_estagio
             FROM ebd_presenca p
             JOIN ebd_alunos al ON al.id = p.aluno_id
             WHERE p.apontamento_id = ?
             ORDER BY al.nome`,
            [id]);

        const apt = rowToApt(row);
        apt.alunos = presRows.map(p => ({
            id:      p.aluno_id,
            nome:    p.aluno_nome,
            estagio: p.aluno_estagio || '',
            presente:p.presente === 1,
        }));
        apt.presentes = apt.alunos.filter(a => a.presente).length;
        apt.ausentes  = apt.alunos.filter(a => !a.presente).length;
        res.json(apt);
    } catch (err) {
        console.error('getApontamento:', err);
        res.status(500).json({ error: 'Erro interno' });
    }
};

exports.createApontamento = async (req, res) => {
    const churchId = req.auth.igrejaId;
    const { turmaId, data, licaoNumero, licaoTitulo, professorPresente,
            visitantes = 0, oferta = 0, biblias = 0, revistas = 0, obs,
            alunos = [] } = req.body;
    if (!turmaId || !data) return res.status(400).json({ error: 'Turma e data são obrigatórias' });

    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        const [{ insertId }] = await conn.query(
            `INSERT INTO ebd_apontamentos
             (igreja_id, turma_id, data, licao_numero, licao_titulo, professor_presente,
              visitantes, oferta, biblias, revistas, obs)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [churchId, turmaId, data, licaoNumero || null, licaoTitulo || null,
             professorPresente || null, visitantes, oferta, biblias, revistas, obs || null]);

        for (const a of alunos) {
            if (!a.id) continue;
            await conn.query(
                `INSERT INTO ebd_presenca (igreja_id, apontamento_id, aluno_id, presente)
                 VALUES (?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE presente = VALUES(presente)`,
                [churchId, insertId, a.id, a.presente ? 1 : 0]);
        }
        await conn.commit();
        res.status(201).json({ id: insertId });
    } catch (err) {
        await conn.rollback();
        console.error('createApontamento:', err);
        res.status(500).json({ error: 'Erro interno' });
    } finally {
        conn.release();
    }
};

exports.updateApontamento = async (req, res) => {
    const churchId = req.auth.igrejaId;
    const { id } = req.params;
    const { turmaId, data, licaoNumero, licaoTitulo, professorPresente,
            visitantes = 0, oferta = 0, biblias = 0, revistas = 0, obs,
            alunos = [] } = req.body;
    if (!turmaId || !data) return res.status(400).json({ error: 'Turma e data são obrigatórias' });

    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        const [info] = await conn.query(
            `UPDATE ebd_apontamentos SET
             turma_id=?, data=?, licao_numero=?, licao_titulo=?, professor_presente=?,
             visitantes=?, oferta=?, biblias=?, revistas=?, obs=?, updated_at=NOW()
             WHERE id=? AND igreja_id=?`,
            [turmaId, data, licaoNumero || null, licaoTitulo || null,
             professorPresente || null, visitantes, oferta, biblias, revistas,
             obs || null, id, churchId]);
        if (!info.affectedRows) {
            await conn.rollback();
            return res.status(404).json({ error: 'Apontamento não encontrado' });
        }

        await conn.query('DELETE FROM ebd_presenca WHERE apontamento_id = ? AND igreja_id = ?', [id, churchId]);
        for (const a of alunos) {
            if (!a.id) continue;
            await conn.query(
                `INSERT INTO ebd_presenca (igreja_id, apontamento_id, aluno_id, presente)
                 VALUES (?, ?, ?, ?)`,
                [churchId, id, a.id, a.presente ? 1 : 0]);
        }
        await conn.commit();
        res.json({ ok: true });
    } catch (err) {
        await conn.rollback();
        console.error('updateApontamento:', err);
        res.status(500).json({ error: 'Erro interno' });
    } finally {
        conn.release();
    }
};

exports.deleteApontamento = async (req, res) => {
    const churchId = req.auth.igrejaId;
    const { id } = req.params;
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        // Verify ownership before any mutation
        const [[ap]] = await conn.query(
            'SELECT id FROM ebd_apontamentos WHERE id = ? AND igreja_id = ? LIMIT 1', [id, churchId]);
        if (!ap) {
            await conn.rollback();
            return res.status(404).json({ error: 'Apontamento não encontrado' });
        }
        await conn.query('DELETE FROM ebd_presenca WHERE apontamento_id = ? AND igreja_id = ?', [id, churchId]);
        await conn.query('DELETE FROM ebd_apontamentos WHERE id = ? AND igreja_id = ?', [id, churchId]);
        await conn.commit();
        res.json({ ok: true });
    } catch (err) {
        await conn.rollback();
        console.error('deleteApontamento:', err);
        res.status(500).json({ error: 'Erro interno' });
    } finally {
        conn.release();
    }
};
