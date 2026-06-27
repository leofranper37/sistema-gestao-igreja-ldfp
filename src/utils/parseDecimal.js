const parseDecimal = (value) => {
    if (typeof value === 'number') {
        return Number.isFinite(value) ? value : Number.NaN;
    }

    const normalized = String(value || '')
        .replace(/\./g, '')
        .replace(',', '.')
        .replace(/[^0-9.-]/g, '');

    return Number(normalized);
};

module.exports = parseDecimal;