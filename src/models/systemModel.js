const { pool } = require('../config/db');
const { ensureTable } = require('./tableEnsure');

let systemTablesReadyPromise = null;

async function ensureMembrosPermissionColumns() {
    const statements = [
        'ALTER TABLE membros ADD COLUMN cargo VARCHAR(255)',
        'ALTER TABLE membros ADD COLUMN foto_url TEXT',
        'ALTER TABLE membros ADD COLUMN acesso_app_midia INTEGER NOT NULL DEFAULT 0',
        'ALTER TABLE membros ADD COLUMN gerenciar_midias INTEGER NOT NULL DEFAULT 0'
    ];

    for (const sql of statements) {
        try {
            await pool.query(sql);
        } catch (_error) {
            // Coluna já existe ou dialeto não suporta exatamente o mesmo ALTER.
        }
    }
}

async function ensureSystemTables() {
    if (!systemTablesReadyPromise) {
        systemTablesReadyPromise = (async () => {
            await ensureTable('visitantes', [
                `CREATE TABLE IF NOT EXISTS visitantes (
                    id BIGSERIAL PRIMARY KEY,
                    igreja_id INTEGER NOT NULL DEFAULT 1,
                    full_name VARCHAR(255) NOT NULL,
                    phone VARCHAR(60),
                    visit_date DATE,
                    observation TEXT,
                    birth_date DATE,
                    gender VARCHAR(30),
                    civil_status VARCHAR(50),
                    address VARCHAR(255),
                    number VARCHAR(30),
                    neighborhood VARCHAR(120),
                    city VARCHAR(120),
                    state VARCHAR(60),
                    zip_code VARCHAR(30),
                    mobile_phone VARCHAR(60),
                    email VARCHAR(255),
                    congregation VARCHAR(255),
                    accepted_jesus_at DATE,
                    return_at DATE,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )`,
                `CREATE TABLE IF NOT EXISTS visitantes (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    igreja_id INT NOT NULL DEFAULT 1,
                    full_name VARCHAR(255) NOT NULL,
                    phone VARCHAR(60),
                    visit_date DATE,
                    observation TEXT,
                    birth_date DATE,
                    gender VARCHAR(30),
                    civil_status VARCHAR(50),
                    address VARCHAR(255),
                    number VARCHAR(30),
                    neighborhood VARCHAR(120),
                    city VARCHAR(120),
                    state VARCHAR(60),
                    zip_code VARCHAR(30),
                    mobile_phone VARCHAR(60),
                    email VARCHAR(255),
                    congregation VARCHAR(255),
                    accepted_jesus_at DATE,
                    return_at DATE,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )`,
                `CREATE TABLE IF NOT EXISTS visitantes (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    igreja_id INTEGER NOT NULL DEFAULT 1,
                    full_name TEXT NOT NULL,
                    phone TEXT,
                    visit_date TEXT,
                    observation TEXT,
                    birth_date TEXT,
                    gender TEXT,
                    civil_status TEXT,
                    address TEXT,
                    number TEXT,
                    neighborhood TEXT,
                    city TEXT,
                    state TEXT,
                    zip_code TEXT,
                    mobile_phone TEXT,
                    email TEXT,
                    congregation TEXT,
                    accepted_jesus_at TEXT,
                    return_at TEXT,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP
                )`
            ], [
                'CREATE INDEX IF NOT EXISTS idx_visitantes_igreja ON visitantes (igreja_id)'
            ]);

            await ensureTable('congregados', [
                `CREATE TABLE IF NOT EXISTS congregados (
                    id BIGSERIAL PRIMARY KEY,
                    igreja_id INTEGER NOT NULL DEFAULT 1,
                    nome VARCHAR(255) NOT NULL,
                    nascimento DATE,
                    sexo VARCHAR(30),
                    estado_civil VARCHAR(50),
                    cpf VARCHAR(30),
                    cep VARCHAR(30),
                    endereco VARCHAR(255),
                    numero VARCHAR(30),
                    bairro VARCHAR(120),
                    cidade VARCHAR(120),
                    estado VARCHAR(60),
                    telefone VARCHAR(60),
                    celular VARCHAR(60),
                    email VARCHAR(255),
                    data_cadastro DATE,
                    obs TEXT,
                    foto_url TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )`,
                `CREATE TABLE IF NOT EXISTS congregados (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    igreja_id INT NOT NULL DEFAULT 1,
                    nome VARCHAR(255) NOT NULL,
                    nascimento DATE,
                    sexo VARCHAR(30),
                    estado_civil VARCHAR(50),
                    cpf VARCHAR(30),
                    cep VARCHAR(30),
                    endereco VARCHAR(255),
                    numero VARCHAR(30),
                    bairro VARCHAR(120),
                    cidade VARCHAR(120),
                    estado VARCHAR(60),
                    telefone VARCHAR(60),
                    celular VARCHAR(60),
                    email VARCHAR(255),
                    data_cadastro DATE,
                    obs TEXT,
                    foto_url TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )`,
                `CREATE TABLE IF NOT EXISTS congregados (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    igreja_id INTEGER NOT NULL DEFAULT 1,
                    nome TEXT NOT NULL,
                    nascimento TEXT,
                    sexo TEXT,
                    estado_civil TEXT,
                    cpf TEXT,
                    cep TEXT,
                    endereco TEXT,
                    numero TEXT,
                    bairro TEXT,
                    cidade TEXT,
                    estado TEXT,
                    telefone TEXT,
                    celular TEXT,
                    email TEXT,
                    data_cadastro TEXT,
                    obs TEXT,
                    foto_url TEXT,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP
                )`
            ], [
                'CREATE INDEX IF NOT EXISTS idx_congregados_igreja ON congregados (igreja_id)'
            ]);

            await ensureTable('criancas', [
                `CREATE TABLE IF NOT EXISTS criancas (
                    id BIGSERIAL PRIMARY KEY,
                    igreja_id INTEGER NOT NULL DEFAULT 1,
                    nome VARCHAR(255) NOT NULL,
                    nascimento DATE,
                    apresentacao DATE,
                    sexo VARCHAR(30),
                    situacao VARCHAR(30),
                    pai VARCHAR(255),
                    mae VARCHAR(255),
                    nome_pai VARCHAR(255),
                    nome_mae VARCHAR(255),
                    cep VARCHAR(30),
                    endereco VARCHAR(255),
                    numero VARCHAR(30),
                    bairro VARCHAR(120),
                    complemento VARCHAR(120),
                    cidade VARCHAR(120),
                    estado VARCHAR(60),
                    telefone VARCHAR(60),
                    celular VARCHAR(60),
                    email VARCHAR(255),
                    foto_url TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )`,
                `CREATE TABLE IF NOT EXISTS criancas (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    igreja_id INT NOT NULL DEFAULT 1,
                    nome VARCHAR(255) NOT NULL,
                    nascimento DATE,
                    apresentacao DATE,
                    sexo VARCHAR(30),
                    situacao VARCHAR(30),
                    pai VARCHAR(255),
                    mae VARCHAR(255),
                    nome_pai VARCHAR(255),
                    nome_mae VARCHAR(255),
                    cep VARCHAR(30),
                    endereco VARCHAR(255),
                    numero VARCHAR(30),
                    bairro VARCHAR(120),
                    complemento VARCHAR(120),
                    cidade VARCHAR(120),
                    estado VARCHAR(60),
                    telefone VARCHAR(60),
                    celular VARCHAR(60),
                    email VARCHAR(255),
                    foto_url TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )`,
                `CREATE TABLE IF NOT EXISTS criancas (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    igreja_id INTEGER NOT NULL DEFAULT 1,
                    nome TEXT NOT NULL,
                    nascimento TEXT,
                    apresentacao TEXT,
                    sexo TEXT,
                    situacao TEXT,
                    pai TEXT,
                    mae TEXT,
                    nome_pai TEXT,
                    nome_mae TEXT,
                    cep TEXT,
                    endereco TEXT,
                    numero TEXT,
                    bairro TEXT,
                    complemento TEXT,
                    cidade TEXT,
                    estado TEXT,
                    telefone TEXT,
                    celular TEXT,
                    email TEXT,
                    foto_url TEXT,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP
                )`
            ], [
                'CREATE INDEX IF NOT EXISTS idx_criancas_igreja ON criancas (igreja_id)'
            ]);

            await ensureTable('oracoes_pedidos', [
                `CREATE TABLE IF NOT EXISTS oracoes_pedidos (
                    id BIGSERIAL PRIMARY KEY,
                    igreja_id INTEGER NOT NULL DEFAULT 1,
                    user_id INTEGER,
                    user_name VARCHAR(255),
                    pedido TEXT NOT NULL,
                    is_private SMALLINT NOT NULL DEFAULT 0,
                    status VARCHAR(30) NOT NULL DEFAULT 'pendente',
                    resposta TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )`,
                `CREATE TABLE IF NOT EXISTS oracoes_pedidos (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    igreja_id INT NOT NULL DEFAULT 1,
                    user_id INT,
                    user_name VARCHAR(255),
                    pedido TEXT NOT NULL,
                    is_private TINYINT(1) NOT NULL DEFAULT 0,
                    status VARCHAR(30) NOT NULL DEFAULT 'pendente',
                    resposta TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )`,
                `CREATE TABLE IF NOT EXISTS oracoes_pedidos (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    igreja_id INTEGER NOT NULL DEFAULT 1,
                    user_id INTEGER,
                    user_name TEXT,
                    pedido TEXT NOT NULL,
                    is_private INTEGER NOT NULL DEFAULT 0,
                    status TEXT NOT NULL DEFAULT 'pendente',
                    resposta TEXT,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
                )`
            ], [
                'CREATE INDEX IF NOT EXISTS idx_oracoes_pedidos_igreja ON oracoes_pedidos (igreja_id)'
            ]);
        })();
    }

    await systemTablesReadyPromise;
    await ensureMembrosPermissionColumns();
}

