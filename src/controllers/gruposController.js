const pool = require('../config/db');

// ───────────────────────────────────────────────
// Helper
// ───────────────────────────────────────────────
function fmtDate(d) {
    if (!d) return null;
    if (d instanceof Date) return d.toISOString().slice(0, 10);
    return String(d).slice(0, 10);
}

// Mapeia row DB (snake_case) → objeto camelCase esperado pelo frontend
function rowToGroup(r) {
    return {
        id:            r.id,
        nome:          r.nome,
        categoria:     r.categoria,
        situacao:      r.situacao,
        lider:         r.lider,
        colider:       r.colider,
        telefoneLider: r.telefone_lider,
        emailLider:    r.email_lider,
        diaSemana:     r.dia_semana,
        horario:       r.horario,
        local:         r.local,
        maxMembros:    r.max_membros,
        descricao:     r.descricao,
        total_membros: r.total_membros || 0,
    };
}

// ───────────────────────────────────────────────
// Grupos
// ───────────────────────────────────────────────
exports.listGrupos = async (req, res) => {
    const churchId = req.auth.igrejaId;
    const q = req.query.q || req.query.search || '';
    try {
        let sql = `SELECT g.*, COUNT(gm.id) AS total_membros
                   FROM grupos g
                   LEFT JOIN grupo_membros gm ON gm.grupo_id = g.id AND gm.igreja_id = g.igreja_id
                   WHERE g.igreja_id = ?`;
        const params = [churchId];
        if (q) { sql += ' AND g.nome LIKE ?'; params.push(`%${q}%`); }
        sql += ' GROUP BY g.id ORDER BY g.nome';
        const [rows] = await pool.query(sql, params);
        res.json(rows.map(rowToGroup));
    } catch (err) {
        console.error('listGrupos:', err);
        res.status(500).json({ error: 'Erro interno' });
    }
};

exports.getGrupo = async (req, res) => {
    const churchId = req.auth.igrejaId;
    const { id } = req.params;
    try {
        const [[row]] = await pool.query(
            'SELECT * FROM grupos WHERE id = ? AND igreja_id = ?', [id, churchId]);
        if (!row) return res.status(404).json({ error: 'Grupo não encontrado' });
        res.json(rowToGroup(row));
    } catch (err) {
        console.error('getGrupo:', err);
        res.status(500).json({ error: 'Erro interno' });
    }
};

