/**
 * Sistema de Roles e Permissões por Feature
 * Define acesso granular a funcionalidades do sistema
 */

const ROLES = {
    ADMIN: 'admin',
    SECRETARIA: 'secretaria',
    PASTOR: 'pastor',
    OFICIAL: 'oficial',
    MINISTERIO: 'ministerio',
    MIDIA: 'midia',
    MEMBRO: 'membro',
    VISITANTE: 'visitante'
};

/**
 * Permissões por role - controla acesso a features
 * Estrutura: { feature: [roles com acesso] }
 */
const PERMISSIONS = {
    // Membros e Contacts
    'membros.listar': [ROLES.ADMIN, ROLES.SECRETARIA, ROLES.PASTOR, ROLES.OFICIAL, ROLES.MINISTERIO],
    'membros.editar': [ROLES.ADMIN, ROLES.SECRETARIA, ROLES.PASTOR],
    'membros.deletar': [ROLES.ADMIN, ROLES.SECRETARIA],

    // Visitantes
    'visitantes.listar': [ROLES.ADMIN, ROLES.SECRETARIA, ROLES.PASTOR, ROLES.OFICIAL],
    'visitantes.criar': [ROLES.ADMIN, ROLES.SECRETARIA, ROLES.OFICIAL], // Portaria
    'visitantes.editar': [ROLES.ADMIN, ROLES.SECRETARIA, ROLES.OFICIAL],
    'visitantes.deletar': [ROLES.ADMIN, ROLES.SECRETARIA],

    // Orações
    'oracoes.listar': [ROLES.ADMIN, ROLES.SECRETARIA, ROLES.PASTOR, ROLES.OFICIAL, ROLES.MINISTERIO, ROLES.MEMBRO],
    'oracoes.criar': [ROLES.ADMIN, ROLES.SECRETARIA, ROLES.PASTOR, ROLES.OFICIAL, ROLES.MINISTERIO, ROLES.MEMBRO, ROLES.VISITANTE],
    'oracoes.responder': [ROLES.ADMIN, ROLES.SECRETARIA, ROLES.PASTOR], // Apenas lideranças
    'oracoes.editar': [ROLES.ADMIN, ROLES.SECRETARIA],
    'oracoes.deletar': [ROLES.ADMIN, ROLES.SECRETARIA],

    // Agenda e Eventos
    'agenda.listar': [ROLES.ADMIN, ROLES.SECRETARIA, ROLES.PASTOR, ROLES.OFICIAL, ROLES.MINISTERIO, ROLES.MEMBRO],
    'agenda.criar': [ROLES.ADMIN, ROLES.SECRETARIA, ROLES.PASTOR],
    'agenda.editar': [ROLES.ADMIN, ROLES.SECRETARIA, ROLES.PASTOR],
    'agenda.deletar': [ROLES.ADMIN, ROLES.SECRETARIA],

    // Crianças/EBD
    'criancas.listar': [ROLES.ADMIN, ROLES.SECRETARIA, ROLES.PASTOR, ROLES.OFICIAL],
    'criancas.criar': [ROLES.ADMIN, ROLES.SECRETARIA, ROLES.PASTOR],
    'criancas.editar': [ROLES.ADMIN, ROLES.SECRETARIA, ROLES.PASTOR],
    'criancas.deletar': [ROLES.ADMIN, ROLES.SECRETARIA],

    // Missionários
    'missionarios.listar': [ROLES.ADMIN, ROLES.SECRETARIA, ROLES.PASTOR, ROLES.MINISTERIO],
    'missionarios.criar': [ROLES.ADMIN, ROLES.SECRETARIA, ROLES.PASTOR],
    'missionarios.editar': [ROLES.ADMIN, ROLES.SECRETARIA, ROLES.PASTOR],
    'missionarios.deletar': [ROLES.ADMIN, ROLES.SECRETARIA],

    // Outras Igrejas
    'igrejas.listar': [ROLES.ADMIN, ROLES.SECRETARIA, ROLES.PASTOR],
    'igrejas.criar': [ROLES.ADMIN, ROLES.SECRETARIA, ROLES.PASTOR],
    'igrejas.editar': [ROLES.ADMIN, ROLES.SECRETARIA, ROLES.PASTOR],
    'igrejas.deletar': [ROLES.ADMIN, ROLES.SECRETARIA],

    // Financeiro
    'financeiro.listar': [ROLES.ADMIN, ROLES.SECRETARIA],
    'financeiro.criar': [ROLES.ADMIN, ROLES.SECRETARIA],
    'financeiro.editar': [ROLES.ADMIN, ROLES.SECRETARIA],
    'financeiro.deletar': [ROLES.ADMIN],

    // Cargos
    'cargos.listar': [ROLES.ADMIN, ROLES.SECRETARIA, ROLES.PASTOR],
    'cargos.criar': [ROLES.ADMIN, ROLES.SECRETARIA, ROLES.PASTOR],
    'cargos.editar': [ROLES.ADMIN, ROLES.SECRETARIA, ROLES.PASTOR],
    'cargos.deletar': [ROLES.ADMIN],

    // Mídia
    'midia.criar': [ROLES.ADMIN, ROLES.SECRETARIA, ROLES.MIDIA],
    'midia.editar': [ROLES.ADMIN, ROLES.SECRETARIA, ROLES.MIDIA],
    'midia.deletar': [ROLES.ADMIN, ROLES.SECRETARIA],

    // Dashboard/Relatórios
    'dashboard.acesso': [ROLES.ADMIN, ROLES.SECRETARIA, ROLES.PASTOR, ROLES.OFICIAL],
    'relatorios.acesso': [ROLES.ADMIN, ROLES.SECRETARIA, ROLES.PASTOR],
};