async function listMembros(filters) {
    await ensureSystemTables();

    const where = ['igreja_id = ?'];
    const values = [filters.igrejaId];

    if (filters.nome) {
        where.push('nome LIKE ?');
        values.push(`%${filters.nome}%`);
    }

    if (filters.email) {
        where.push('email LIKE ?');
        values.push(`%${filters.email}%`);
    }

    if (filters.telefone) {
        where.push('(telefone LIKE ? OR celular LIKE ?)');
        values.push(`%${filters.telefone}%`, `%${filters.telefone}%`);
    }

    if (filters.cidade) {
        where.push('cidade LIKE ?');
        values.push(`%${filters.cidade}%`);
    }

    const [rows] = await pool.query(
        `SELECT
            id,
            nome,
            nome AS full_name,
            email,
            telefone,
            telefone AS phone,
            cargo,
            foto_url,
            celular AS mobile_phone,
            cidade,
            cidade AS city,
            acesso_app_midia,
            gerenciar_midias,
            created_at
         FROM membros
         WHERE ${where.join(' AND ')}
         ORDER BY id DESC`,
        values
    );

    return rows;
}

async function listMembrosWithFilters(filters) {
    await ensureSystemTables();

    const where = ['igreja_id = ?'];
    const values = [filters.igrejaId];

    if (filters.nome) {
        where.push('nome LIKE ?');
        values.push(`%${filters.nome}%`);
    }

    if (filters.email) {
        where.push('email LIKE ?');
        values.push(`%${filters.email}%`);
    }

    if (filters.telefone) {
        where.push('(telefone LIKE ? OR celular LIKE ?)');
        values.push(`%${filters.telefone}%`, `%${filters.telefone}%`);
    }

    if (filters.cidade) {
        where.push('cidade LIKE ?');
        values.push(`%${filters.cidade}%`);
    }

    const sortByMap = {
        id: 'id',
        created_at: 'created_at',
        nome: 'nome',
        email: 'email',
        cidade: 'cidade'
    };

    const sortBy = sortByMap[filters.sortBy] || 'id';
    const sortOrder = String(filters.sortOrder || 'DESC').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const [countRows] = await pool.query(
        `SELECT COUNT(*) AS total
         FROM membros
         WHERE ${where.join(' AND ')}`,
        values
    );

    const total = Number(countRows[0]?.total || 0);
    const limit = Number(filters.limit || 50);
    const page = Number(filters.page || 1);
    const offset = (page - 1) * limit;

    const [rows] = await pool.query(
        `SELECT
            id,
            nome,
            nome AS full_name,
            email,
            telefone,
            telefone AS phone,
            cargo,
            foto_url,
            celular AS mobile_phone,
            cidade,
            cidade AS city,
            acesso_app_midia,
            gerenciar_midias,
            created_at
         FROM membros
         WHERE ${where.join(' AND ')}
         ORDER BY ${sortBy} ${sortOrder}
         LIMIT ? OFFSET ?`,
        [...values, limit, offset]
    );

    return {
        items: rows,
        meta: {
            page,
            limit,
            total,
            totalPages: Math.max(1, Math.ceil(total / limit))
        }
    };
}

