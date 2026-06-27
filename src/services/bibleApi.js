'use strict';

const https = require('https');

const BASE = 'api.scripture.api.bible';

// Mapeamento: nome PT (igual ao dropdown do frontend) → OSIS usado pela API.Bible
const OSIS = {
    'Gênesis':'GEN','Êxodo':'EXO','Levítico':'LEV','Números':'NUM','Deuteronômio':'DEU',
    'Josué':'JOS','Juízes':'JDG','Rute':'RUT','1 Samuel':'1SA','2 Samuel':'2SA',
    '1 Reis':'1KI','2 Reis':'2KI','1 Crônicas':'1CH','2 Crônicas':'2CH','Esdras':'EZR',
    'Neemias':'NEH','Ester':'EST','Jó':'JOB','Salmos':'PSA','Provérbios':'PRO',
    'Eclesiastes':'ECC','Cânticos':'SNG','Isaías':'ISA','Jeremias':'JER','Lamentações':'LAM',
    'Ezequiel':'EZK','Daniel':'DAN','Oseias':'HOS','Joel':'JOL','Amós':'AMO',
    'Obadias':'OBA','Jonas':'JON','Miqueias':'MIC','Naum':'NAM','Habacuque':'HAB',
    'Sofonias':'ZEP','Ageu':'HAG','Zacarias':'ZEC','Malaquias':'MAL',
    'Mateus':'MAT','Marcos':'MRK','Lucas':'LUK','João':'JHN','Atos':'ACT',
    'Romanos':'ROM','1 Coríntios':'1CO','2 Coríntios':'2CO','Gálatas':'GAL',
    'Efésios':'EPH','Filipenses':'PHP','Colossenses':'COL','1 Tessalonicenses':'1TH',
    '2 Tessalonicenses':'2TH','1 Timóteo':'1TI','2 Timóteo':'2TI','Tito':'TIT',
    'Filemom':'PHM','Hebreus':'HEB','Tiago':'JAS','1 Pedro':'1PE','2 Pedro':'2PE',
    '1 João':'1JN','2 João':'2JN','3 João':'3JN','Judas':'JUD','Apocalipse':'REV',
};

function get(path) {
    const key = process.env.BIBLE_API_KEY;
    if (!key) return Promise.reject(new Error('BIBLE_API_KEY não configurada no .env'));

    return new Promise((resolve, reject) => {
        const options = {
            hostname: BASE,
            path: `/v1/${path}`,
            method: 'GET',
            headers: { 'api-key': key },
        };
        const req = https.request(options, res => {
            let raw = '';
            res.on('data', c => raw += c);
            res.on('end', () => {
                try { resolve(JSON.parse(raw)); }
                catch (e) { reject(new Error('Resposta inválida da API.Bible')); }
            });
        });
        req.on('error', reject);
        req.end();
    });
}

// Remove marcações HTML básicas e caracteres de formatação da API.Bible
function stripMarkup(text) {
    return (text || '')
        .replace(/<[^>]+>/g, '')
        .replace(/[¶§]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

// Converte o texto do capítulo (com números de versículo) em [{versiculo, texto}]
function parseVerses(content) {
    const text = stripMarkup(content);

    // Formato "[1] texto [2] texto"
    if (/\[\d+\]/.test(text)) {
        const parts = text.split(/\[(\d+)\]\s*/);
        const verses = [];
        for (let i = 1; i < parts.length; i += 2) {
            const num = parseInt(parts[i]);
            const txt = (parts[i + 1] || '').trim();
            if (num && txt) verses.push({ versiculo: num, texto: txt });
        }
        if (verses.length) return verses;
    }

    // Formato "1 texto\n2 texto" (número no início de cada linha/bloco)
    const matches = [...text.matchAll(/(?:^|\s)(\d{1,3})\s+([^\d].+?)(?=\s+\d{1,3}\s|$)/gs)];
    if (matches.length) {
        return matches.map(m => ({ versiculo: parseInt(m[1]), texto: m[2].trim() }));
    }

    // Fallback — retorna o capítulo inteiro como versículo 1
    return text ? [{ versiculo: 1, texto: text }] : [];
}

// Busca versões em português disponíveis na API.Bible
async function listBibles() {
    const data = await get('bibles?language=por');
    return (data.data || []).map(b => ({
        apiId:  b.id,
        nome:   b.nameLocal || b.name,
        abbrev: b.abbreviationLocal || b.abbreviation || b.id.slice(0, 8),
    }));
}

// Busca os versículos de um capítulo
async function getChapter(bibleApiId, livro, capitulo) {
    const osis = OSIS[livro];
    if (!osis) throw new Error(`Livro não reconhecido: ${livro}`);

    const chapterId = `${osis}.${capitulo}`;
    const qs = 'content-type=text&include-verse-numbers=true&include-titles=false&include-chapter-numbers=false';
    const data = await get(`bibles/${bibleApiId}/chapters/${chapterId}?${qs}`);

    if (!data.data || !data.data.content) return [];
    return parseVerses(data.data.content);
}

module.exports = { listBibles, getChapter };