/**
 * Features visíveis no menu por role
 */
const MENU_FEATURES = {
    [ROLES.ADMIN]: [
        'dashboard', 'membros', 'visitantes', 'criancas', 'oracoes', 'agenda',
        'missionarios', 'igrejas', 'financeiro', 'cargos', 'midia', 'configuracoes',
        'whatsapp', 'autocadastro', 'portaria_qr', 'pagamentos', 'app_midia', 'telao'
    ],
    [ROLES.SECRETARIA]: [
        'dashboard', 'membros', 'visitantes', 'criancas', 'oracoes', 'agenda',
        'missionarios', 'igrejas', 'financeiro', 'cargos', 'midia',
        'whatsapp', 'autocadastro', 'portaria_qr', 'pagamentos', 'app_midia', 'telao'
    ],
    [ROLES.PASTOR]: [
        'dashboard', 'membros', 'visitantes', 'criancas', 'oracoes', 'agenda',
        'missionarios', 'igrejas', 'cargos', 'whatsapp', 'autocadastro', 'app_midia', 'telao'
    ],
    [ROLES.OFICIAL]: [
        'membros', 'visitantes', 'agenda', 'oracoes', 'portaria_qr'
    ],
    [ROLES.MINISTERIO]: [
        'membros', 'oracoes', 'agenda', 'criancas'
    ],
    [ROLES.MIDIA]: [
        'agenda', 'membros', 'midia', 'app_midia', 'telao'
    ],
    [ROLES.MEMBRO]: [
        'oracoes', 'agenda'
    ],
    [ROLES.VISITANTE]: [
        'oracoes', 'agenda'
    ]
};

/**
 * Descrição dos roles para UI
 */
const ROLE_DESCRIPTIONS = {
    [ROLES.ADMIN]: { label: 'Administrador', color: '#dc2626', icon: 'fa-crown' },
    [ROLES.SECRETARIA]: { label: 'Secretaria', color: '#2563eb', icon: 'fa-briefcase' },
    [ROLES.PASTOR]: { label: 'Pastor', color: '#7c3aed', icon: 'fa-person-chalkboard' },
    [ROLES.OFICIAL]: { label: 'Oficial', color: '#0891b2', icon: 'fa-shield' },
    [ROLES.MINISTERIO]: { label: 'Integrante de Ministério', color: '#059669', icon: 'fa-handshake' },
    [ROLES.MIDIA]: { label: 'Mídia', color: '#ea580c', icon: 'fa-camera' },
    [ROLES.MEMBRO]: { label: 'Membro', color: '#4f46e5', icon: 'fa-person' },
    [ROLES.VISITANTE]: { label: 'Visitante', color: '#6b7280', icon: 'fa-person-walking' }
};

/**
 * Verifica se um role tem permissão para uma feature
 * @param {string} role - Role do usuário
 * @param {string} feature - Feature a verificar
 * @returns {boolean}
 */
function hasPermission(role, feature) {
    const allowedRoles = PERMISSIONS[feature] || [];
    return allowedRoles.includes(role);
}

/**
 * Obtém features visíveis para um role
 * @param {string} role - Role do usuário
 * @returns {string[]}
 */
function getVisibleFeatures(role) {
    return MENU_FEATURES[role] || [];
}

/**
 * Obtém dados de descrição do role
 * @param {string} role - Role
 * @returns {object}
 */
function getRoleInfo(role) {
    return ROLE_DESCRIPTIONS[role] || ROLE_DESCRIPTIONS[ROLES.VISITANTE];
}

module.exports = {
    ROLES,
    PERMISSIONS,
    MENU_FEATURES,
    ROLE_DESCRIPTIONS,
    hasPermission,
    getVisibleFeatures,
    getRoleInfo
};