async function createMembro(payload) {
    await ensureSystemTables();

    await pool.query(
        `INSERT INTO membros (
            igreja_id,
            nome, email, telefone, cargo, apelido, nascimento, sexo, estado_civil, profissao,
            cep, endereco, numero, bairro, cidade, estado, celular, cpf, rg, nacionalidade, naturalidade,
            foto_url, acesso_app_midia, gerenciar_midias, situacao, observacoes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            payload.igrejaId,
            payload.nome,
            payload.email,
            payload.telefone,
            payload.cargo,
            payload.apelido,
            payload.nascimento,
            payload.sexo,
            payload.estadoCivil,
            payload.profissao,
            payload.cep,
            payload.endereco,
            payload.numero,
            payload.bairro,
            payload.cidade,
            payload.estado,
            payload.celular,
            String(payload.cpf || '').replace(/\D/g, '') || null,
            payload.rg,
            payload.nacionalidade,
            payload.naturalidade,
            payload.fotoUrl,
            payload.acesso_app_midia ? 1 : 0,
            payload.gerenciar_midias ? 1 : 0,
            payload.situacao,
            payload.observacoes
        ]
    );
}

async function updateMembro(id, payload) {
    await ensureSystemTables();
    await pool.query(
        `UPDATE membros SET
            nome = ?, email = ?, telefone = ?, cargo = ?, apelido = ?, nascimento = ?, sexo = ?, estado_civil = ?, profissao = ?,
            cep = ?, endereco = ?, numero = ?, bairro = ?, cidade = ?, estado = ?, celular = ?, cpf = ?, rg = ?, nacionalidade = ?, naturalidade = ?,
            foto_url = ?, acesso_app_midia = ?, gerenciar_midias = ?, situacao = ?, observacoes = ?
         WHERE id = ? AND igreja_id = ?`,
        [
            payload.nome, payload.email, payload.telefone, payload.cargo, payload.apelido, payload.nascimento, payload.sexo, payload.estadoCivil, payload.profissao,
            payload.cep, payload.endereco, payload.numero, payload.bairro, payload.cidade, payload.estado, payload.celular, String(payload.cpf || '').replace(/\D/g, '') || null, payload.rg, payload.nacionalidade, payload.naturalidade,
            payload.fotoUrl, payload.acesso_app_midia ? 1 : 0, payload.gerenciar_midias ? 1 : 0, payload.situacao, payload.observacoes,
            id, payload.igrejaId
        ]
    );
}

async function deleteMembro(id, igrejaId) {
    await ensureSystemTables();
    await pool.query('DELETE FROM membros WHERE id = ? AND igreja_id = ?', [id, igrejaId]);
}

async function listVisitantes({ igrejaId, search }) {
    await ensureSystemTables();

    const where = ['igreja_id = ?'];
    const values = [igrejaId];

    if (search) {
        where.push('(full_name LIKE ? OR phone LIKE ? OR city LIKE ? OR congregation LIKE ?)');
        values.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }

    const [rows] = await pool.query(
        `SELECT
            id,
            full_name,
            phone,
            visit_date,
            observation,
            birth_date,
            gender,
            civil_status,
            address,
            number,
            neighborhood,
            city,
            state,
            zip_code,
            mobile_phone,
            email,
            congregation,
            accepted_jesus_at,
            return_at,
            created_at
         FROM visitantes
         WHERE ${where.join(' AND ')}
         ORDER BY visit_date DESC, id DESC`,
        values
    );

    return rows;
}

async function createVisitante(payload) {
    await ensureSystemTables();

    await pool.query(
        `INSERT INTO visitantes (
            full_name, phone, visit_date, observation, igreja_id,
            birth_date, gender, civil_status, address, number, neighborhood, city, state,
            zip_code, mobile_phone, email, congregation, accepted_jesus_at, return_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            payload.nome,
            payload.telefone,
            payload.data,
            payload.observacao,
            payload.igrejaId,
            payload.nascimento,
            payload.sexo,
            payload.estadoCivil,
            payload.endereco,
            payload.numero,
            payload.bairro,
            payload.cidade,
            payload.estado,
            payload.cep,
            payload.celular,
            payload.email,
            payload.congregacao,
            payload.aceitouJesusEm,
            payload.retornoEm
        ]
    );
}