exports.createGrupo = async (req, res) => {
    const churchId = req.auth.igrejaId;
    const { nome, categoria, situacao = 'Ativo', lider, colider, telefoneLider,
            emailLider, diaSemana, horario, local, maxMembros, descricao } = req.body;
    if (!nome) return res.status(400).json({ error: 'Nome é obrigatório' });
    try {
        const [{ insertId }] = await pool.query(
            `INSERT INTO grupos
             (igreja_id, nome, categoria, situacao, lider, colider, telefone_lider,
              email_lider, dia_semana, horario, local, max_membros, descricao)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [churchId, nome.trim(), categoria || null, situacao, lider || null, colider || null,
             telefoneLider || null, emailLider || null, diaSemana || null,
             horario || null, local || null, maxMembros || null, descricao || null]);
        res.status(201).json({ id: insertId });
    } catch (err) {
        console.error('createGrupo:', err);
        res.status(500).json({ error: 'Erro interno' });
    }
};

exports.updateGrupo = async (req, res) => {
    const churchId = req.auth.igrejaId;
    const { id } = req.params;
    const { nome, categoria, situacao = 'Ativo', lider, colider, telefoneLider,
            emailLider, diaSemana, horario, local, maxMembros, descricao } = req.body;
    if (!nome) return res.status(400).json({ error: 'Nome é obrigatório' });
    try {
        const [info] = await pool.query(
            `UPDATE grupos SET nome=?, categoria=?, situacao=?, lider=?, colider=?,
             telefone_lider=?, email_lider=?, dia_semana=?, horario=?, local=?,
             max_membros=?, descricao=?, updated_at=NOW()
             WHERE id=? AND igreja_id=?`,
            [nome.trim(), categoria || null, situacao, lider || null, colider || null,
             telefoneLider || null, emailLider || null, diaSemana || null,
             horario || null, local || null, maxMembros || null, descricao || null,
             id, churchId]);
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
        await conn.query('DELETE FROM grupo_membros WHERE grupo_id = ? AND igreja_id = ?', [id, churchId]);
        await conn.query('DELETE FROM grupo_reunioes WHERE grupo_id = ? AND igreja_id = ?', [id, churchId]);
        await conn.query('DELETE FROM grupos WHERE id = ? AND igreja_id = ?', [id, churchId]);
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
// Membros do grupo
// ───────────────────────────────────────────────
exports.listGrupoMembros = async (req, res) => {
    const churchId = req.auth.igrejaId;
    const { id: grupoId } = req.params;
    try {
        const [rows] = await pool.query(
            `SELECT id, nome, funcao, desde FROM grupo_membros
             WHERE grupo_id = ? AND igreja_id = ?
             ORDER BY nome`, [grupoId, churchId]);
        rows.forEach(r => { r.desde = fmtDate(r.desde); });
        res.json(rows);
    } catch (err) {
        console.error('listGrupoMembros:', err);
        res.status(500).json({ error: 'Erro interno' });
    }
};

exports.addGrupoMembro = async (req, res) => {
    const churchId = req.auth.igrejaId;
    const { id: grupoId } = req.params;
    const { membro_id, nome, funcao, desde } = req.body;
    if (!nome) return res.status(400).json({ error: 'Nome é obrigatório' });
    try {
        const [[grupo]] = await pool.query(
            'SELECT id FROM grupos WHERE id = ? AND igreja_id = ?', [grupoId, churchId]);
        if (!grupo) return res.status(404).json({ error: 'Grupo não encontrado' });

        if (membro_id) {
            const [[membro]] = await pool.query(
                'SELECT id FROM membros WHERE id = ? AND igreja_id = ?', [membro_id, churchId]);
            if (!membro) return res.status(404).json({ error: 'Membro não encontrado' });
        }

        const [{ insertId }] = await pool.query(
            'INSERT INTO grupo_membros (grupo_id, igreja_id, membro_id, nome, funcao, desde) VALUES (?, ?, ?, ?, ?, ?)',
            [grupoId, churchId, membro_id || null, nome.trim(), funcao || null, desde || null]);
        res.status(201).json({ id: insertId });
    } catch (err) {
        console.error('addGrupoMembro:', err);
        res.status(500).json({ error: 'Erro interno' });
    }
};

exports.deleteGrupoMembro = async (req, res) => {
    const churchId = req.auth.igrejaId;
    const { membroId } = req.params;
    try {
        await pool.query(
            'DELETE FROM grupo_membros WHERE id = ? AND igreja_id = ?', [membroId, churchId]);
        res.json({ ok: true });
    } catch (err) {
        console.error('deleteGrupoMembro:', err);
        res.status(500).json({ error: 'Erro interno' });
    }
};

// ───────────────────────────────────────────────
// Reuniões do grupo
// ───────────────────────────────────────────────
exports.listGrupoReunioes = async (req, res) => {
    const churchId = req.auth.igrejaId;
    const { id: grupoId } = req.params;
    try {
        const [rows] = await pool.query(
            `SELECT id, data, tema, presentes, obs FROM grupo_reunioes
             WHERE grupo_id = ? AND igreja_id = ?
             ORDER BY data DESC LIMIT 50`, [grupoId, churchId]);
        rows.forEach(r => { r.data = fmtDate(r.data); });
        res.json(rows);
    } catch (err) {
        console.error('listGrupoReunioes:', err);
        res.status(500).json({ error: 'Erro interno' });
    }
};

exports.createGrupoReuniao = async (req, res) => {
    const churchId = req.auth.igrejaId;
    const { id: grupoId } = req.params;
    const { data, tema, presentes = 0, obs } = req.body;
    if (!data) return res.status(400).json({ error: 'Data é obrigatória' });
    try {
        const [[grupo]] = await pool.query(
            'SELECT id FROM grupos WHERE id = ? AND igreja_id = ?', [grupoId, churchId]);
        if (!grupo) return res.status(404).json({ error: 'Grupo não encontrado' });

        const [{ insertId }] = await pool.query(
            'INSERT INTO grupo_reunioes (grupo_id, igreja_id, data, tema, presentes, obs) VALUES (?, ?, ?, ?, ?, ?)',
            [grupoId, churchId, data, tema || null, presentes, obs || null]);
        res.status(201).json({ id: insertId });
    } catch (err) {
        console.error('createGrupoReuniao:', err);
        res.status(500).json({ error: 'Erro interno' });
    }
};

// ───────────────────────────────────────────────
// Congregados
// ───────────────────────────────────────────────
exports.listCongregados = async (req, res) => {
    const churchId = req.auth.igrejaId;
    const search = req.query.search || req.query.q || '';
    try {
        let sql = 'SELECT * FROM congregados WHERE igreja_id = ?';
        const params = [churchId];
        if (search) {
            sql += ' AND (nome LIKE ? OR cpf LIKE ? OR email LIKE ? OR telefone LIKE ? OR celular LIKE ?)';
            const like = `%${search}%`;
            params.push(like, like, like, like, like);
        }
        sql += ' ORDER BY nome LIMIT 500';
        const [rows] = await pool.query(sql, params);
        rows.forEach(r => {
            r.nascimento    = fmtDate(r.nascimento);
            r.data_cadastro = fmtDate(r.data_cadastro);
        });
        res.json(rows);
    } catch (err) {
        console.error('listCongregados:', err);
        res.status(500).json({ error: 'Erro interno' });
    }
};

exports.createCongregado = async (req, res) => {
    const churchId = req.auth.igrejaId;
    const { nome, nascimento, sexo, estadoCivil, cpf, cep, endereco, numero,
            bairro, cidade, estado, telefone, celular, email, dataCadastro, obs, fotoUrl } = req.body;
    if (!nome) return res.status(400).json({ error: 'Nome é obrigatório' });
    try {
        const [{ insertId }] = await pool.query(
            `INSERT INTO congregados
             (igreja_id, nome, nascimento, sexo, estado_civil, cpf, cep, endereco,
              numero, bairro, cidade, estado, telefone, celular, email,
              data_cadastro, obs, foto_url)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [churchId, nome.trim(), nascimento || null, sexo || null, estadoCivil || null,
             cpf || null, cep || null, endereco || null, numero || null,
             bairro || null, cidade || null, estado || null, telefone || null,
             celular || null, email || null, dataCadastro || null, obs || null, fotoUrl || null]);
        res.status(201).json({ id: insertId });
    } catch (err) {
        console.error('createCongregado:', err);
        res.status(500).json({ error: 'Erro interno' });
    }
};