async function updateVisitante(payload) {
    await ensureSystemTables();

    const [result] = await pool.query(
        `UPDATE visitantes
         SET full_name = ?, phone = ?, visit_date = ?, observation = ?,
             birth_date = ?, gender = ?, civil_status = ?, address = ?, number = ?, neighborhood = ?,
             city = ?, state = ?, zip_code = ?, mobile_phone = ?, email = ?, congregation = ?,
             accepted_jesus_at = ?, return_at = ?
         WHERE id = ? AND igreja_id = ?`,
        [
            payload.nome,
            payload.telefone,
            payload.data,
            payload.observacao,
            payload.nascimento,
            payload.sexo,
            payload.estadoCivil,
            payload.endereco,
            payload.numero,
            payload.bairro,
            payload.cidade,
            payload.estado,
            payload.cep,
            payload.celular,
            payload.email,
            payload.congregacao,
            payload.aceitouJesusEm,
            payload.retornoEm,
            payload.id,
            payload.igrejaId
        ]
    );

    return result.affectedRows;
}

async function deleteVisitante({ id, igrejaId }) {
    await ensureSystemTables();

    const [result] = await pool.query('DELETE FROM visitantes WHERE id = ? AND igreja_id = ?', [id, igrejaId]);
    return result.affectedRows;
}

async function listCongregados({ igrejaId, search }) {
    await ensureSystemTables();

    const where = ['igreja_id = ?'];
    const values = [igrejaId];

    if (search) {
        where.push('(nome LIKE ? OR telefone LIKE ? OR celular LIKE ? OR cidade LIKE ?)');
        values.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }

    const [rows] = await pool.query(
        `SELECT
            id,
            nome,
            nascimento,
            sexo,
            estado_civil,
            cpf,
            cep,
            endereco,
            numero,
            bairro,
            cidade,
            estado,
            telefone,
            celular,
            email,
            data_cadastro,
            obs,
            foto_url,
            created_at
         FROM congregados
         WHERE ${where.join(' AND ')}
         ORDER BY nome ASC`,
        values
    );

    return rows;
}

async function createCongregado(payload) {
    await ensureSystemTables();

    await pool.query(
        `INSERT INTO congregados (
            igreja_id, nome, nascimento, sexo, estado_civil, cpf, cep, endereco, numero,
            bairro, cidade, estado, telefone, celular, email, data_cadastro, obs, foto_url
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            payload.igrejaId,
            payload.nome,
            payload.nascimento,
            payload.sexo,
            payload.estadoCivil,
            payload.cpf,
            payload.cep,
            payload.endereco,
            payload.numero,
            payload.bairro,
            payload.cidade,
            payload.estado,
            payload.telefone,
            payload.celular,
            payload.email,
            payload.dataCadastro,
            payload.obs,
            payload.fotoUrl
        ]
    );
}

async function updateCongregado(payload) {
    await ensureSystemTables();

    const [result] = await pool.query(
        `UPDATE congregados
         SET nome = ?, nascimento = ?, sexo = ?, estado_civil = ?, cpf = ?, cep = ?, endereco = ?, numero = ?,
             bairro = ?, cidade = ?, estado = ?, telefone = ?, celular = ?, email = ?, data_cadastro = ?,
             obs = ?, foto_url = ?
         WHERE id = ? AND igreja_id = ?`,
        [
            payload.nome,
            payload.nascimento,
            payload.sexo,
            payload.estadoCivil,
            payload.cpf,
            payload.cep,
            payload.endereco,
            payload.numero,
            payload.bairro,
            payload.cidade,
            payload.estado,
            payload.telefone,
            payload.celular,
            payload.email,
            payload.dataCadastro,
            payload.obs,
            payload.fotoUrl,
            payload.id,
            payload.igrejaId
        ]
    );

    return result.affectedRows;
}

async function deleteCongregado({ id, igrejaId }) {
    await ensureSystemTables();

    const [result] = await pool.query('DELETE FROM congregados WHERE id = ? AND igreja_id = ?', [id, igrejaId]);
    return result.affectedRows;
}

async function listCriancas({ igrejaId, search }) {
    await ensureSystemTables();

    const where = ['igreja_id = ?'];
    const values = [igrejaId];

    if (search) {
        where.push('(nome LIKE ? OR pai LIKE ? OR mae LIKE ? OR telefone LIKE ? OR cidade LIKE ?)');
        values.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }

    const [rows] = await pool.query(
        `SELECT
            id,
            nome,
            nascimento,
            apresentacao,
            sexo,
            situacao,
            pai,
            mae,
            nome_pai,
            nome_mae,
            cep,
            endereco,
            numero,
            bairro,
            complemento,
            cidade,
            estado,
            telefone,
            celular,
            email,
            foto_url,
            created_at
         FROM criancas
         WHERE ${where.join(' AND ')}
         ORDER BY nome ASC`,
        values
    );

    return rows;
}

async function createCrianca(payload) {
    await ensureSystemTables();

    await pool.query(
        `INSERT INTO criancas (
            igreja_id, nome, nascimento, apresentacao, sexo, situacao, pai, mae, nome_pai, nome_mae,
            cep, endereco, numero, bairro, complemento, cidade, estado, telefone, celular, email, foto_url
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            payload.igrejaId,
            payload.nome,
            payload.nascimento,
            payload.apresentacao,
            payload.sexo,
            payload.situacao,
            payload.pai,
            payload.mae,
            payload.nomePai,
            payload.nomeMae,
            payload.cep,
            payload.endereco,
            payload.numero,
            payload.bairro,
            payload.complemento,
            payload.cidade,
            payload.estado,
            payload.telefone,
            payload.celular,
            payload.email,
            payload.fotoUrl
        ]
    );
}