exports.updateCongregado = async (req, res) => {
    const churchId = req.auth.igrejaId;
    const { id } = req.params;
    const { nome, nascimento, sexo, estadoCivil, cpf, cep, endereco, numero,
            bairro, cidade, estado, telefone, celular, email, dataCadastro, obs, fotoUrl } = req.body;
    if (!nome) return res.status(400).json({ error: 'Nome é obrigatório' });
    try {
        const [info] = await pool.query(
            `UPDATE congregados SET nome=?, nascimento=?, sexo=?, estado_civil=?, cpf=?,
             cep=?, endereco=?, numero=?, bairro=?, cidade=?, estado=?, telefone=?,
             celular=?, email=?, data_cadastro=?, obs=?, foto_url=?, updated_at=NOW()
             WHERE id=? AND igreja_id=?`,
            [nome.trim(), nascimento || null, sexo || null, estadoCivil || null, cpf || null,
             cep || null, endereco || null, numero || null, bairro || null, cidade || null,
             estado || null, telefone || null, celular || null, email || null,
             dataCadastro || null, obs || null, fotoUrl || null, id, churchId]);
        if (!info.affectedRows) return res.status(404).json({ error: 'Congregado não encontrado' });
        res.json({ ok: true });
    } catch (err) {
        console.error('updateCongregado:', err);
        res.status(500).json({ error: 'Erro interno' });
    }
};

exports.deleteCongregado = async (req, res) => {
    const churchId = req.auth.igrejaId;
    const { id } = req.params;
    try {
        await pool.query(
            'DELETE FROM congregados WHERE id = ? AND igreja_id = ?', [id, churchId]);
        res.json({ ok: true });
    } catch (err) {
        console.error('deleteCongregado:', err);
        res.status(500).json({ error: 'Erro interno' });
    }
};