async function updateCrianca(payload) {
    await ensureSystemTables();

    const [result] = await pool.query(
        `UPDATE criancas
         SET nome = ?, nascimento = ?, apresentacao = ?, sexo = ?, situacao = ?, pai = ?, mae = ?, nome_pai = ?,
             nome_mae = ?, cep = ?, endereco = ?, numero = ?, bairro = ?, complemento = ?, cidade = ?, estado = ?,
             telefone = ?, celular = ?, email = ?, foto_url = ?
         WHERE id = ? AND igreja_id = ?`,
        [
            payload.nome,
            payload.nascimento,
            payload.apresentacao,
            payload.sexo,
            payload.situacao,
            payload.pai,
            payload.mae,
            payload.nomePai,
            payload.nomeMae,
            payload.cep,
            payload.endereco,
            payload.numero,
            payload.bairro,
            payload.complemento,
            payload.cidade,
            payload.estado,
            payload.telefone,
            payload.celular,
            payload.email,
            payload.fotoUrl,
            payload.id,
            payload.igrejaId
        ]
    );

    return result.affectedRows;
}

async function deleteCrianca({ id, igrejaId }) {
    await ensureSystemTables();

    const [result] = await pool.query('DELETE FROM criancas WHERE id = ? AND igreja_id = ?', [id, igrejaId]);
    return result.affectedRows;
}

async function listOracoesMy({ igrejaId, userId, status }) {
    await ensureSystemTables();

    const where = ['igreja_id = ?', 'user_id = ?'];
    const values = [igrejaId, userId];

    if (status) {
        where.push('status = ?');
        values.push(status);
    }

    const [rows] = await pool.query(
        `SELECT id, user_id, user_name, pedido, is_private, status, resposta, created_at, updated_at
         FROM oracoes_pedidos
         WHERE ${where.join(' AND ')}
         ORDER BY id DESC`,
        values
    );

    return rows;
}

async function listOracoesMural({ igrejaId }) {
    await ensureSystemTables();

    const [rows] = await pool.query(
        `SELECT id, user_name, pedido, status, resposta, created_at, updated_at
         FROM oracoes_pedidos
         WHERE igreja_id = ? AND is_private = 0
         ORDER BY id DESC`,
        [igrejaId]
    );

    return rows;
}

async function getOracaoById({ igrejaId, id }) {
    await ensureSystemTables();

    const [rows] = await pool.query(
        `SELECT id, igreja_id, user_id, user_name, pedido, is_private, status, resposta, created_at, updated_at
         FROM oracoes_pedidos
         WHERE igreja_id = ? AND id = ?
         LIMIT 1`,
        [igrejaId, id]
    );

    return rows[0] || null;
}

async function createOracao(payload) {
    await ensureSystemTables();

    await pool.query(
        `INSERT INTO oracoes_pedidos (igreja_id, user_id, user_name, pedido, is_private, status)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [payload.igrejaId, payload.userId, payload.userName, payload.pedido, payload.isPrivate, payload.status]
    );
}

async function updateOracao(payload) {
    await ensureSystemTables();

    const [result] = await pool.query(
        `UPDATE oracoes_pedidos
         SET pedido = ?, is_private = ?, status = ?
         WHERE id = ? AND igreja_id = ?`,
        [payload.pedido, payload.isPrivate, payload.status, payload.id, payload.igrejaId]
    );

    return result.affectedRows;
}

async function updateOracaoResposta(payload) {
    await ensureSystemTables();

    const [result] = await pool.query(
        `UPDATE oracoes_pedidos
         SET resposta = ?, status = ?
         WHERE id = ? AND igreja_id = ?`,
        [payload.resposta, payload.status, payload.id, payload.igrejaId]
    );

    return result.affectedRows;
}

async function deleteOracao({ id, igrejaId }) {
    await ensureSystemTables();

    const [result] = await pool.query('DELETE FROM oracoes_pedidos WHERE id = ? AND igreja_id = ?', [id, igrejaId]);
    return result.affectedRows;
}

async function countVisitantes(igrejaId) {
    await ensureSystemTables();

    const [[row]] = await pool.query('SELECT COUNT(*) AS total FROM visitantes WHERE igreja_id = ?', [igrejaId]);
    return row?.total || 0;
}

async function countMembros(igrejaId) {
    await ensureSystemTables();

    const [[row]] = await pool.query('SELECT COUNT(*) AS total FROM membros WHERE igreja_id = ?', [igrejaId]);
    return row?.total || 0;
}

async function pingDatabase() {
    const [[row]] = await pool.query('SELECT 1 AS ok');
    return Number(row?.ok) === 1;
}

async function getDbHealth() {
    const start = Date.now();
    try {
        const [[row]] = await pool.query('SELECT 1 AS ok, VERSION() AS version');
        return {
            ok:            Number(row?.ok) === 1,
            version:       row?.version || null,
            responseTimeMs: Date.now() - start,
        };
    } catch (err) {
        return { ok: false, version: null, responseTimeMs: Date.now() - start, error: err.message };
    }
}

module.exports = {
    countMembros,
    countVisitantes,
    createCrianca,
    createCongregado,
    createMembro,
    updateMembro,
    deleteMembro,
    createOracao,
    createVisitante,
    deleteCrianca,
    deleteCongregado,
    deleteOracao,
    deleteVisitante,
    getOracaoById,
    listOracoesMural,
    listOracoesMy,
    listCriancas,
    listCongregados,
    pingDatabase,
    getDbHealth,
    listMembrosWithFilters,
    listMembros,
    listVisitantes,
    updateCrianca,
    updateCongregado,
    updateOracao,
    updateOracaoResposta,
    updateVisitante
};